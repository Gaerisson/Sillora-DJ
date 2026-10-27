const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

const validPort=port=>Number.isInteger(port)&&port>0&&port<=65535;
async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}
function originPort(origin){
 try{
  if(typeof origin!=='string')return null;const url=new URL(origin);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  const port=Number(url.port||80);return validPort(port)?port:null;
 }catch{return null;}
}
async function rememberPort(profile,port){
 await fs.mkdir(profile,{recursive:true});const file=path.join(profile,'studio-port.json'),temporary=path.join(profile,'.studio-port-'+randomUUID()+'.tmp');
 try{await fs.writeFile(temporary,JSON.stringify({port})+'\n',{flag:'wx'});await fs.rename(temporary,file);}
 finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
}

async function openStudioHost({profile,version,createStudioServer,fetcher=fetch,candidates}={}){
 const preferred=(await readJson(path.join(profile,'studio-port.json')))?.port;
 const legacy=originPort((await readJson(path.join(profile,'desktop-status.json')))?.origin);
 const defaults=Array.from({length:11},(_,index)=>43821+index);
 const ports=[...new Set([preferred,legacy,...(candidates||defaults)].filter(validPort)),0];
 for(const port of ports){
  const origin='http://127.0.0.1:'+port;
  if(port){
   let matching=false;
   try{
    const response=await fetcher(origin+'/api/health',{signal:AbortSignal.timeout(200),redirect:'error'}),health=await response.json();
    matching=response.ok===true&&health.application==='sillage-studio'&&health.localOnly===true&&health.version===version;
   }catch{/* A missing or foreign service cannot be reused. */}
   if(matching){await rememberPort(profile,port);return {origin,server:null};}
  }
  let server;
  try{server=await createStudioServer({port});}
  catch(error){if(error.code==='EADDRINUSE')continue;throw error;}
  const actualPort=originPort(server.origin);
  try{
   if(actualPort===null)throw new Error('Adresse du studio local invalide.');
   await rememberPort(profile,actualPort);return {origin:server.origin,server};
  }catch(error){await server.close?.();throw error;}
 }
 throw new Error('Aucun port local disponible pour Sillage Studio.');
}

module.exports={openStudioHost};
