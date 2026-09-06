import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPackageZip, packageJSON } from '../../src/lib/utils/projectPackageZip';
import { savedProjects, storedRecords } from './storage';

const fixture = resolve('tests/fixtures/native-project-package.zip');
async function choose(page: Page, path = fixture) {
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose project package', exact: true }).click();
  await (await pending).setFiles(path);
}
function observe(page: Page) {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4188') external.push(request.url()); });
  return () => { expect(errors).toEqual([]); expect(external).toEqual([]); };
}
async function packageDownload(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project package', exact: true }).click();
  const path = (await (await pending).path())!;
  return readPackageZip(new Uint8Array(await readFile(path)));
}
for (const width of [1440, 390]) test(`native package preview/import/edit/reload/export remains local at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const check = observe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Import a project package', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import project package', exact: true });
  const before = await storedRecords(page);
  await choose(page);
  await expect(dialog).toContainText('QA Project Package');
  await expect(dialog).toContainText('3 floors · 5 walls · 2 attachment files');
  await expect(dialog).toContainText('Photos, item notes, costs and native details travel with this package.');
  expect(await storedRecords(page)).toEqual(before);
  await testInfo.attach(`package-preview-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Import as copy', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Project imported.');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('link', { name: 'QA Project Package (Imported copy)', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).press('l');
  await page.getByRole('button', { name: '─ Wall 1', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Thickness (cm)', exact: true })).toHaveValue('27.5');
  await page.getByRole('spinbutton', { name: 'Thickness (cm)', exact: true }).fill('33.75');
  await page.getByRole('spinbutton', { name: 'Thickness (cm)', exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => Object.values(await savedProjects(page))[0].floors[0].walls[0].thickness).toBe(33.75);
  await page.reload();
  const files = await packageDownload(page), native = packageJSON(files['plan.json']);
  expect(native.walls[0].thickness).toBe(0.3375);
  expect(native.walls[0].extension.future).toBe(true);
  expect(native.furniture[0].price).toBe(456.75);
  expect(native.furniture[0].note).toBe('Keep furniture note');
  expect(native.notes[0].text).toBe('Pinned note');
  const original = readPackageZip(new Uint8Array(await readFile(fixture)));
  expect(files['assets/chair.png']).toEqual(original['assets/chair.png']);
  expect(files['assets/orphan.png']).toEqual(original['assets/orphan.png']);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('region', { name: '3D floor plan viewer' }).locator('canvas').first()).toBeVisible();
  check();
});
test('actual Swift return package restores web-only details and Swift edits', async ({ page }) => {
  const check = observe(page);
  await page.goto('/'); await page.getByRole('button', { name: 'Import a project package', exact: true }).click();
  await choose(page, resolve('tests/fixtures/swift-return-project-package.zip'));
  await page.getByRole('button', { name: 'Import as copy', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Project imported.');
  const project = Object.values(await savedProjects(page))[0];
  expect(project.floors[0].walls[0]).toMatchObject({ thickness: 37.25, startHeight: 273.5, endHeight: 123.75 });
  expect(project.floors[0].furniture[0]).toMatchObject({ width: 78.75, scale: { x: -2, y: 1.5, z: 1 } });
  expect(project.floors[0].elevation).toBe(47.25);
  expect(project.floors[0].textAnnotations[0].text).toBe('Edited in Swift');
  check();
});
test('package cancellation, invalid file and quota retry preserve the existing library', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
  const check = observe(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  const before = await storedRecords(page);
  await page.getByRole('button', { name: 'Import project package', exact: true }).click();
  await choose(page); await expect(page.getByRole('dialog')).toContainText('QA Project Package');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await storedRecords(page)).toEqual(before);
  await page.getByRole('button', { name: 'Import project package', exact: true }).click();
  await choose(page, resolve('tests/fixtures/library-backup.json'));
  await expect(page.getByRole('alert')).toContainText('Invalid project package');
  expect(await storedRecords(page)).toEqual(before);
  await choose(page);
  await page.evaluate(() => {
    (window as any).packageQuota = true;
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) {
      if (this.name === 'projects' && (window as any).packageQuota) throw new DOMException('Full', 'QuotaExceededError');
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Import as copy', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nothing was imported.');
  expect(await storedRecords(page)).toEqual(before);
  await page.evaluate(() => { (window as any).packageQuota = false; });
  await page.getByRole('button', { name: 'Import as copy', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Project imported.');
  expect(Object.keys(await storedRecords(page))).toHaveLength(Object.keys(before).length + 1);
  check();
});
