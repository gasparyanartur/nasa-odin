import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if(!existsSync('public/gale/manifest.json')){console.error('Prepared Gale assets are missing. Run npm run prepare:data.');process.exit(1);}
const preview=process.argv.includes('--preview');
const webPort=process.env.WEB_PORT??(preview?'4173':'5173');
const children=[
  spawn(process.execPath,['node_modules/vite/bin/vite.js',...(preview?['preview']:[]),'--host','127.0.0.1','--port',webPort,'--strictPort'],{stdio:'inherit'}),
];
let closing=false;
function stop(code=0){if(closing)return;closing=true;children.forEach(c=>c.kill('SIGTERM'));setTimeout(()=>process.exit(code),500).unref();}
children.forEach(c=>{c.on('error',e=>{console.error(e.message);stop(1);});c.on('exit',code=>{if(!closing)stop(code??1);});});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
