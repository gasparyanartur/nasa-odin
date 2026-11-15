import { uiRoutes, uiAssumptions } from './ui-helpers';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {FieldRecord} from '../src/field/model';

test('preset route failure gives exact slopes and reset restores the working example',async({page},info)=>{
  await page.goto('/?demo=boxwork');await uiRoutes(page);
  const compare=page.getByRole('button',{name:'Compare routes',exact:true});
  await expect(compare).toBeEnabled();
  await uiAssumptions(page);await page.getByLabel('Slope limit',{exact:true}).fill('15');
  await compare.click();
  const failure=page.getByRole('alert',{name:'Why this route is unavailable'});
  await expect(failure).toContainText('Habitat / start · Blocked');
  await expect(failure).toContainText('18.4° exceeds the 15° limit');
  await expect(failure).toContainText('Destination · Blocked');
  await failure.getByText('How terrain is checked',{exact:true}).click();
  await expect(failure).toContainText('8 by 8 sample neighborhood');
  await failure.scrollIntoViewIfNeeded();
  await page.screenshot({timeout:60_000,path:info.outputPath('blocked-preset-slopes.png')});
  await page.getByRole('button',{name:'↺ Reset example excursion',exact:true}).click();await uiRoutes(page);
  await uiAssumptions(page);await expect(page.getByLabel('Slope limit',{exact:true})).toHaveValue('20');
  await compare.click();
  await expect(page.locator('.route-card')).toHaveCount(2);
  await expect(failure).toHaveCount(0);
  // Fresh Bradbury preset must still work.
  await page.goto('/?demo=yellowknife');
  await uiRoutes(page);await page.getByRole('button',{name:'Compare routes',exact:true}).click();
  await expect(page.locator('.route-card')).toHaveCount(2);
});

test('hidden saved restriction is named, retained by reset and opens its field record',async({page},info)=>{
  const record:FieldRecord={id:'blocked-example',regionId:'gale-boxwork',kind:'obstacle',title:'Loose ridge rocks',description:'Test restriction',source:'User observation',uncertainty:'Unknown',points:[{x:195,y:315}],radiusM:40,visible:false,restrictTravel:true,createdAt:'2026-11-14T12:00:00Z',updatedAt:'2026-11-14T12:00:00Z',observedAt:'2026-11-14T12:00:00Z',context:{sol:4600,lmstHour:12,elapsedS:0,positionSource:'manual-coordinates'}};
  const meta=JSON.parse(await readFile('public/boxwork/manifest.json','utf8'));
  const coordinates=[meta.origin.longitude+195/(meta.radiusM*Math.cos(meta.origin.latitude*Math.PI/180))*180/Math.PI,meta.origin.latitude+315/meta.radiusM*180/Math.PI];
  const pack={type:'FeatureCollection',schema:'martian-map-field-data',version:2,planet:'Mars',reference:'EPSG:104905',sites:{'gale-boxwork':meta.id},features:[{type:'Feature',id:record.id,properties:record,geometry:{type:'Point',coordinates}}]};
  await page.addInitScript(pack=>localStorage.setItem('martian-map.field-data.v2',JSON.stringify(pack)),pack);
  await page.goto('/?demo=boxwork');await uiRoutes(page);
  const compare=page.getByRole('button',{name:'Compare routes',exact:true});
  await expect(compare).toBeEnabled();
  await uiAssumptions(page);await expect(page.getByLabel('Active route constraints')).toContainText('1 saved field restrictions');
  await compare.click();
  const failure=page.getByRole('alert',{name:'Why this route is unavailable'});
  await expect(failure).toContainText('Exclusion #1');
  await expect(failure).toContainText('annotation hidden; restriction active');
  await expect(failure).toContainText('Loose ridge rocks');
  await page.getByRole('button',{name:'↺ Reset example excursion',exact:true}).click();await uiRoutes(page);
  await compare.click();
  await expect(failure).toContainText('Loose ridge rocks');
  await failure.scrollIntoViewIfNeeded();
  await page.screenshot({timeout:60_000,path:info.outputPath('hidden-restriction.png')});
  await failure.getByRole('button',{name:'Loose ridge rocks',exact:true}).click();
  await expect(page.getByLabel('Field record details')).toContainText('Loose ridge rocks');
});
