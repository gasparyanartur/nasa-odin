import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const nav=(page:import('@playwright/test').Page)=>page.getByRole('navigation',{name:'Main navigation'});
const fields=async(page:import('@playwright/test').Page)=>{await page.getByRole('button',{name:'Field data',exact:true}).click();};
const library=(page:import('@playwright/test').Page)=>page.getByRole('region',{name:'Saved field records'});
async function create(page:import('@playwright/test').Page,title:string,kind='note',x=450,y=-10){
  await page.getByRole('button',{name:'New record',exact:true}).click();
  await page.getByLabel('Field record type',{exact:true}).selectOption(kind);
  await page.getByLabel('Field record title',{exact:true}).fill(title);
  if(!['unit','contact'].includes(kind)){await page.getByLabel('Field easting',{exact:true}).fill(String(x));await page.getByLabel('Field northing',{exact:true}).fill(String(y));}
}

test('field notes, HUD inspection, pose capture, undo, export/import and reload retain provenance',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?demo=yellowknife');
  await page.getByRole('button',{name:'Compare science routes →'}).click();await expect(page.locator('.route-card')).toHaveCount(2);
  await fields(page);await create(page,'Layered outcrop');
  await page.getByLabel('Field northing',{exact:true}).fill('');await page.getByLabel('Field northing',{exact:true}).pressSequentially('-10.5');await expect(page.getByLabel('Field northing',{exact:true})).toHaveValue('-10.5');
  await page.getByLabel('Field record description',{exact:true}).fill('Layering interpreted during simulated exploration.');
  await page.getByLabel('Field record source',{exact:true}).fill('Personal interpretation from overhead imagery');
  await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await expect(library(page).locator('article')).toHaveCount(1);
  await expect(page.getByLabel('Field record details')).toContainText('manual coordinates');
  await expect(nav(page).getByRole('button',{name:/HUD/})).toBeEnabled();
  await page.getByRole('button',{name:'Edit Layered outcrop',exact:true}).click();await page.getByLabel('Field record description').fill('Revised layering interpretation.');await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await expect(page.getByLabel('Field record details')).toContainText('Revised layering');
  await nav(page).getByRole('button',{name:/HUD/}).click();
  await expect(page.getByRole('button',{name:'Inspect field record Layered outcrop',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close field inspection',exact:true}).click();
  await page.getByRole('button',{name:'Inspect field record Layered outcrop',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'HUD field inspection'})).toContainText('Personal interpretation from overhead imagery');
  await page.screenshot({path:info.outputPath('v05-field-hud.png')});
  const pose=await page.getByTestId('position').textContent();
  await page.getByRole('button',{name:'Log here',exact:true}).click();
  await expect(page.getByLabel('Field easting')).toHaveValue('0');
  await page.getByLabel('Field record title').fill('At the astronaut');await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await expect(page.getByLabel('Field record details')).toContainText('simulated pose');
  await page.getByRole('button',{name:'Delete At the astronaut',exact:true}).click();await expect(library(page).locator('article')).toHaveCount(1);
  await page.getByRole('button',{name:'Undo last layer edit',exact:true}).click();await expect(library(page).locator('article')).toHaveCount(2);
  await nav(page).getByRole('button',{name:/HUD/}).click();await expect(page.getByTestId('position')).toHaveText(pose!);
  await page.getByRole('button',{name:'← Open tablet',exact:true}).click();await fields(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export field GeoJSON',exact:true}).click();const file=await download;const saved=info.outputPath('field-data.geojson');await file.saveAs(saved);
  const exported=JSON.parse(await readFile(saved,'utf8'));expect(exported.planet).toBe('Mars');expect(exported.features).toHaveLength(2);expect(exported.features[0].properties.source).toBe('Personal interpretation from overhead imagery');
  await page.getByRole('button',{name:'Delete At the astronaut',exact:true}).click();
  await page.getByLabel('Import field GeoJSON',{exact:true}).setInputFiles(saved);await expect(library(page).locator('article')).toHaveCount(2);
  await page.reload();await fields(page);await expect(library(page).locator('article')).toHaveCount(2);
  await expect(library(page)).toContainText('Layered outcrop');
  await nav(page).getByRole('button',{name:/Station/}).click();await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Jezero/}).click();
  await nav(page).getByRole('button',{name:/Tablet/}).click();await expect(page.getByRole('button',{name:'Field data',exact:true})).toBeDisabled();
  await nav(page).getByRole('button',{name:/Station/}).click();await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Gale · Bradbury/}).click();await nav(page).getByRole('button',{name:/Tablet/}).click();await fields(page);await expect(library(page).locator('article')).toHaveCount(2);
  await page.screenshot({path:info.outputPath('v05-field-tablet.png')});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('v05-field-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('drawn geology and point readings remain annotations; declared circles change both route candidates',async({page},info)=>{
  await page.goto('/?demo=yellowknife');
  const initial=page.waitForResponse(r=>r.url().endsWith('/api/routes')&&r.ok());await page.getByRole('button',{name:'Compare science routes →'}).click();const before=await(await initial).json();
  const points=before.routes[before.recommendedIndex].points;const middle=points[Math.floor(points.length/2)];
  await fields(page);
  for(const [kind,title,vertices] of [['unit','Interpreted unit',[[.56,.55],[.63,.55],[.63,.62]]],['contact','Interpreted contact',[[.4,.4],[.43,.42]]]] as const){
    await create(page,title,kind);await expect(page.getByRole('button',{name:'Use astronaut position',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Pick / draw on map',exact:true}).click();
    const map=page.getByRole('img',{name:'Field observation map'});await map.scrollIntoViewIfNeeded();
    for(const [x,y] of vertices){const b=(await map.boundingBox())!;await map.click({position:{x:b.width*x,y:b.height*y}});}
    await page.getByRole('button',{name:'Finish map picking',exact:true}).click();await page.getByRole('button',{name:'Save field record',exact:true}).click();await expect(library(page)).toContainText(title);
  }
  await create(page,'Point temperature','temperature',300,-20);await page.getByLabel('Field reading').fill('');await page.getByLabel('Field reading').pressSequentially('231.5');await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await expect(page.getByLabel('Field record details')).toContainText('231.5 K');await expect(page.getByLabel('Field record details')).toContainText('does not change scenario');
  await create(page,'Detector reading','radiation',310,-20);await page.getByLabel('Field reading').fill('9.25');await page.getByRole('button',{name:'Save field record',exact:true}).click();await expect(page.getByLabel('Field record details')).toContainText('9.25 µGy/h');
  await expect(nav(page).getByRole('button',{name:/HUD/})).toBeEnabled();
  await create(page,'Declared obstacle','obstacle',middle[0],middle[1]);await page.getByLabel('Field obstacle radius').fill('20');await page.getByLabel('Restrict travel',{exact:true}).check();await page.getByRole('button',{name:'Save field record',exact:true}).click();await expect(nav(page).getByRole('button',{name:/HUD/})).toBeDisabled();
  await page.getByLabel('Show Declared obstacle',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  const reroute=page.waitForResponse(r=>r.url().endsWith('/api/routes')&&r.ok());await page.getByRole('button',{name:'Compare routes →',exact:true}).click();const response=await reroute,data=await response.json();
  expect(response.request().postDataJSON().settings.exclusions).toEqual([{x:middle[0],y:middle[1],radius:20}]);
  for(const route of data.routes)for(const [x,y] of route.points)expect(Math.hypot(x-middle[0],y-middle[1])).toBeGreaterThan(20+5/Math.sqrt(2));
  await fields(page);await page.getByLabel('Show Declared obstacle',{exact:true}).check();await page.screenshot({path:info.outputPath('v05-field-geometry.png')});
  await nav(page).getByRole('button',{name:/HUD/}).click();await expect(page.getByRole('button',{name:'Inspect field record Declared obstacle',exact:true})).toBeVisible();
  const marker=page.getByRole('button',{name:'Inspect field record Declared obstacle',exact:true});const markerBox=(await marker.boundingBox())!,metrics=(await page.locator('.hud-bottom').boundingBox())!;expect(markerBox.y+markerBox.height).toBeLessThan(metrics.y);await marker.click();
  await page.screenshot({path:info.outputPath('v05-field-scene-geometry.png')});
  await page.getByRole('button',{name:'Edit on tablet →',exact:true}).click();
  await page.getByRole('button',{name:'Edit Declared obstacle',exact:true}).click();await page.getByLabel('Field easting').fill('0');await page.getByLabel('Field northing').fill('0');await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Compare routes →',exact:true}).click();await expect(page.getByRole('alert')).toContainText('blocked');
  await fields(page);await page.getByRole('button',{name:'Edit Declared obstacle',exact:true}).click();await page.getByLabel('Restrict travel',{exact:true}).uncheck();await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Compare routes →',exact:true}).click();await expect(page.locator('.route-card')).toHaveCount(2);
});

test('unread storage is preserved, imports fail atomically and quota errors retain exportable records',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('martian-map.field-data.v1','invalid saved text'));
  await page.goto('/?demo=yellowknife');await fields(page);await expect(page.getByRole('alert')).toContainText('has not been overwritten');
  await create(page,'Recovery note');await page.getByRole('button',{name:'Save field record',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('martian-map.field-data.v1'))).toBe('invalid saved text');
  await page.getByRole('button',{name:'Replace unread file with current layer',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('martian-map.field-data.v1'))).toBe('invalid saved text');
  const persisted=await page.evaluate(()=>localStorage.getItem('martian-map.field-data.v2'));expect(JSON.parse(persisted!).features).toHaveLength(1);
  await page.getByLabel('Import field GeoJSON',{exact:true}).setInputFiles({name:'earth.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'FeatureCollection',features:[]}))});await expect(page.getByRole('alert')).toContainText('not Earth');await expect(library(page).locator('article')).toHaveCount(1);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
  await create(page,'In-memory reading','temperature');await page.getByRole('button',{name:'Save field record',exact:true}).click();await expect(library(page).locator('article')).toHaveCount(2);await expect(page.getByRole('alert')).toContainText('memory only');
  expect(await page.evaluate(()=>localStorage.getItem('martian-map.field-data.v2'))).toBe(persisted);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export field GeoJSON',exact:true}).click();await downloaded;
});

test('live pose logging and constraint replanning retain mission state and use restrictions for return',async({page})=>{
  await page.goto('/?demo=yellowknife');
  await page.getByRole('button',{name:'HUD setup',exact:true}).click();
  await page.getByLabel('Graphics quality').selectOption('low');await page.getByLabel('Simulation pace').selectOption('20');
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await page.getByRole('button',{name:'Compare science routes →'}).click();await expect(page.locator('.route-card')).toHaveCount(2);
  await nav(page).getByRole('button',{name:/HUD/}).click();
  await expect(page.locator('.walking-scene canvas')).toBeVisible();await page.waitForTimeout(1000);
  await page.locator('.walking-scene canvas').click({position:{x:450,y:350}});await page.keyboard.down('w');
  await expect.poll(async()=>Number((await page.getByTestId('elapsed').textContent())!.split(' ')[0])).toBeGreaterThan(5);
  await page.keyboard.up('w');await page.keyboard.press('Escape');await expect(page.locator('.walk-instructions')).toBeVisible();
  const position=await page.getByTestId('position').textContent(),elapsed=await page.getByTestId('elapsed').textContent();
  await page.getByRole('button',{name:'Log here',exact:true}).click();await page.getByLabel('Field record title').fill('Live pose record');
  const x=Number(await page.getByLabel('Field easting').inputValue()),y=Number(await page.getByLabel('Field northing').inputValue());
  expect(position).toBe(`E ${x.toFixed(1)} / N ${y.toFixed(1)} m`);
  await expect(page.getByRole('button',{name:'New record',exact:true})).toBeDisabled();await expect(page.getByLabel('Import field GeoJSON',{exact:true})).toBeDisabled();
  await nav(page).getByRole('button',{name:/HUD/}).click();await page.getByRole('button',{name:'Log here',exact:true}).click();
  await expect(page.getByLabel('Field record title')).toHaveValue('Live pose record');await expect(page.getByRole('status').filter({hasText:'unfinished draft'})).toBeVisible();
  await page.getByRole('button',{name:'Save field record',exact:true}).click();await expect(page.getByLabel('Field record details')).toContainText(`${elapsed} elapsed`);await expect(page.getByRole('status').filter({hasText:'unfinished draft'})).toHaveCount(0);
  await create(page,'Remote restricted circle','obstacle',-400,-400);await page.getByLabel('Restrict travel',{exact:true}).check();await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Compare routes →',exact:true}).click();await expect(page.locator('.route-card')).toHaveCount(2);
  const returning=page.waitForRequest(r=>r.url().endsWith('/api/return'));
  await nav(page).getByRole('button',{name:/HUD/}).click();
  expect((await returning).postDataJSON().settings.exclusions).toEqual([{x:-400,y:-400,radius:40}]);
  await expect(page.getByTestId('position')).toHaveText(position!);await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
});
