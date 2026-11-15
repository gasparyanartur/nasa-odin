import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { venvPython } from './python.mjs';

// Defaults differ from the root app (5173, 4173, 8100) so both apps can run at the same time.
const python=venvPython();
if(!python){console.error('Create .venv here or in the repository root and install requirements.txt first; see README.');process.exit(1);}
if(!existsSync('public/gale/manifest.json')){console.error('Prepared Gale assets are missing. Run npm run prepare:data.');process.exit(1);}
const vite=['node_modules/vite/bin/vite.js','../node_modules/vite/bin/vite.js'].find(existsSync);
if(!vite){console.error('Vite is missing. Run npm ci in the repository root (or in this folder) first.');process.exit(1);}
const preview=process.argv.includes('--preview');
const apiPort=process.env.API_PORT??'8101',webPort=process.env.WEB_PORT??(preview?'4174':'5174');
const children=[
  spawn(python,['-m','uvicorn','server.app:app','--host','127.0.0.1','--port',apiPort],{stdio:'inherit'}),
  spawn(process.execPath,[vite,...(preview?['preview']:[]),'--host','127.0.0.1','--port',webPort,'--strictPort'],{stdio:'inherit',env:{...process.env,API_PORT:apiPort}}),
];
let closing=false;
function stop(code=0){if(closing)return;closing=true;children.forEach(c=>c.kill('SIGTERM'));setTimeout(()=>process.exit(code),500).unref();}
children.forEach(c=>{c.on('error',e=>{console.error(e.message);stop(1);});c.on('exit',code=>{if(!closing)stop(code??1);});});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
