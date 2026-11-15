import {test,expect,type Page} from '@playwright/test';
import {uiTablet,uiClose,uiStation,uiDisplay,uiAssumptions,uiPaths} from './ui-helpers';
const tool=(page:Page,name:string)=>page.getByRole('navigation',{name:'Tablet tools'}).getByRole('button',{name,exact:true});
async function walk(page:Page,seconds=2){
 await uiClose(page);await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});
 await page.locator('.walking-scene canvas').click({position:{x:600,y:300}});
 await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
 await expect(page.locator('.walk-instructions')).toBeHidden();
 await page.keyboard.down('w');await page.waitForTimeout(seconds*1000);await page.keyboard.up('w');await page.keyboard.press('Escape');await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock();});
 await expect(page.locator('.walk-instructions')).toBeVisible();
 await uiTablet(page,'Routes');await uiPaths(page);
}
test('actual walks save, compare, reload, delete and stay separate from rover references',async({page})=>{
 test.setTimeout(180_000);await page.goto('/?demo=yellowknife');
 await expect(page.locator('.terrain-workspace canvas')).toBeVisible();
 await walk(page,3);
 await page.getByLabel('Traverse name',{exact:true}).fill('First walk');await page.getByRole('button',{name:'Save executed traverse',exact:true}).click();
 await expect(page.locator('.path-walk')).toContainText('First walk');
 await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-traces',/current,.+/);
 await walk(page,3);await page.getByLabel('Traverse name',{exact:true}).fill('Second walk');await page.getByRole('button',{name:'Save executed traverse',exact:true}).click();
 await page.getByLabel('Show path First walk',{exact:true}).check();
 await expect(page.locator('.traverse-comparison')).toContainText('distance');
 const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('martian-map.traverses.v1')!));
 expect(history.records).toHaveLength(2);expect(history.records[0].samples.length).toBeGreaterThan(2);expect(history.records[0].samples.at(-1).elapsed).toBeGreaterThan(history.records[1].samples.at(-1).elapsed);
 await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/traverse-comparison.png'});
 await page.reload();await tool(page,'Routes').click();await uiPaths(page);await expect(page.locator('.path-walk')).toHaveCount(2);
 await expect(page.getByLabel('Show path Curiosity · Boxwork traverse',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Delete traverse First walk',exact:true}).click();await expect(page.locator('.path-walk')).toHaveCount(1);
 await page.goto('/?demo=boxwork');await tool(page,'Routes').click();await uiPaths(page);await expect(page.getByLabel('Show path Curiosity · Boxwork traverse',{exact:true})).toBeEnabled();
 await page.getByLabel('Show path Curiosity · Boxwork traverse',{exact:true}).uncheck();await expect(page.getByLabel('Show path Curiosity · Boxwork traverse',{exact:true})).not.toBeChecked();
 await expect(page.getByRole('link',{name:'Published rover waypoint source'})).toHaveAttribute('href',/mars.nasa.gov/);
 await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/rover-reference.png'});
});
test('scheduled events pause on Tablet, trigger in the field, share acknowledgement and retain pose on return',async({page})=>{
 test.setTimeout(180_000);await page.goto('/?demo=yellowknife');await uiDisplay(page);
 await page.getByLabel('Simulation pace',{exact:true}).selectOption('20');
 await uiAssumptions(page);await page.getByLabel('Walking speed',{exact:true}).fill('3');await page.getByLabel('Slope limit',{exact:true}).fill('45');
 await walk(page,5);
 await tool(page,'Events').click();await page.getByLabel('Event delay minutes').fill('.1');await page.getByRole('button',{name:'Schedule event',exact:true}).click();
 await expect(page.locator('.event-entry')).toContainText('SCHEDULED');
 const paused=await page.getByTestId('tablet-explore-position').textContent();await page.waitForTimeout(500);await expect(page.getByTestId('tablet-explore-position')).toHaveText(paused!);
 await uiClose(page);await page.locator('.walking-scene canvas').click({position:{x:600,y:300}});await page.keyboard.down('w');await expect(page.locator('.hud-event-card.danger')).toContainText('return to habitat',{timeout:20_000});await page.keyboard.up('w');await page.keyboard.press('Escape');await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock();});
 await expect(page.locator('[data-waypoint^="event-"]')).toHaveCount(1);
 await page.locator('.hud-event-card.danger').getByRole('button',{name:'Event details'}).click();
 await expect(page.locator('.event-entry.active')).toContainText('Solar-particle scenario');
 await page.getByRole('button',{name:'Acknowledge',exact:true}).click();await expect(page.getByRole('button',{name:'Acknowledge',exact:true})).toBeDisabled();
 await tool(page,'Map').click();await expect(page.locator('.terrain-workspace canvas')).toHaveAttribute('data-hazards','1');
 await tool(page,'Events').click();await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/tablet-events.png'});
 await expect(page.getByRole('button',{name:'Guide to habitat',exact:true})).toBeEnabled({timeout:20_000});
 const position=await page.getByTestId('tablet-explore-position').textContent();await page.getByRole('button',{name:'Guide to habitat',exact:true}).click();
 await expect(page.locator('.hud-heading')).toContainText('Returning to habitat');await expect(page.locator('.hud-event-card.danger')).toContainText('ACKNOWLEDGED');
 await uiTablet(page);await expect(page.getByTestId('tablet-explore-position')).toHaveText(position!);
 await tool(page,'Events').click();await page.getByRole('button',{name:'End scenario',exact:true}).click();await expect(page.locator('.event-entry.ended')).toHaveCount(1);
 await page.getByLabel('Event scenario').selectOption('dust');await page.getByRole('button',{name:'Trigger now',exact:true}).click();
 await uiClose(page);await expect(page.locator('.hud-event-card.danger')).toContainText('leave the marked dust area');
 await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/hud-dust.png'});
 // Reopening a failed renderer must preserve the active event and unsaved trace.
 await page.locator('.walking-scene canvas').evaluate(el=>(el as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
 await expect(page.getByRole('alert').filter({hasText:'The 3D display was interrupted'})).toBeVisible();
 await page.getByRole('button',{name:'Open Tablet · keep mission',exact:true}).click();
 await expect(page.locator('.event-entry.active')).toHaveCount(1);
 await tool(page,'Routes').click();await uiPaths(page);await page.getByLabel('Traverse name',{exact:true}).fill('Event detour');await page.getByRole('button',{name:'Save executed traverse',exact:true}).click();await expect(page.locator('.path-walk')).toContainText('Event detour');
 await uiClose(page);await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});await expect(page.locator('.hud-event-card.danger')).toContainText('dust');
 await page.getByRole('button',{name:'Pause / menu',exact:true}).click();await page.getByRole('button',{name:'Restart excursion',exact:true}).click();await tool(page,'Events').click();await expect(page.locator('.event-entry')).toHaveCount(0);await tool(page,'Routes').click();await uiPaths(page);await expect(page.locator('.path-walk')).toContainText('Event detour');

});
test('help is explicit and keyboard accessible; circular minimap and visor content fit laptop viewports',async({page})=>{
 test.setTimeout(180_000);await page.goto('/?demo=yellowknife');
 await page.getByRole('button',{name:'Help · controls & symbols',exact:true}).click();await expect(page.getByRole('region',{name:'Route controls and quantities'})).toContainText('Habitat Place');
 await page.getByRole('button',{name:'Hide help',exact:true}).click();
 const hint=page.getByRole('button',{name:'About route endpoints'});await hint.click();await expect(hint).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('tooltip').filter({visible:true})).toContainText('H is the habitat');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await uiClose(page);await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});
 for(const [w,h] of [[1280,720],[1366,768],[1440,900],[800,700]]){
  await page.setViewportSize({width:w,height:h});
  const map=await page.locator('.hud-map .surface-map').evaluate(el=>{const r=el.getBoundingClientRect();return{w:r.width,h:r.height,radius:getComputedStyle(el).borderRadius};});expect(map.w).toBe(map.h);expect(map.radius).toBe('50%');
  const boxes=await page.locator('.hud-heading,.hud-events,.hud-map,.hud-clock-panel,.hud-bottom,.hud-actions,.pose-readout').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),v=document.querySelector('.visor-frame')!.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,v:{x:v.x,y:v.y,right:v.right,bottom:v.bottom}};}));
  for(const r of boxes){expect(r.x).toBeGreaterThan(r.v.x);expect(r.y).toBeGreaterThan(r.v.y);expect(r.right).toBeLessThan(r.v.right);expect(r.bottom).toBeLessThan(r.v.bottom);}
  await page.screenshot({timeout:60_000,path:`docs/evidence/expedition-feedback/hud-${w}.png`});
 }
 await uiStation(page);await page.locator('.explorer .context-guide > button').click();await expect(page.getByRole('region',{name:'Station controls'})).toContainText('Data & history');
 await expect(page.getByRole('button',{name:'About regions'})).toBeVisible();await page.getByRole('button',{name:'About regions'}).hover();await expect(page.getByRole('tooltip').filter({visible:true})).toContainText('Changing site');
 await page.screenshot({timeout:60_000,path:'docs/evidence/expedition-feedback/station-help.png'});
});
