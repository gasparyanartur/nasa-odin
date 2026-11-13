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
  await page.getByRole('slider', {name:'Basemap opacity'}).fill('42');
  await page.getByRole('switch').uncheck();
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText('Layer hidden', { timeout: 15_000 });

  const hiddenView = await canvas.screenshot();
  await page.getByText('Advanced: import a dataset', {exact:true}).click();
  const upload = page.getByLabel('Load dataset JSON');
  await upload.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByRole('alert')).toContainText('valid JSON');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();
  const ctx = await readFile('tests/fixtures/ctx.json');
  await upload.setInputFiles({ name: 'ctx.json', mimeType: 'application/json', buffer: ctx });
  await expect(page.getByRole('heading', { name: 'CTX · Orbital imagery' })).toBeVisible();
  await expect(page.getByRole('slider', {name:'Basemap opacity'})).toHaveValue('42');
  await expect(page.getByRole('switch')).not.toBeChecked();
  expect(await canvas.screenshot()).toEqual(hiddenView);
  await page.getByRole('switch').check();
  await expect.poll(() => responses.some((url) => url.includes('OnMars/CTX/MapServer/tile/')), { timeout: 60_000 }).toBe(true);
  await expect(page.getByRole('status', { name: 'Layer status' })).toHaveText(/Layer active|Needs attention/, { timeout: 60_000 });
  if ((await page.getByRole('status', {name:'Layer status'}).textContent()) === 'Needs attention') {
    await expect(page.getByRole('alert')).toContainText('Some map tiles could not load');
    testInfo.annotations.push({type:'upstream',description:'CTX reported unavailable tiles; successful real tile responses were observed and MOLA recovery is verified below.'});
  }
  await page.screenshot({ path: testInfo.outputPath('ctx-swapped.png') });

  // A delayed file read must not override a newer catalog selection.
  await page.evaluate(()=>{const read=File.prototype.text;File.prototype.text=function(this:File){return this.name==='slow.json'?new Promise<string>(resolve=>setTimeout(()=>read.call(this).then(resolve),600)):read.call(this);};});
  await upload.setInputFiles({name:'slow.json',mimeType:'application/json',buffer:ctx});
  await page.getByLabel('Global basemap').selectOption('mola-global-relief');
  await page.waitForTimeout(750);
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();
  await expect(page.getByRole('slider', {name:'Basemap opacity'})).toHaveValue('42');
  await page.getByRole('slider', {name:'Basemap opacity'}).fill('100');
  const bad = JSON.parse(ctx.toString()); bad.reference = 'EPSG:4326';
  await upload.setInputFiles({ name: 'earth.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.getByRole('alert')).toContainText('Unsupported reference');
  await expect(page.getByRole('heading', { name: 'MOLA · Global relief' })).toBeVisible();

  const offline = JSON.parse(ctx.toString()); offline.name = 'Offline source';
  offline.provider.url = new URL('/missing/{TileMatrix}/{TileRow}/{TileCol}.png',page.url()).href.replaceAll('%7B','{').replaceAll('%7D','}');
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
