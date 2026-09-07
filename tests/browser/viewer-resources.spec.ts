import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

// CI-only instrumentation of the browser's WebGL API. No app internals or debug
// hooks: retain contexts deliberately so GC cannot disguise missing teardown.
async function observeGPU(page: Page) {
  await page.addInitScript(() => {
    const contexts: any[] = [];
    (window as any).__gpuAudit = contexts;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
      const context = (getContext as any).apply(this, args);
      if (!context || !String(args[0]).startsWith('webgl') || contexts.some(item => item.gl === context)) return context;
      const entry: any = { gl: context, canvas: this, draws: 0, live: {} };
      contexts.push(entry);
      for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer', 'Renderbuffer']) {
        const objects = new Set(); entry.live[kind] = objects;
        const create = context[`create${kind}`].bind(context), remove = context[`delete${kind}`].bind(context);
        context[`create${kind}`] = (...args: any[]) => { const object = create(...args); if (object) objects.add(object); return object; };
        context[`delete${kind}`] = (object: any) => { objects.delete(object); return remove(object); };
      }
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = context[name]?.bind(context);
        if (draw) context[name] = (...args: any[]) => { entry.draws++; return draw(...args); };
      }
      return context;
    } as typeof getContext;
  });
}
async function gpu(page: Page) {
  return page.evaluate(() => (window as any).__gpuAudit.map((item: any) => ({
    connected: item.canvas.isConnected, lost: item.gl.isContextLost(), draws: item.draws,
    width: item.canvas.width, height: item.canvas.height,
    live: Object.fromEntries(Object.entries(item.live).map(([key, objects]: [string, any]) => [key, objects.size]))
  })));
}
async function placeCamera(page: Page) {
  await page.getByRole('button', { name: 'Place Interior Camera', exact: true }).click();
  const canvas = page.getByRole('region', { name: '3D floor plan viewer' }).locator('canvas').last();
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds!.width * 0.45, y: bounds!.height * 0.5 } });
  await expect(page.getByRole('button', { name: 'Close camera', exact: true })).toBeVisible();
}

test('camera previews release their WebGL context and render on every reopen', async ({ page }, testInfo) => {
  await observeGPU(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const samples: any[] = [];
  try {
    await page.goto('/editor');
    await page.getByRole('button', { name: '3D', exact: true }).click();
    for (let cycle = 0; cycle < 3; cycle++) {
      await placeCamera(page);
      await expect.poll(async () => (await gpu(page)).filter((item: any) => !item.lost && item.width === 384 && item.height === 216 && item.connected && item.draws > 0).length).toBe(1);
      samples.push({ phase: `open-${cycle}`, contexts: await gpu(page) });
      await page.getByRole('button', { name: 'Close camera', exact: true }).click();
      samples.push({ phase: `close-${cycle}`, contexts: await gpu(page) });
      await expect.poll(async () => (await gpu(page)).filter((item: any) => !item.lost).length).toBe(1);
    }
    await placeCamera(page);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect.poll(async () => (await gpu(page)).filter((item: any) => !item.lost).length).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    samples.push({ phase: 'final', contexts: await gpu(page) });
    await testInfo.attach('webgl-resource-counts', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  }
});


test('textured scene rebuilds retain a bounded number of GPU resources', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await observeGPU(page);
  const samples: any[] = [];
  try {
    await page.goto('/editor');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await (await chooser).setFiles(resolve('tests/fixtures/connected-dimensions.openplan.json'));
    await page.getByRole('button', { name: 'Save', exact: true }).press('l');
    await page.getByRole('button', { name: '─ Wall 1', exact: true }).click();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await page.waitForLoadState('networkidle');
    const cycle = async () => {
      for (const name of ['Show All Floors Stacked', 'Active Floor Only']) {
        const before = (await gpu(page))[0].draws;
        await page.getByRole('button', { name, exact: true }).click();
        await expect.poll(async () => (await gpu(page))[0].draws).toBeGreaterThan(before);
      }
      return (await gpu(page))[0].live;
    };
    await cycle(); // warm both presentation modes and lazily loaded textures
    const baseline = await cycle();
    samples.push({ phase: 'warmed', live: baseline });
    for (let index = 0; index < 4; index++) samples.push({ phase: `rebuild-${index}`, live: await cycle() });
    expect(samples.at(-1).live).toEqual(baseline);
  } finally {
    await testInfo.attach('scene-resource-counts', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  }
});
