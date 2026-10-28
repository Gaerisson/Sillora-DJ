import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const publicRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export async function createStudioServer({port=43821}={}){
 let origin;
 const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!==new URL(origin).host)return send(res,403,{error:'Hôte refusé.'});
   if(req.headers.origin&&req.headers.origin!==origin)return send(res,403,{error:'Origine refusée.'});
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
   const url=new URL(req.url,origin);
   if(url.pathname==='/api/health')return send(res,200,{application:'sillage-studio',version:'0.19.0',localOnly:true,pid:process.pid});
   if(url.pathname.startsWith('/api/')||url.pathname==='/callback')return send(res,404,{error:'Fonction indisponible.'});
   if(req.method!=='GET')return send(res,405,{error:'Méthode refusée.'});
   const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(publicRoot,'.'+relative);
   if(!file.startsWith(publicRoot+path.sep))return send(res,403,{error:'Chemin refusé.'});
   return send(res,200,await readFile(file),mime[path.extname(file)]||'application/octet-stream');
  }catch(error){send(res,error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Fichier introuvable.':'Lecture du studio impossible.'});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,close:()=>{server.closeAllConnections();server.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=await createStudioServer({port:Number(process.env.PORT||43821)});console.log(`Sillora DJ : ${server.origin}`);}
