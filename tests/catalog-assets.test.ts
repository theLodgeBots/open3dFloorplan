import { afterEach, expect, it } from 'vitest';
import { build } from 'vite';
import type { RollupOutput } from 'rollup';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogAssets } from '../tooling/catalog-assets.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('emits content-hashed public URLs and invalidates only modified assets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openplan-assets-')); roots.push(root);
  mkdirSync(join(root, 'static/models'), { recursive: true });
  mkdirSync(join(root, 'static/textures'), { recursive: true });
  writeFileSync(join(root, 'static/models/chair.glb'), 'model-v1');
  writeFileSync(join(root, 'static/textures/oak.jpg'), 'texture-v1');
  writeFileSync(join(root, 'main.js'), "export { default } from 'virtual:catalog-assets';");
  async function compile() {
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [catalogAssets()], build: { write: false, minify: false, rollupOptions: { input: join(root, 'main.js'), preserveEntrySignatures: 'strict', output: { assetFileNames: '_app/immutable/assets/[name].[hash][extname]' } } } }) as RollupOutput;
    const chunk = result.output.find(x => x.type === 'chunk')!;
    if (chunk.type !== 'chunk') throw new Error('Entry chunk missing');
    const urls = (await import('data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64'))).default as Record<string, string>;
    return { urls, assets: result.output.filter(x => x.type === 'asset').map(x => '/' + x.fileName) };
  }
  const first = await compile();
  expect(first.urls['/models/chair.glb']).toMatch(/^\/_app\/immutable\/assets\/chair\.[\w-]+\.glb$/);
  expect(first.assets).toContain(first.urls['/models/chair.glb']);
  expect(first.assets).toContain(first.urls['/textures/oak.jpg']);
  const unchanged = await compile();
  expect(unchanged.urls).toEqual(first.urls);
  writeFileSync(join(root, 'static/models/chair.glb'), 'model-v2');
  const changed = await compile();
  expect(changed.urls['/models/chair.glb']).not.toEqual(first.urls['/models/chair.glb']);
  expect(changed.urls['/textures/oak.jpg']).toEqual(first.urls['/textures/oak.jpg']);
});
