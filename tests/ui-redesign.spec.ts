import { observePlanner, plannerCount, plannerReply } from './planner-helpers';
import { test, expect, type Page } from '@playwright/test';

const tablet=(page:Page)=>page.getByRole('dialog');
const tool=(page:Page,name:string)=>page.getByRole('navigation',{name:'Tablet tools'}).getByRole('button',{name,exact:true});
const nav=(page:Page)=>page.getByRole('navigation',{name:'Main navigation'});
async function enter(page:Page,site='boxwork') {
  await page.goto(`/?demo=${site}`);
  await expect(tablet(page)).toBeVisible();
  await expect(tablet(page).getByRole('button',{name:'Close tablet',exact:false}).first()).toBeEnabled();
  await tablet(page).getByRole('button',{name:'Close tablet',exact:false}).first().click();
  await expect(tablet(page)).toBeHidden();
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});
}
async function walk(page:Page) {
  await page.locator('.walking-scene canvas').click({position:{x:550,y:330}});
  await expect(page.locator('.walk-instructions')).toBeHidden();
  await page.keyboard.down('w');
  await expect.poll(async()=>parseFloat((await page.getByTestId('elapsed').textContent())!)).toBeGreaterThan(1);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect(page.locator('.walk-instructions')).toBeVisible();
}
async function visibleWithinViewport(page:Page,selector:string) {
  const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:innerWidth,h:innerHeight};}));
  expect(boxes.length).toBeGreaterThan(0);
  for(const b of boxes){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(b.w+1);expect(b.bottom).toBeLessThanOrEqual(b.h+1);}
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('free exploration on both sites retains pose, time, draft and independent return estimates',async({page},info)=>{
  test.setTimeout(240_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const site of ['yellowknife','boxwork']) {
    await enter(page,site);
    await expect(page.locator('.hud-heading')).toContainText('Free exploration');
    await expect(page.locator('[data-waypoint="next"]')).toHaveCount(0);
    await expect(page.locator('[data-waypoint="destination"]')).toHaveCount(0);
    await expect(page.locator('.hud-bottom')).not.toContainText('NEXT WAYPOINT');
    await expect(page.locator('.hud-bottom')).toContainText('At habitat');
    await walk(page);
    const position=await page.getByTestId('position').textContent();
    const elapsed=await page.getByTestId('elapsed').textContent();
    const scene=await page.locator('.walking-scene canvas').elementHandle();
    await page.getByRole('button',{name:'Open tablet',exact:true}).click();
    await expect(tablet(page)).toBeVisible();
    await expect(page.getByTestId('tablet-explore-position')).toContainText(elapsed!.replace(' s',' s elapsed'));
    await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);
    await page.waitForTimeout(200);
    await expect(page.getByTestId('tablet-explore-position')).toContainText(elapsed!.replace(' s',' s elapsed'));
    await expect.poll(()=>scene!.evaluate(node=>node.isConnected)).toBe(true);
    await tool(page,'Field data').click();
    await page.getByRole('button',{name:'Log at astronaut',exact:true}).click();
    await page.getByLabel('Field record title',{exact:true}).fill(`Retained ${site}`);
    await tool(page,'Display').click();
    await page.getByLabel('Live Earth UTC on HUD',{exact:true}).check();
    await page.getByRole('button',{name:'Close tablet',exact:false}).first().click();
    await expect(page.getByTestId('position')).toHaveText(position!);
    await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
    await expect(page.locator('.walk-instructions')).toBeVisible();
    await page.getByRole('button',{name:'Log here',exact:true}).click();
    await expect(page.getByLabel('Field record title',{exact:true})).toHaveValue(`Retained ${site}`);
    await page.getByRole('button',{name:'Save field record',exact:true}).click();
    await expect(page.getByRole('region',{name:'Saved field records'})).toContainText(`Retained ${site}`);
    await page.screenshot({timeout:60_000,path:info.outputPath(`${site}-field.png`)});
    await page.keyboard.press('Escape');
    await nav(page).getByRole('button',{name:'Station',exact:true}).click();
    await nav(page).getByRole('button',{name:'HUD · Surface',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText(position!);
    await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
  }
  expect(errors).toEqual([]);
});

test('planning and route adoption preserve walking pose, layers and profile remain accessible',async({page})=>{
  test.setTimeout(180_000);
  await enter(page,'yellowknife');await walk(page);
  const position=await page.getByTestId('position').textContent(),elapsed=await page.getByTestId('elapsed').textContent();
  await page.getByRole('button',{name:'Open tablet',exact:true}).click();
  await tool(page,'Routes').click();
  await expect(page.getByRole('complementary',{name:'Routes',exact:true})).toContainText('from habitat');
  await page.locator('.advanced-assumptions > summary').click();
  await page.getByLabel('Walking speed',{exact:true}).fill('1');
  await expect(page.getByTestId('tablet-explore-position')).toContainText(elapsed!.replace(' s',' s elapsed'));
  await page.locator('.target-picker > summary').click();
  await page.getByRole('button',{name:'Plan to Rocknest →',exact:true}).click();
  await expect(page.getByTestId('tablet-explore-position')).toContainText(elapsed!.replace(' s',' s elapsed'));
  await tablet(page).getByRole('button',{name:'Plan route',exact:true}).click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Walk selected route →',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Walk selected route →',exact:true}).click();
  await expect(page.getByTestId('position')).toHaveText(position!);
  await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
  await expect(page.locator('[data-waypoint="next"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Open tablet',exact:true}).click();
  await tool(page,'Routes').click();
  await page.getByLabel('Profile distance',{exact:true}).fill('100');
  await expect(page.locator('.terrain-workspace canvas')).not.toHaveAttribute('data-highlighted-edge','');
  await tool(page,'Map').click();await page.getByRole('button',{name:'Layers',exact:true}).click();
  await expect(page.getByLabel('Map layers',{exact:true})).toBeVisible();
  await page.getByLabel('Elevation',{exact:true}).check();
  await page.getByRole('button',{name:'Inspect data',exact:true}).click();
  await expect(page.getByLabel('Data evidence',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Map layers',{exact:true})).toHaveCount(0);
  await tool(page,'Routes').click();await page.getByRole('button',{name:'Clear guidance',exact:true}).click();
  await page.getByRole('button',{name:'Enter surface',exact:true}).click();
  await expect(page.locator('.hud-heading')).toContainText('Free exploration');
  await expect(page.getByTestId('position')).toHaveText(position!);
  await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
});

test('return worker failure does not block free walking and can be retried',async({page})=>{
  await observePlanner(page,{fail:{return:true}});
  await enter(page,'yellowknife');
  await expect(page.locator('.hud-bottom')).toContainText('Unavailable');
  await walk(page);
  await expect(page.getByRole('button',{name:'Retry return estimate'})).toBeVisible();
  await page.evaluate(()=>window.plannerTest.fail.return=false);
  const mark=await plannerCount(page);
  await page.getByRole('button',{name:'Retry return estimate'}).click();
  const response=await plannerReply(page,'return',mark);expect(response.reply).toHaveProperty('result');
  await expect(page.locator('.hud-bottom')).not.toContainText('Unavailable');
  await expect(page.getByRole('button',{name:'Retry return estimate'})).toHaveCount(0);
});

test('laptop layouts keep core actions and complete map visible without page scrolling',async({page},info)=>{
  test.setTimeout(240_000);
  await page.goto('/?demo=yellowknife');
  await expect(page.locator('.terrain-workspace canvas')).toBeVisible();
  for(const [width,height] of [[1280,720],[1366,768],[1440,900],[800,700]]) {
    await page.setViewportSize({width,height});
    await tool(page,'Map').click();
    await visibleWithinViewport(page,'.tablet-header button,.tablet-tabs button,.tablet-footer button,.terrain-workspace canvas,.terrain-workspace .map-tools');
    await page.screenshot({timeout:60_000,path:info.outputPath(`tablet-map-${width}.png`)});
    await tool(page,'Routes').click();
    await visibleWithinViewport(page,'.tablet-footer button,.terrain-workspace canvas');
    await page.screenshot({timeout:60_000,path:info.outputPath(`tablet-routes-${width}.png`)});
    await page.getByRole('button',{name:'Close tablet',exact:false}).first().click();
    await expect(page.locator('.walk-instructions')).toBeVisible({timeout:90_000});
    await visibleWithinViewport(page,'.hud-actions button,.hud-bottom');
    await page.screenshot({timeout:60_000,path:info.outputPath(`hud-${width}.png`)});
    await nav(page).getByRole('button',{name:'Station',exact:true}).click();
    await expect(page.getByRole('button',{name:'Enter surface',exact:true})).toBeVisible();
    await visibleWithinViewport(page,'.surface-entry button');
    const card=(await page.locator('.map-region-context').boundingBox())!,sidebar=(await page.locator('.explorer .sidebar').boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(sidebar.x+sidebar.width);
    const globe=(await page.locator('.globe canvas').boundingBox())!;expect(globe.x).toBeGreaterThanOrEqual(sidebar.x+sidebar.width);
    await page.screenshot({timeout:60_000,path:info.outputPath(`station-${width}.png`)});
    await page.getByRole('button',{name:'Open tablet',exact:true}).last().click();
  }
});

test('keyboard help, modal focus, unsupported terrain and loading errors are explicit',async({page})=>{
  await page.goto('/?demo=yellowknife');
  const help=page.getByRole('button',{name:'Using the astronaut tablet'});
  await help.focus();await expect(page.getByRole('tooltip')).toBeVisible();
  await help.click();await expect(help).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(tablet(page)).toBeVisible();
  await expect(help).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Close tablet',exact:false}).first().focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await page.keyboard.press('Escape');await expect(tablet(page)).toBeHidden();
  await nav(page).getByRole('button',{name:'Station',exact:true}).click();
  await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Jezero/}).click();
  await expect(nav(page).getByRole('button',{name:'HUD · Surface'})).toBeDisabled();
  await nav(page).getByRole('button',{name:'Tablet',exact:true}).click();
  await expect(tablet(page)).toContainText('Orbital exploration only');
  await page.getByRole('button',{name:'Back to Station',exact:false}).click();
  await page.route('**/gale/manifest.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Gale · Bradbury/}).click();
  await expect(page.getByRole('button',{name:'Retry local data'})).toBeVisible();
  await page.unroute('**/gale/manifest.json');await page.getByRole('button',{name:'Retry local data'}).click();
  await expect(page.getByRole('button',{name:'Enter surface',exact:true})).toBeEnabled();
});
