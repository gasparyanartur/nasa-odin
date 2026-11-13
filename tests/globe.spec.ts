import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('production globe, controls, invalid import, live real-data swap and recovery', async ({ page }, testInfo) => {
  const exceptions: string[] = [];
  const responses: string[] = [];
  page.on('pageerror', (error) => exceptions.push(error.message));
  page.on('response', (response) => { if (response.ok()) responses.push(response.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();
  await expect.poll(() => responses.some((url) => url.includes('MOLA') && url.includes('.jpg')), { timeout: 60_000 }).toBe(true);
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer active', { timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath('mola-desktop.png') });

  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.height / 2);
  await page.mouse.wheel(0, -200);
  await page.getByRole('slider').fill('42');
  await page.getByRole('switch').uncheck();
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer hidden', { timeout: 15_000 });

  const hiddenView = await canvas.screenshot();
  const upload = page.getByLabel('Load dataset JSON');
  await upload.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByRole('alert')).toContainText('valid JSON');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();
  const ctx = await readFile('tests/fixtures/ctx.json');
  await upload.setInputFiles({ name: 'ctx.json', mimeType: 'application/json', buffer: ctx });
  await expect(page.getByRole('heading', { name: 'CTX · Orbital imagery' })).toBeVisible();
  await expect(page.getByRole('slider')).toHaveValue('42');
  await expect(page.getByRole('switch')).not.toBeChecked();
  expect(await canvas.screenshot()).toEqual(hiddenView);
  await page.getByRole('switch').check();
  await expect.poll(() => responses.some((url) => url.includes('OnMars/CTX/MapServer/tile/')), { timeout: 60_000 }).toBe(true);
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer active', { timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath('ctx-swapped.png') });

  await upload.setInputFiles('public/datasets/mola.json');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();
  await expect(page.getByRole('slider')).toHaveValue('42');
  await page.getByRole('slider').fill('100');
  const bad = JSON.parse(ctx.toString()); bad.reference = 'EPSG:4326';
  await upload.setInputFiles({ name: 'earth.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.getByRole('alert')).toContainText('Unsupported reference');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();

  const offline = JSON.parse(ctx.toString()); offline.name = 'Offline source';
  offline.provider.url = 'http://127.0.0.1:4173/missing/{TileMatrix}/{TileRow}/{TileCol}.png';
  await upload.setInputFiles({ name: 'offline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(offline)) });
  await expect(page.getByRole('alert')).toContainText('tiles could not load', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Retry loading/ })).toBeVisible();
  await page.getByRole('button', { name: /Retry loading/ }).click();
  await expect(page.getByRole('alert')).toContainText('tiles could not load', { timeout: 30_000 });
  await upload.setInputFiles('public/datasets/mola.json');
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer active', { timeout: 60_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer active', { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Explore the surface.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mola-mobile.png'), fullPage: true });
  expect(exceptions).toEqual([]);
});
