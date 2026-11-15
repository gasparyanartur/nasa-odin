import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { observePlanner, plannerReply } from './planner-helpers';
import { uiRoutes, uiDisplay, uiClose } from './ui-helpers';

test('static build plans both sites without any API and retains local field records',async({page},info)=>{
  test.setTimeout(180000);
  await observePlanner(page);const apiRequests:string[]=[],errors:string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  // The acceptance server is files-only. Even accidental API requests cannot succeed.
  expect((await page.request.get('/api/health')).status()).toBe(404);
  expect((await page.request.post('/api/routes',{data:{}})).status()).toBe(405);
  expect((await page.request.get('/gale/missing.f32')).status()).toBe(404);
  const timings=[];
  for(const site of ['yellowknife','boxwork']){
    await page.goto(`/?demo=${site}`);await uiRoutes(page);
    await page.evaluate(()=>{(window as any).plannerHeartbeat=0;(window as any).plannerTimer=setInterval(()=>{(window as any).plannerHeartbeat++;},10);});
    const start=Date.now();await page.getByRole('button',{name:'Plan route',exact:true}).click();await expect(page.locator('.route-card')).toHaveCount(2);
    const reply=await plannerReply(page,'routes');expect(reply.reply).toHaveProperty('result');
    const beats=await page.evaluate(()=>{clearInterval((window as any).plannerTimer);return (window as any).plannerHeartbeat;});expect(beats).toBeGreaterThan(0);
    const clickToCardsMs=Date.now()-start;
    await uiDisplay(page);await page.getByLabel('Graphics quality').selectOption('low');await uiClose(page);
    await expect(page.locator('.walk-instructions')).toBeVisible({timeout:60000});await expect(page.locator('.hud-bottom')).not.toContainText('Unavailable');
    const renderer=await page.locator('.walking-scene canvas').evaluate((canvas:HTMLCanvasElement)=>{const gl=canvas.getContext('webgl2'),extension=gl?.getExtension('WEBGL_debug_renderer_info');return extension?gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable';});
    timings.push({site,clickToCardsMs,heartbeatTicks:beats,renderer});
    await page.getByRole('button',{name:'Log here',exact:true}).click();await page.getByLabel('Field record title').fill(`Static ${site}`);await page.getByRole('button',{name:'Save field record',exact:true}).click();
    await page.reload();await page.getByRole('button',{name:'Field data',exact:true}).click();await expect(page.getByRole('region',{name:'Saved field records'})).toContainText(`Static ${site}`);
  }
  expect(apiRequests).toEqual([]);expect(errors).toEqual([]);
  const path=info.outputPath('static-planner-timings.json');
  await writeFile(path,JSON.stringify({timings,limitations:'Functional headless checks; recorded renderer identifies hardware/software mode. Heartbeat is not a POV frame-rate benchmark.'},null,2));
  await info.attach('static-planner-timings',{path,contentType:'application/json'});
});
