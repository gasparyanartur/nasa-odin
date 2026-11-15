import { expect, type Page } from '@playwright/test';
export async function uiTablet(page:Page,tab?:'Map'|'Routes'|'Field data'|'Display'){
  if(!await page.getByRole('dialog').isVisible())await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Tablet',exact:true}).click();
  if(tab)await page.getByRole('navigation',{name:'Tablet tools'}).getByRole('button',{name:tab,exact:true}).click();
}
export async function uiRoutes(page:Page){await uiTablet(page,'Routes');await page.getByRole('button',{name:'Plan new route',exact:true}).click();}
export async function uiDisplay(page:Page){await uiTablet(page,'Display');}
export async function uiClose(page:Page){await page.getByRole('dialog').getByRole('button',{name:'Close tablet',exact:false}).first().click();}
export async function uiStation(page:Page){
  if(await page.getByRole('dialog').isVisible())await page.getByRole('dialog').getByRole('button',{name:/Close tablet|Back to Station/}).first().click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Station',exact:true}).click();
}
export async function uiStationData(page:Page){
  const section=page.locator('.station-data');
  if(await section.getAttribute('open')===null)await section.locator(':scope > summary').click();
}
export async function uiLayers(page:Page){
  await uiTablet(page,'Map');await page.getByRole('button',{name:'Layers',exact:true}).click();
}
export async function uiAssumptions(page:Page){
  await uiRoutes(page);
  const section=page.locator('.advanced-assumptions');
  if(await section.getAttribute('open')===null)await section.locator(':scope > summary').click();
}
export async function uiRestart(page:Page){
  if(await page.getByRole('dialog').isVisible())await uiClose(page);
  await page.getByRole('button',{name:'Pause / menu',exact:true}).click();
  await page.getByRole('button',{name:'Restart excursion',exact:true}).click();
  await uiRoutes(page);
}
/** Route adoption keeps heading; turn explicitly toward Bradbury’s eastern targets. */
export async function uiFaceRoute(page:Page){
  await expect(page.locator('.walking-scene canvas')).toBeVisible({timeout:60_000});
  await page.locator('.walking-scene canvas').click({position:{x:450,y:350}});
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement!==null)).toBe(true);
  // Let Chromium finish pointer-lock recentering before applying a relative turn.
  await page.waitForTimeout(200);
  await page.evaluate(()=>{document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,bubbles:true}));});
  await expect.poll(async()=>{
    const heading=await page.locator('.hud-bottom>div').filter({has:page.locator('small',{hasText:/^HEADING$/})}).locator('strong').textContent();
    const delta=(90-parseFloat(heading!)+540)%360-180;
    if(Math.abs(delta)>.5)await page.evaluate(dx=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,bubbles:true})),delta*Math.PI/180/.002);
    return Math.abs(delta);
  }).toBeLessThanOrEqual(.5);
}
export async function uiPaths(page:Page){
  await uiTablet(page,'Routes');
  await page.getByRole('button',{name:'Load previous path',exact:true}).click();
}
