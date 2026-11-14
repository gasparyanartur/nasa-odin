import {chromium} from '@playwright/test';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const baseURL=process.env.DEMO_URL??'http://127.0.0.1:8373';
let healthy=false;
for(let attempt=0;attempt<100;attempt++){try{healthy=(await fetch(new URL('/api/health',baseURL),{signal:AbortSignal.timeout(1000)})).ok;}catch{/* container may still be starting */}if(healthy)break;await new Promise(resolve=>setTimeout(resolve,300));}
if(!healthy)throw new Error('Production server is not healthy. Start the container or set DEMO_URL.');
await mkdir('tmp/demo-video',{recursive:true});await mkdir('docs/evidence',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true,recordVideo:{dir:'tmp/demo-video',size:{width:1440,height:1000}}});
const began=Date.now(),page=await context.newPage(),segments=[];
const nav=()=>page.getByRole('navigation',{name:'Main navigation'});
async function caption(text){await page.evaluate(text=>{let el=document.querySelector('#demo-caption');if(!el){el=document.createElement('div');el.id='demo-caption';el.style.cssText='position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:100;background:#101c16f5;color:#ffe4bb;padding:12px 22px;border:1px solid #d1b47f;border-radius:6px;font:15px sans-serif;text-align:center;pointer-events:none;max-width:90vw;width:max-content';document.body.append(el);}el.textContent=text;el.style.display='block';},text);}
async function clip(title,action){await caption(title);const start=(Date.now()-began)/1000;if(action)await action();const remaining=4000-(Date.now()-began-start*1000);if(remaining>0)await page.waitForTimeout(remaining);segments.push({title,start,end:(Date.now()-began)/1000});await page.locator('#demo-caption').evaluate(el=>{el.style.display='none';});const names=['explore-regions','gale-region','gale-layers','ctx-gale-layers','integrated-planner','integrated-hud','jezero-region'];await page.screenshot({path:`docs/evidence/${names[segments.length-1]}.png`});}
async function active(){await page.getByRole('status',{name:'Layer status'}).filter({hasText:/Layer active|Needs attention/}).waitFor({timeout:60000});}
try{
  await page.goto(baseURL);await active();
  await clip('Martian Map · Discover regions, inspect real data, plan a Marswalk.');
  await clip('Choose Gale–Bradbury on the globe. Its outline shows prepared planning coverage.',async()=>{await page.getByRole('button',{name:'Explore Gale · Bradbury on map',exact:true}).click();});
  await page.locator('.map-region-context .primary').waitFor();
  await page.getByLabel('Explore Slope',{exact:true}).check();await page.getByLabel('Explore Slope opacity',{exact:true}).fill('50');
  await clip('Inspect real USGS imagery and terrain-derived slope. Historical REMS/RAD stay site context.');
  await page.getByLabel('Global basemap').selectOption('ctx-global-imagery');await active();
  await clip('Select MRO/CTX imagery; source tile gaps are reported while local overlays remain available.');
  await page.locator('.map-region-context .primary').click();await page.getByRole('button',{name:'Compare routes →'}).click();await page.locator('.route-card').last().waitFor({timeout:60000});
  await page.locator('.route-card').last().click();
  await clip('Compare shortest and gentler routes, including return time and explicit assumptions.');
  await page.getByRole('button',{name:'Walk selected route →'}).click();await page.locator('.walking-scene canvas').waitFor();await page.getByRole('button',{name:'HUD setup',exact:true}).click();await page.getByLabel('Simulation pace').selectOption('20');await page.getByRole('button',{name:'Resume surface HUD →'}).click();await page.waitForTimeout(1500);
  await clip('Walk the measured terrain with a minimap, waypoints, and return estimate · 20× demo pace.',async()=>{await page.locator('.walking-scene canvas').click({position:{x:450,y:350}});await page.locator('.walk-instructions').waitFor({state:'hidden'});const before=await page.getByTestId('position').textContent();await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await page.keyboard.press('Escape');if((await page.getByTestId('position').textContent())===before)throw new Error('Recording did not capture actual walking movement.');});
  await nav().getByRole('button',{name:/Station/}).click();await page.getByRole('region',{name:'Regions'}).getByRole('button',{name:/Jezero/}).click();await page.waitForTimeout(1800);await active();
  await clip('Explore Jezero too. Planning is enabled only where numeric terrain is prepared.');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/evidence/integrated-mobile.png',fullPage:true});
  const video=page.video();await context.close();const raw=await video.path();await rename(raw,'tmp/demo-video/walkthrough-raw.webm');
  await writeFile('tmp/demo-video/segments.json',JSON.stringify({baseURL,segments},null,2)+'\n');
  const filters=segments.map((s,i)=>`[0:v]trim=start=${s.start.toFixed(3)}:end=${(s.start+4).toFixed(3)},setpts=PTS-STARTPTS[v${i}]`).join(';')+';'+segments.map((_,i)=>`[v${i}]`).join('')+`concat=n=${segments.length}:v=1:a=0,fps=24,format=yuv420p[out]`;
  const ffmpeg=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','tmp/demo-video/walkthrough-raw.webm','-filter_complex',filters,'-map','[out]','-c:v','libx264','-crf','23','-movflags','+faststart','docs/evidence/demo-walkthrough.mp4'],{stdio:'inherit'});
  if(ffmpeg.status!==0)throw new Error('Video captured under tmp/demo-video; install ffmpeg to create the 28-second MP4.');
  console.log('Saved docs/evidence/demo-walkthrough.mp4 (seven 4-second chapters).');
}finally{await browser.close();}
