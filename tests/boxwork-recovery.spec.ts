import {test,expect} from '@playwright/test';
test('missing detail and WebGL context loss preserve the Boxwork mission and recover on the Tablet',async({page})=>{
  test.setTimeout(180_000);
  await page.route('**/boxwork/detail/dem_core.bin',r=>r.abort());
  await page.goto('/?demo=boxwork');
  await page.getByRole('button',{name:'Compare current excursion →',exact:true}).click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  const route=await page.locator('.route-card.selected').textContent();
  await page.getByRole('button',{name:'Walk selected route →'}).click();
  await expect(page.getByRole('alert')).toContainText('Your mission remains available on the Tablet.');
  await page.getByRole('button',{name:'Open Tablet · keep mission'}).click();
  await expect(page.locator('.route-card.selected')).toHaveText(route!);
  await page.unroute('**/boxwork/detail/dem_core.bin');
  await page.getByRole('button',{name:'Walk selected route →'}).click();
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:60000});
  await page.locator('.walking-scene canvas').evaluate(el=>(el as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByRole('alert')).toContainText('The 3D display was interrupted');
  await page.getByRole('button',{name:'Open Tablet · keep mission'}).click();
  await expect(page.locator('.route-card.selected')).toHaveText(route!);
  await page.getByRole('button',{name:'Walk selected route →'}).click();
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:60000});
  await expect(page.getByTestId('elapsed')).toHaveText('0.0 s');
});

test('full Boxwork detail and responsive HUD use the same real dataset',async({page},info)=>{
  test.setTimeout(180_000);
  const tiles=new Set<string>(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.ok()&&/colour_core_\d_\d\.webp/.test(r.url()))tiles.add(r.url());});
  await page.goto('/?demo=boxwork');
  await page.getByRole('button',{name:'HUD setup',exact:true}).click();
  await page.getByLabel('Graphics quality',{exact:true}).selectOption('high');
  await page.getByRole('button',{name:'Explore local map →'}).click();
  await page.getByRole('button',{name:'Compare current excursion →',exact:true}).click();
  await page.getByRole('button',{name:'Walk selected route →'}).click();
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:60000});
  await expect(page.locator('.surface-status')).toHaveCount(0,{timeout:60000});
  expect(tiles.size).toBe(4);
  await page.screenshot({path:info.outputPath('boxwork-high-desktop.png'),timeout:60000});
  await page.getByRole('button',{name:'HUD setup',exact:true}).click();
  await page.getByLabel('Graphics quality',{exact:true}).selectOption('medium');
  await page.getByRole('button',{name:'Resume surface HUD →'}).click();
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:60000});
  for(const [width,height,name] of [[1024,900,'tablet'],[390,844,'phone']] as const){
    await page.setViewportSize({width,height});
    await expect(page.getByTestId('hud-lmst')).toHaveText('12:00 LMST');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`boxwork-${name}.png`),timeout:60000});
  }
  expect(errors).toEqual([]);
});
