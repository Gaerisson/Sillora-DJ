import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const audit=JSON.parse(await fs.readFile(path.join(root,'design/refonte/audit-data.json'),'utf8'));
const allowed=new Set(['design/refonte/index.html','design/refonte/proposal.css','design/refonte/proposal.js','design/refonte/audit-data.js','design/refonte/audit-data.json','public/assets/sillora-mark.svg','public/icon.svg','docs/AUDIT-REFONTE.md','docs/REFONTE-UI.md','PROGRESS.md',...audit.requirements.flatMap(item=>item.evidence.map(e=>e.file))]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
let port;
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)||req.headers.host!=='127.0.0.1:'+port){res.writeHead(403).end();return;}
  let relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1:'+port).pathname).replace(/^\//,'');if(!relative)relative='design/refonte/index.html';
  if(!allowed.has(relative)){res.writeHead(404).end();return;}
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'"});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
console.log('Sillora DJ — proposition UI : http://127.0.0.1:'+port+'/design/refonte/index.html');
