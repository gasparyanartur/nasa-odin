// Production-build acceptance server: files only, no API or SPA catch-all.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(process.env.STATIC_DIR??'dist'),portIndex=process.argv.indexOf('--port');
const port=Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT??8273);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.xml':'application/xml','.txt':'text/plain'};
createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const file=path===root?resolve(root,'index.html'):path,info=await stat(file);
    if(!info.isFile())throw new Error('not a file');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,process.env.STATIC_HOST??'127.0.0.1',()=>console.log(`Static build: http://127.0.0.1:${port}`));
