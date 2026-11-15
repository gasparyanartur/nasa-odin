import {test,expect} from '@playwright/test';

test('Tablet maps fit the available display without changing full-area coverage',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?demo=yellowknife');
  await expect(page.getByRole('button',{name:'Compare routes',exact:true})).toBeEnabled();
  for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:800,height:700},{width:800,height:700}]){
    await page.setViewportSize(viewport);
    for(const [tab,label] of [['Map','Gale terrain selection map'],['Field data','Field observation map']]){
      await page.getByRole('button',{name:tab,exact:true}).click();const map=page.getByRole('img',{name:label,exact:true});
      await expect(map).toHaveAttribute('data-zoom','1.00');
      await expect.poll(async()=>map.evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement!,pane=parent.parentElement!;return Math.abs(r.width-r.height)<1&&r.width<=parent.clientWidth&&r.height<innerHeight-160&&(!['auto','scroll'].includes(getComputedStyle(pane).overflowY)||parent.getBoundingClientRect().bottom<=innerHeight+1);})).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({timeout:60_000,path:info.outputPath(`tablet-map-${viewport.width}-${tab.replace(' ','-')}.png`)});
    }
  }
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Field data',exact:true}).click();
  await page.getByRole('button',{name:'New record',exact:true}).click();await page.getByLabel('Field record type',{exact:true}).selectOption('obstacle');await page.getByLabel('Field record title',{exact:true}).fill('Map fit restriction');await page.getByLabel('Restrict travel',{exact:true}).check();await page.getByRole('button',{name:'Save field record',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Travel restrictions changed'})).toBeVisible();
  await expect.poll(()=>page.getByRole('img',{name:'Field observation map',exact:true}).evaluate(el=>el.parentElement!.getBoundingClientRect().bottom<=innerHeight+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Tablet map supports keyboard selection, mouse wheel zoom, drag and click placement',async({page})=>{
  await page.goto('/?demo=yellowknife');const map=page.getByRole('img',{name:'Gale terrain selection map',exact:true});
  await expect(page.getByRole('button',{name:'Compare routes',exact:true})).toBeEnabled();
  await map.focus();await page.keyboard.press('+');await expect(map).toHaveAttribute('data-zoom','1.50');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
  const goal=page.locator('.endpoint').nth(1);await goal.getByRole('button',{name:'Place',exact:true}).click();await map.focus();await page.keyboard.press('Enter');
  await expect(goal).toContainText('135 E · -135 N');
  await map.focus();await page.keyboard.press('Home');await expect(map).toHaveAttribute('data-zoom','1.00');
  await map.hover();await page.mouse.wheel(0,-Math.log(2)/.002);await expect(map).toHaveAttribute('data-zoom','2.00');
  await goal.getByRole('button',{name:'Place',exact:true}).click();const box=(await map.boundingBox())!;
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:5});await page.mouse.up();
  await expect(goal).toContainText('135 E · -135 N');
  await map.click({position:{x:box.width*.5,y:box.height*.5}});await expect(goal).toContainText('-100 E · 0 N');
  await page.getByRole('button',{name:'Full area',exact:true}).click();await expect(map).toHaveAttribute('data-zoom','1.00');
  await map.focus();await page.keyboard.press('+');await page.keyboard.press('-');await expect(map).toHaveAttribute('data-zoom','1.00');
});
