import { observePlanner, plannerReply } from './planner-helpers';
import { uiRoutes, uiDisplay, uiClose, uiStation, uiAssumptions } from './ui-helpers';
import { test, expect } from '@playwright/test';

test.afterEach(async({page},info)=>{
  if(info.status===info.expectedStatus)return;
  const state=await page.evaluate(()=>({pointerLocked:!!document.pointerLockElement,focused:document.hasFocus(),activeElement:document.activeElement?.tagName,elapsed:document.querySelector('[data-testid="elapsed"]')?.textContent,instructions:document.querySelectorAll('.walk-instructions').length,missionAudit:(window as any).missionAudit,inputAudit:(window as any).inputAudit})).catch(()=>({pageClosed:true}));
  await info.attach('clock-input-state',{body:JSON.stringify(state,null,2),contentType:'application/json'});
});

test('historical replay, environmental departure decisions, visor and graphics preserve mission',async({page},info)=>{
  // This exercises several renderer rebuilds and screenshots on software WebGL.
  // Frame-rate acceptance is separate; retain the physical-clock assertions below.
  test.setTimeout(240_000);
  await observePlanner(page);
  await page.addInitScript(()=>{
    const events:unknown[]=[];(window as any).inputAudit=events;
    for(const name of ['keydown','pointerlockchange','blur','focus'])window.addEventListener(name,event=>{events.push({event:name,code:(event as KeyboardEvent).code,at:performance.now(),locked:!!document.pointerLockElement});if(events.length>30)events.shift();},true);
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader/i.test(m.text()))errors.push(m.text());});
  await page.goto('/');
  await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Gale · Bradbury/}).click();
  await page.getByRole('button',{name:'Data & history',exact:true}).click();
  await expect(page.getByLabel('Historical timeline')).toBeVisible();
  await page.getByRole('button',{name:'Play timelapse',exact:true}).click();
  await expect(page.getByTestId('scenario-time')).not.toHaveText('12:00 LMST');
  await page.getByRole('button',{name:'Pause timelapse',exact:true}).click();
  const paused=await page.getByTestId('scenario-time').textContent();
  await page.waitForTimeout(650);await expect(page.getByTestId('scenario-time')).toHaveText(paused!);
  await page.getByLabel('Historical timeline').fill('23.8');
  await page.getByRole('button',{name:'Play timelapse',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play timelapse',exact:true})).toBeVisible();
  await expect(page.getByTestId('scenario-time')).toHaveText('23:59 LMST');
  await page.getByLabel('Historical timeline').fill('3');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:/Tablet/}).click();
  await uiAssumptions(page);await page.getByText('Departure conditions and limits',{exact:true}).click();
  await page.getByLabel('Minimum temperature',{exact:true}).fill('240');
  await page.getByLabel('Destination stop',{exact:true}).fill('10');
  await uiRoutes(page);await page.getByRole('button',{name:'Plan route',exact:true}).click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await expect(page.locator('.route-card').first()).toContainText('Limits exceeded');
  await page.getByText('Compare departure hours',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Depart 12:00: within',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Depart 3:00: exceeds',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Depart 12:00: within',exact:true}).click();
  await expect(page.locator('.route-card')).toHaveCount(0);
  await uiRoutes(page);await page.getByRole('button',{name:'Plan route',exact:true}).click();
  await expect(page.locator('.route-card').first()).toContainText('Within configured limits');
  await expect(page.locator('.image-warning')).toHaveCount(0);
  await uiStation(page);
  await page.locator('.scenario-timeline').screenshot({path:info.outputPath('v04-timeline.png')});
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:/Tablet/}).click();
  await page.evaluate(()=>{document.querySelector('.mission-sidebar')!.scrollTop=0;document.querySelector('.terrain-workspace')!.scrollTop=0;});
  await page.screenshot({timeout:60_000,path:info.outputPath('v02-planner.png'),fullPage:true});
  // Choosing another time invalidates the planned excursion, including the HUD entry.
  await uiStation(page);
  await page.getByLabel('Historical timeline').fill('12.99');
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:/Tablet/}).click();
  await expect(page.locator('.route-card')).toHaveCount(0);
  await uiRoutes(page);await page.getByRole('button',{name:'Plan route',exact:true}).click();
  await page.getByRole('button',{name:'Walk selected route →'}).click();
  await expect(page.getByLabel('Visor navigation overlay')).toBeVisible();
  const canvas=page.locator('.walking-scene canvas');await expect(canvas).toBeVisible();
  await page.waitForTimeout(1200);
  const pose=await page.getByTestId('position').textContent();
  const setup=async()=>{await uiDisplay(page);};
  const resume=async()=>{await uiClose(page);await expect(canvas).toBeVisible();};
  const width=await canvas.evaluate((c:HTMLCanvasElement)=>c.width);
  await setup();await page.getByLabel('Graphics quality',{exact:true}).selectOption('low');await resume();
  await expect.poll(()=>canvas.evaluate((c:HTMLCanvasElement)=>c.width)).toBeLessThan(width);
  await expect(page.getByTestId('position')).toHaveText(pose!);
  await setup();await page.getByLabel('Visor overlay',{exact:true}).uncheck();await resume();
  await expect(page.getByLabel('Visor navigation overlay')).toHaveCount(0);
  await setup();await page.getByLabel('Visor overlay',{exact:true}).check();await page.getByLabel('Graphics quality',{exact:true}).selectOption('high');await resume();
  await expect.poll(()=>canvas.evaluate((c:HTMLCanvasElement)=>c.width)).toBe(width);
  await setup();await page.getByLabel('Graphics quality',{exact:true}).selectOption('low');await page.getByLabel('Simulation pace',{exact:true}).selectOption('20');await resume();
  const departure=await page.getByTestId('hud-lmst').textContent();
  await page.evaluate(()=>{const audit={start:0,end:0};(window as any).missionAudit=audit;document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement)audit.start=performance.now();else audit.end=performance.now();});});
  // The worker must refresh even while the astronaut is stationary.
  await canvas.click({position:{x:450,y:350}});
  await expect(page.locator('.walk-instructions')).toHaveCount(0);
  // Mission time evolves even when stationary, and triggers return refresh after 60 simulated seconds.
  await expect.poll(async()=>parseFloat((await page.getByTestId('elapsed').textContent())!),{timeout:60000}).toBeGreaterThanOrEqual(60);
  await expect(page.getByTestId('hud-lmst')).not.toHaveText(departure!);
  await plannerReply(page,'return',0,60);
  await page.screenshot({timeout:60_000,path:info.outputPath('v02-visor-active.png')});
  await page.keyboard.press('Escape');
  await expect(page.locator('.walk-instructions')).toBeVisible({timeout:15000});
  const elapsed=await page.getByTestId('elapsed').textContent();
  const audit=await page.evaluate(()=>(window as any).missionAudit as {start:number;end:number});
  const expectedSeconds=(audit.end-audit.start)/1000*20;
  expect(audit.start).toBeGreaterThan(0);expect(audit.end).toBeGreaterThan(audit.start);
  // Allow a rendered-frame delay at unlock; slow drawing must not discard most elapsed time.
  expect(parseFloat(elapsed!)).toBeGreaterThan(expectedSeconds*.5);
  expect(parseFloat(elapsed!)).toBeLessThan(expectedSeconds*1.2+2);
  await page.waitForTimeout(500);await expect(page.getByTestId('elapsed')).toHaveText(elapsed!);
  await expect(page.getByTestId('position')).toHaveText(pose!);
  await setup();await page.getByLabel('Graphics quality',{exact:true}).selectOption('medium');await resume();
  await page.screenshot({timeout:60_000,path:info.outputPath('v02-visor.png')});
  await page.setViewportSize({width:800,height:700});
  await expect(page.locator('.visor-waypoint')).not.toBeVisible();
  const compass=(await page.locator('.visor-compass').boundingBox())!, minimap=(await page.locator('.hud-map').boundingBox())!;
  expect(compass.y+compass.height).toBeLessThan(minimap.y+minimap.height+100);
  await page.screenshot({timeout:60_000,path:info.outputPath('v02-visor-mobile.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
