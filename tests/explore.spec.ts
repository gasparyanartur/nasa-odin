import { test, expect } from '@playwright/test';

const nav=(page:import('@playwright/test').Page)=>page.getByRole('navigation',{name:'Main navigation'});
const card=(page:import('@playwright/test').Page,name:string)=>page.getByRole('region',{name:'Regions'}).getByRole('button',{name:new RegExp(name)});

test('discover regions, choose data, preserve layers and isolate missions',async({page},info)=>{
  const exceptions:string[]=[];page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('/');
  await expect(nav(page).getByRole('button',{name:/Tablet/})).toBeDisabled();
  const gale=page.getByRole('button',{name:'Explore Gale · Bradbury on map',exact:true});
  await expect(gale).toBeVisible();
  await expect(page.getByRole('button',{name:'Explore Jezero on map',exact:true})).toBeVisible();
  await expect(page.getByRole('status',{name:'Layer status'})).toHaveText('Layer active',{timeout:60000});
  await page.screenshot({path:info.outputPath('explore-regions.png')});
  await gale.click();
  await expect(page.getByRole('region',{name:'Selected region'})).toContainText('2 × 2 KM');
  await expect(page.locator('.map-region-context .primary')).toBeEnabled();
  await page.waitForTimeout(1500);
  await page.getByLabel('Explore Slope',{exact:true}).check();
  await page.getByLabel('Explore Slope opacity',{exact:true}).fill('40');
  await page.getByLabel('Explore Elevation',{exact:true}).check();
  await page.getByLabel('Global basemap').selectOption('ctx-global-imagery');
  await expect(page.getByRole('heading',{name:'CTX · Orbital imagery'})).toBeVisible();
  await expect(page.getByRole('status',{name:'Layer status'})).toHaveText(/Layer active|Needs attention/,{timeout:60000});
  await expect(page.getByRole('region',{name:'Selected region'})).toContainText('Gale');
  await expect(page.getByLabel('Explore Slope opacity',{exact:true})).toHaveValue('40');
  await expect(page.locator('.observation-card')).toContainText('Historical site observations');
  await page.screenshot({path:info.outputPath('gale-explore-layers.png')});
  await page.locator('.map-region-context .primary').click();
  await expect(page.getByRole('heading',{name:'Gale · Bradbury landing area',exact:true})).toBeVisible();
  await expect(page.getByLabel('Slope',{exact:true})).toBeChecked();
  await expect(page.getByLabel('Slope opacity',{exact:true})).toHaveValue('40');
  await page.getByLabel('Slope opacity',{exact:true}).fill('55');
  await page.getByRole('button',{name:'Compare routes →'}).click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await nav(page).getByRole('button',{name:/Station/}).click();
  await expect(page.getByLabel('Explore Slope opacity',{exact:true})).toHaveValue('55');
  await card(page,'Jezero').click();
  await expect(page.getByRole('region',{name:'Selected region'})).toContainText('Local numeric terrain is not prepared');
  await expect(nav(page).getByRole('button',{name:/Tablet/})).toBeEnabled();
  await expect(nav(page).getByRole('button',{name:/HUD/})).toBeDisabled();
  await expect(page.getByRole('region',{name:'Regional data'})).not.toContainText('Curiosity');
  await page.waitForTimeout(1500);await page.screenshot({path:info.outputPath('jezero-explore.png')});
  await card(page,'Gale').click();
  await expect(page.locator('.map-region-context .primary')).toBeEnabled();
  await nav(page).getByRole('button',{name:/Tablet/}).click();
  await expect(page.locator('.route-card')).toHaveCount(0);
  // A result arriving after region change must never restore the previous mission.
  await page.route('**/api/routes',async route=>{await new Promise(resolve=>setTimeout(resolve,800));try{await route.continue();}catch{/* request was cancelled */}});
  await page.getByRole('button',{name:'Compare routes →'}).click();
  await nav(page).getByRole('button',{name:/Station/}).click();await card(page,'Jezero').click();
  await page.waitForTimeout(1200);await expect(nav(page).getByRole('button',{name:/HUD/})).toBeDisabled();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('explore-mobile.png'),fullPage:true});
  expect(exceptions).toEqual([]);
});

test('regional data failure recovers without enabling another region’s planner',async({page})=>{
  await page.route('**/gale/height.f32',route=>route.abort());
  await page.goto('/');await card(page,'Gale').click();
  await expect(page.getByRole('alert')).toContainText('Local Gale data could not load');
  await expect(page.locator('.map-region-context .primary')).toBeDisabled();
  await page.unroute('**/gale/height.f32');await page.getByRole('button',{name:'Retry local data'}).click();
  await expect(page.locator('.map-region-context .primary')).toBeEnabled();
  for(let i=0;i<3;i++){await card(page,'Jezero').click();await card(page,'Gale').click();await expect(page.locator('.map-region-context .primary')).toBeEnabled();}
  await expect(page.locator('.region-marker')).toHaveCount(1);
});
