const https=require('node:https');const dns=require('node:dns/promises');const net=require('node:net');
function publicAddress(address){
 if(net.isIP(address)===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113||a>=224);}
 if(net.isIP(address)===6){const ip=address.toLowerCase();return /^[23][0-9a-f]{0,3}:/.test(ip)&&!(/^2001:(?:0:|2:|db8(?::|$)|1[0-9a-f]:|2[0-9a-f]:)|^2002:|^3fff:/.test(ip));}return false;
}
function publicURL(value){
 let url;try{url=new URL(value);}catch{throw new Error('Adresse de source invalide.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||net.isIP(url.hostname.replace(/^\[|\]$/g,''))||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||value.length>4096)throw new Error('La source doit utiliser une adresse HTTPS publique.');return url;
}
class PublicHttps{
 constructor({lookup=host=>dns.lookup(host,{all:true}),request=https.request}={}){Object.assign(this,{lookup,request});}
 async read(value,{maxBytes=2*1024*1024,timeout=15000,redirects=3}={}){
  const deadline=Date.now()+timeout;
  const visit=async(address,left)=>{
   const url=publicURL(address),remaining=deadline-Date.now();if(remaining<=0)throw new Error('La source met trop de temps à répondre.');
   let timer;const records=await Promise.race([this.lookup(url.hostname),new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('La résolution réseau a expiré.')),Math.min(4000,remaining));})]).finally(()=>clearTimeout(timer));
   if(!Array.isArray(records)||!records.length||records.some(record=>!publicAddress(record.address)))throw new Error('Adresse réseau privée ou invalide refusée.');
   const selected=records.find(record=>record.family===4)||records[0],wait=deadline-Date.now();if(wait<=0)throw new Error('La source met trop de temps à répondre.');
   const response=await new Promise((resolve,reject)=>{
    let size=0,settled=false,bodyTimer;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(bodyTimer);error?reject(error):resolve(result);};
    const request=this.request(url,{method:'GET',agent:false,headers:{'User-Agent':'SillageStudio/0.13 (local audio player)','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>options?.all?callback(null,[selected]):callback(null,selected.address,selected.family),rejectUnauthorized:true},res=>{
     if([301,302,303,307,308].includes(res.statusCode)){res.resume();return finish(null,{redirect:true,location:res.headers.location});}
     if(res.statusCode!==200){res.resume();return finish(new Error('Source indisponible (HTTP '+res.statusCode+').'));}
     if(Number(res.headers['content-length'])>maxBytes){res.destroy();return finish(new Error('Ce fichier dépasse la taille autorisée.'));}
     const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();finish(new Error('Ce fichier dépasse la taille autorisée.'));}else chunks.push(chunk);});
     res.on('error',()=>finish(new Error('Le téléchargement a été interrompu.')));res.on('end',()=>finish(null,{buffer:Buffer.concat(chunks),type:String(res.headers['content-type']||'').split(';')[0].toLowerCase(),url:url.href}));
    });
    request.on('error',()=>finish(new Error('Connexion HTTPS à la source impossible.')));bodyTimer=setTimeout(()=>{request.destroy();finish(new Error('Le téléchargement a expiré.'));},wait);request.end();
   });
   if(response.redirect){if(left<=0||typeof response.location!=='string')throw new Error('Trop de redirections depuis cette source.');return visit(new URL(response.location,url).href,left-1);}return response;
  };return visit(value,redirects);
 }
 async json(url,options={}){const result=await this.read(url,options);if(!['application/json','text/json','text/plain','text/javascript',''].includes(result.type))throw new Error('La source n’a pas renvoyé de données valides.');try{return JSON.parse(result.buffer.toString('utf8'));}catch{throw new Error('Réponse de source invalide.');}}
}
module.exports={PublicHttps,publicURL,publicAddress};
