import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { benchmarkProject, benchmarkSizes, type BenchmarkSize } from '../fixtures/render-benchmark';
import { observeGPU, gpu } from '../browser/gpu';

for (const size of Object.keys(benchmarkSizes) as BenchmarkSize[]) test(`${size} furnished home`, async ({ page }, testInfo) => {
  const project = benchmarkProject(size);
  await observeGPU(page);
  const errors: string[] = [], external: string[] = [], assets = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4188') external.push(request.url());
    if (/\.glb$/.test(request.url())) assets.add(request.url());
  });
  await page.goto('/editor');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await (await chooser).setFiles({ name: `${size}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.getByRole('button', { name: project.name, exact: true })).toBeVisible();
  const started = performance.now();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect.poll(async () => (await gpu(page))[0]?.draws ?? 0).toBeGreaterThan(0);
  const firstDrawMs = performance.now() - started;
  await page.waitForLoadState('networkidle');
  const readyMs = performance.now() - started;
  const settled = async () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await settled();
  const beforeRename = (await gpu(page))[0];
  const renameStart = performance.now();
  await page.getByRole('button', { name: project.name, exact: true }).click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill(`${project.name} renamed`);
  await page.getByRole('textbox', { name: 'Project name', exact: true }).press('Enter');
  await settled();
  const renameMs = performance.now() - renameStart, afterRename = (await gpu(page))[0];
  const renameAllocations = Object.fromEntries(Object.keys(beforeRename.created).map(key => [key, afterRename.created[key] - beforeRename.created[key]]));
  const stackStart = performance.now();
  await page.getByRole('button', { name: 'Show All Floors Stacked', exact: true }).click();
  await settled();
  const stackMs = performance.now() - stackStart, stacked = (await gpu(page))[0];
  await page.getByRole('button', { name: 'Active Floor Only', exact: true }).click();
  await settled();
  const canvas = page.getByRole('region', { name: '3D floor plan viewer' }).locator('canvas').last();
  const bounds = (await canvas.boundingBox())!;
  // rAF cadence during a real pointer drag. This is frame scheduling latency,
  // not a GPU timer query or a claim about physical phone performance.
  await page.evaluate(() => {
    (window as any).__frameSamples = [];
    let last = performance.now(), remaining = 40;
    function sample(now: number) { (window as any).__frameSamples.push(now - last); last = now; if (--remaining) requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
  });
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.6, { steps: 30 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__frameSamples.length)).toBe(40);
  const intervals = await page.evaluate(() => (window as any).__frameSamples as number[]);
  const sorted = intervals.slice(1).sort((a, b) => a - b);
  const report = {
    fixtureVersion: 1, size, profile: testInfo.project.name,
    environment: { browser: testInfo.project.use.browserName ?? 'chromium', viewport: page.viewportSize(), dpr: await page.evaluate(() => devicePixelRatio), ci: !!process.env.CI, renderer: 'CI uses software rendering; phone profile is a viewport, not a device' },
    project: { floors: project.floors.length, rooms: project.floors.reduce((n, floor) => n + floor.rooms.length, 0), walls: project.floors.reduce((n, floor) => n + floor.walls.length, 0), furniture: project.floors.reduce((n, floor) => n + floor.furniture.length, 0), activeFurniture: project.floors[0].furniture.length, jsonBytes: Buffer.byteLength(JSON.stringify(project)), distinctModelRequests: assets.size },
    firstDrawMs, readyMs, renameMs, stackMs, renameAllocations,
    activeResources: beforeRename.live, stackedResources: stacked.live,
    dragFrameIntervalMs: { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], samples: sorted.length },
  };
  const path = testInfo.outputPath('metrics.json');
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log('RENDER_BENCHMARK', JSON.stringify(report));
  await testInfo.attach('render-benchmark', { path, contentType: 'application/json' });
  expect(errors).toEqual([]); expect(external).toEqual([]);
  expect(assets.size).toBe(3);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect.poll(async () => (await gpu(page)).filter((context: any) => !context.lost).length).toBe(0);
});
