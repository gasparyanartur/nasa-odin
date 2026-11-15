import {test,expect} from '@playwright/test';
import {uiPaths,uiClose,uiDisplay,uiTablet} from './ui-helpers';
import {rectInsideVisor} from '../src/mission/visor-layout';

test('Boxwork is suggested first and saved historical/example paths load, toggle and persist separately from planning',async({page})=>{
 test.setTimeout(180_000);await page.goto('/');
 const first=page.getByRole('region',{name:'Regions'}).locator('.region-card').first();await expect(first).toContainText('Boxwork');await expect(first).toContainText('Suggested');await expect(first).toHaveAttribute('aria-pressed','false');await expect(page.locator('.map-caption')).toContainText('CHOOSE A REGION');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Explore Boxwork →',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 const plan=page.getByRole('button',{name:'Plan route',exact:true});await expect(plan).toBeEnabled();await expect(plan).toHaveCSS('background-color','rgb(138, 201, 229)');await plan.click();await expect(page.locator('.route-card')).toHaveCount(2);
 const pose=await page.getByTestId('tablet-explore-position').textContent();await uiPaths(page);
 const rover=page.getByLabel('Show path Curiosity · Boxwork traverse',{exact:true}),example=page.getByLabel('Show path Boxwork ridge · example route',{exact:true});
 await expect(page.getByRole('navigation',{name:'Tablet tools'}).getByRole('button',{name:'Routes',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Load previous path',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.map-detail-panel')).toHaveCount(0);await expect(rover).toBeChecked();await expect(example).not.toBeChecked();await expect(page.locator('.path-rover')).toContainText('travel time unavailable');
 await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-traces',/curiosity-boxwork/);
 await example.check();await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-traces',/boxwork-prepared-example/);await expect(page.locator('.path-example')).toContainText('NOT EXECUTED');
 await rover.uncheck();await expect(page.locator('.terrain-workspace canvas')).not.toHaveAttribute('data-traces',/curiosity-boxwork/);await expect(page.getByTestId('tablet-explore-position')).toHaveText(pose!);
 await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/previous-paths-followup.png'});
 await page.reload();await page.getByRole('button',{name:'Explore Boxwork →',exact:true}).click();await uiPaths(page);await expect(rover).not.toBeChecked();await expect(example).toBeChecked();await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-traces',/boxwork-prepared-example/);
 await rover.check();await example.uncheck();await expect(page.locator('.terrain-workspace canvas')).not.toHaveAttribute('data-traces',/boxwork-prepared-example/);
 await page.getByRole('button',{name:'Plan new route',exact:true}).click();await expect(page.getByLabel('Previous paths panel',{exact:true})).toHaveCount(0);await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-traces',/curiosity-boxwork/);await plan.click();await expect(page.locator('.route-card')).toHaveCount(2);
});

test('both sites keep all visible HUD text and controls inside the curved visor at laptop sizes',async({page})=>{
 test.setTimeout(240_000);
 for(const site of ['boxwork','yellowknife']){
  await page.goto(`/?demo=${site}`);await uiDisplay(page);await page.getByLabel('Live Earth UTC on HUD',{exact:true}).check();await uiClose(page);await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});
  for(const [width,height] of [[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[800,700]]){
   await page.setViewportSize({width,height});
   const boxes=await page.locator('.hud-heading,.hud-map,.hud-clock-panel,.hud-events,.hud-bottom,.hud-actions,.pose-readout,.surface-status,.visor-compass,.visor-waypoint,.waypoint-caption').evaluateAll(nodes=>{const parent=document.querySelector('.hud-page')!.getBoundingClientRect();return nodes.filter(el=>el.getClientRects().length).map(el=>{const b=el.getBoundingClientRect();return{selector:el.className,rect:{x:b.x-parent.x,y:b.y-parent.y,width:b.width,height:b.height},w:parent.width,h:parent.height};});});
   for(const b of boxes)expect(rectInsideVisor(b.rect,b.w,b.h),`${site} ${width}×${height}: ${b.selector} ${JSON.stringify(b.rect)}`).toBe(true);
   if(width===1280||width===800)await page.screenshot({timeout:60_000,path:`docs/evidence/expedition-feedback/${site}-visor-followup-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});await uiTablet(page,'Routes');await page.getByRole('button',{name:'Plan route',exact:true}).click();await expect(page.locator('.route-card')).toHaveCount(2);await uiClose(page);
  await page.locator('.walking-scene canvas').click({position:{x:450,y:330}});await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
  await page.evaluate(()=>{document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,bubbles:true}));document.dispatchEvent(new MouseEvent('mousemove',{movementX:200,movementY:0,bubbles:true}));});await page.keyboard.press('Escape');
  const captions=await page.locator('.waypoint-caption').evaluateAll(nodes=>{const parent=document.querySelector('.hud-page')!.getBoundingClientRect();return nodes.filter(el=>el.getClientRects().length).map(el=>{const b=el.getBoundingClientRect();return{rect:{x:b.x-parent.x,y:b.y-parent.y,width:b.width,height:b.height},w:parent.width,h:parent.height};});});for(const b of captions)expect(rectInsideVisor(b.rect,b.w,b.h)).toBe(true);
 }
});
