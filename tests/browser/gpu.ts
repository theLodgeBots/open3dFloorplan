import type { Page } from '@playwright/test';

// CI-only instrumentation of the browser's WebGL API. No app internals or debug
// hooks: retain contexts deliberately so GC cannot disguise missing teardown.
export async function observeGPU(page: Page) {
  await page.addInitScript(() => {
    const contexts: any[] = [];
    (window as any).__gpuAudit = contexts;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
      const context = (getContext as any).apply(this, args);
      if (!context || !String(args[0]).startsWith('webgl') || contexts.some(item => item.gl === context)) return context;
      const entry: any = { gl: context, canvas: this, draws: 0, live: {}, created: {} };
      contexts.push(entry);
      for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer', 'Renderbuffer']) {
        const objects = new Set(); entry.live[kind] = objects; entry.created[kind] = 0;
        const create = context[`create${kind}`].bind(context), remove = context[`delete${kind}`].bind(context);
        context[`create${kind}`] = (...args: any[]) => { const object = create(...args); if (object) { objects.add(object); entry.created[kind]++; } return object; };
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
export async function gpu(page: Page) {
  return page.evaluate(() => (window as any).__gpuAudit.map((item: any) => ({
    connected: item.canvas.isConnected, lost: item.gl.isContextLost(), draws: item.draws,
    width: item.canvas.width, height: item.canvas.height, created: { ...item.created },
    live: Object.fromEntries(Object.entries(item.live).map(([key, objects]: [string, any]) => [key, objects.size]))
  })));
}
