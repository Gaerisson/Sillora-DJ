const {RemoteEvents}=require('./remote-events.cjs');
const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {randomBytes,randomUUID,timingSafeEqual}=require('node:crypto');
const {sanitizeState,sanitizeCommand,sanitizeResult,text}=require('./remote-protocol.cjs');
const failure=(code,message)=>Object.assign(new Error(message),{code});
function privateIPv4(address){if(typeof address!=='string')return false;const ip=address.replace(/^::ffff:/,'').split('.').map(Number);return ip.length===4&&ip.every(part=>Number.isInteger(part)&&part>=0&&part<=255)&&(ip[0]===127||ip[0]===10||ip[0]===192&&ip[1]===168||ip[0]===172&&ip[1]>=16&&ip[1]<=31||ip[0]===169&&ip[1]===254);}
class RemoteHost{
 constructor({publicDir,dispatch,now=Date.now,interfaces=os.networkInterfaces,staleAfter=2500,commandTimeout=4000}={}){Object.assign(this,{publicDir,dispatch,now,interfaces,staleAfter,commandTimeout});this.events=new RemoteEvents();this.artwork=new Map();this.pending=new Map();this.revisions=new Map();this.revision=0;this.server=null;this.secret=null;this.snapshot=null;this.knownTracks=new Set();this.updatedAt=0;this.lastSeen=0;this.starting=null;}
 publish(value){this.snapshot=sanitizeState(value);for(const item of [...this.snapshot.library,...this.snapshot.recommendations])this.knownTracks.add(item.id);this.updatedAt=this.now();this.revisions.set(++this.revision,this.updatedAt);while(this.revisions.size>40)this.revisions.delete(this.revisions.keys().next().value);this.events.publish(this.clientState());return this.revision;}
 clientState(){return {...this.snapshot,revision:this.revision,updatedAt:this.updatedAt,serverNow:this.now(),fresh:Boolean(this.snapshot)&&this.now()-this.updatedAt<=this.staleAfter};}
 storeArtwork({id,data}={}){if(typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(id)||typeof data!=='string'||data.length>300000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data))throw failure('INVALID','Pochette invalide.');const [type,payload]=data.split(';base64,');this.artwork.delete(id);this.artwork.set(id,{buffer:Buffer.from(payload,'base64'),type:type.slice(5)});while(this.artwork.size>128)this.artwork.delete(this.artwork.keys().next().value);return true;}
 storeRecording({id,bytes,mime}={}){if(typeof id!=='string'||!ArrayBuffer.isView(bytes)&&!(bytes instanceof ArrayBuffer))throw failure('INVALID','Enregistrement invalide.');const buffer=Buffer.from(bytes instanceof ArrayBuffer?bytes:bytes.buffer,bytes.byteOffset||0,bytes.byteLength);if(buffer.length>256*1024*1024||!['audio/webm','audio/ogg','audio/mp4'].some(type=>typeof mime==='string'&&mime.startsWith(type)))throw failure('INVALID','Enregistrement trop volumineux pour le Remote. Téléchargez-le sur le PC.');this.recording={id,buffer:Buffer.from(buffer),mime:mime.startsWith('audio/mp4')?'audio/mp4':mime.startsWith('audio/ogg')?'audio/ogg':'audio/webm'};return true;}
 acknowledge(message){if(!message||typeof message!=='object')return false;const {id,ok,error}=message,entry=this.pending.get(id);if(!entry)return false;this.pending.delete(id);clearTimeout(entry.timer);if(ok===true){try{const result=sanitizeResult(entry.type,message.result);if(entry.type==='query:library'&&result?.items)for(const item of result.items)this.knownTracks.add(item.id);while(this.knownTracks.size>20000)this.knownTracks.delete(this.knownTracks.values().next().value);entry.resolve({... (result===undefined?{ok:true}:{ok:true,result}),state:this.clientState()});}catch{entry.reject(failure('COMMAND','Réponse du studio invalide.'));}}else entry.reject(failure('COMMAND',text(error,180)||'La commande a échoué dans le studio.'));return true;}
 status(){return {active:Boolean(this.server),links:this.server?this.addresses.map(item=>({name:item.name,origin:'http://'+item.address+':'+this.port,url:'http://'+item.address+':'+this.port+'/#pair='+this.secret.toString('base64url')})):[],lastSeen:this.lastSeen,port:this.server?this.port:null};}
 async start(){
  if(this.server)return this.status();if(this.starting)return this.starting;
  this.starting=this.open().finally(()=>{this.starting=null;});return this.starting;
 }
 async open(){
  const addresses=[{name:'Cet ordinateur',address:'127.0.0.1'}];for(const [name,items]of Object.entries(this.interfaces()))for(const item of items||[])if((item.family==='IPv4'||item.family===4)&&!item.internal&&privateIPv4(item.address)&&!addresses.some(existing=>existing.address===item.address))addresses.push({name:text(name,60),address:item.address});
  this.addresses=addresses.slice(0,9);this.secret=randomBytes(32);const server=http.createServer((req,res)=>this.handle(req,res));server.requestTimeout=5000;server.headersTimeout=5000;server.maxConnections=32;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',resolve);});this.server=server;this.port=server.address().port;return this.status();}catch(error){this.secret.fill(0);this.secret=null;throw error;}
 }
 async stop(){
  if(this.starting)await this.starting.catch(()=>{});const server=this.server;this.server=null;this.events.close();this.secret?.fill(0);this.secret=null;this.lastSeen=0;
  for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(failure('STOPPED','La télécommande a été arrêtée.'));}this.pending.clear();
  if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});return {active:false,links:[],lastSeen:0,port:null};
 }
 authorized(req){
  if(!this.secret)return false;const header=req.headers.authorization;if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))return false;
  const supplied=Buffer.from(header.slice(7),'base64url');return supplied.length===this.secret.length&&timingSafeEqual(supplied,this.secret);
 }
 send(res,status,body,type='application/json; charset=utf-8'){if(res.destroyed)return;res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
 async body(req){let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>8192)throw failure('INVALID','Commande trop volumineuse.');}try{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}catch{throw failure('INVALID','Commande JSON invalide.');}}
 async run(command,revision){
  if(!this.snapshot||this.now()-this.updatedAt>this.staleAfter)throw failure('STALE','Le studio ne répond plus. Attendez sa reconnexion.');
  const seen=this.revisions.get(revision);if(seen===undefined||this.now()-seen>this.staleAfter)throw failure('STALE','État périmé : la commande n’a pas été envoyée.');
  const clean=sanitizeCommand(command,{...this.snapshot,knownTrackIds:this.knownTracks});if(this.pending.size>=12)throw failure('BUSY','Trop de commandes en attente.');
  const timeout=clean.type.startsWith('query:')?Math.max(this.commandTimeout,10000):this.commandTimeout,id=randomUUID(),expiresAt=this.now()+timeout;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(failure('TIMEOUT','Le studio n’a pas confirmé la commande.'));},timeout);this.pending.set(id,{resolve,reject,timer,type:clean.type});try{this.dispatch({id,expiresAt,command:clean});}catch{clearTimeout(timer);this.pending.delete(id);reject(failure('COMMAND','Le studio est indisponible.'));}});
 }
 async handle(req,res){
  try{
   const hosts=new Set(this.addresses.map(item=>item.address+':'+this.port)),host=req.headers.host;
   if(!this.server||!privateIPv4(req.socket.remoteAddress)||!hosts.has(host)||req.headers.origin&&req.headers.origin!=='http://'+host||req.headers['sec-fetch-site']==='cross-site')return this.send(res,403,{error:'Origine refusée.'});
   const url=new URL(req.url,'http://'+host);if(url.search)return this.send(res,400,{error:'Lien invalide.'});
   if(url.pathname.startsWith('/api/')){
    if(!this.authorized(req))return this.send(res,401,{error:'Appairage requis. Ouvrez le lien affiché dans Sillage.'});this.lastSeen=this.now();
    if(url.pathname==='/api/events'&&req.method==='GET'){this.lastSeen=this.now();this.events.subscribe(req,res,this.clientState());return;}
    if(url.pathname.startsWith('/api/artwork/')&&req.method==='GET'){const art=this.artwork.get(url.pathname.slice('/api/artwork/'.length));if(!art)return this.send(res,404,{error:'Pochette indisponible.'});return this.send(res,200,art.buffer,art.type);}
    if(url.pathname==='/api/recording'&&req.method==='GET'){const recording=this.recording;if(!recording||recording.id!==this.snapshot?.recording?.id)return this.send(res,404,{error:'Enregistrement indisponible. Le mix reste téléchargeable dans le studio du PC.'});const ext=recording.mime.includes('mp4')?'m4a':recording.mime.includes('ogg')?'ogg':'webm';res.setHeader('Content-Disposition','attachment; filename="Sillage-Mix.'+ext+'"');return this.send(res,200,recording.buffer,recording.mime);}
    if(url.pathname==='/api/state'&&req.method==='GET'){
     if(!this.snapshot)return this.send(res,503,{error:'Le studio prépare son état.'});return this.send(res,200,{...this.clientState(),ageMs:Math.max(0,this.now()-this.updatedAt)});
    }
    if(url.pathname==='/api/command'&&req.method==='POST'){
     if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return this.send(res,415,{error:'Format de commande invalide.'});
     const body=await this.body(req),result=await this.run(body.command,body.revision);return this.send(res,200,result);
    }
    return this.send(res,['/api/state','/api/command','/api/recording','/api/events'].includes(url.pathname)||url.pathname.startsWith('/api/artwork/')?405:404,{error:'Ressource ou méthode indisponible.'});
   }
   const files={'/grid-status.mjs':'grid-status.mjs','/keylock-settings.js':'keylock-settings.js','/keylock-settings.css':'keylock-settings.css','/keylock-profiles.mjs':'keylock-profiles.mjs',"/transition-score.mjs":"transition-score.mjs","/tempo-automation.mjs":"tempo-automation.mjs","/audio-math.mjs":"audio-math.mjs",'/audio-meter-view.js':'audio-meter-view.js','/audio-meter.css':'audio-meter.css','/audio-meters.mjs':'audio-meters.mjs','/icon.svg':'icon.svg','/':'remote.html','/remote.html':'remote.html','/remote.js':'remote.js','/remote.css':'remote.css','/remote-clock.mjs':'remote-clock.mjs','/dj-waveform.mjs':'dj-waveform.mjs','/remote-artwork.mjs':'remote-artwork.mjs','/wave-colors.mjs':'wave-colors.mjs','/wave-seek.mjs':'wave-seek.mjs','/sample-bank.css':'sample-bank.css','/live-v14.css':'live-v14.css','/live-visual.js':'live-visual.js','/live-remote.js':'live-remote.js','/live-settings.js':'live-settings.js','/live-dsp.mjs':'live-dsp.mjs','/duck-math.mjs':'duck-math.mjs','/audio-settings.css':'audio-settings.css','/program-bus.js':'program-bus.js','/program-settings.js':'program-settings.js','/program-settings.css':'program-settings.css'};
   if(req.method!=='GET'||!files[url.pathname])return this.send(res,404,{error:'Ressource indisponible.'});
   const file=files[url.pathname],type=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';return this.send(res,200,await fs.readFile(path.join(this.publicDir,file)),type);
  }catch(error){const status=error.code==='INVALID'?400:error.code==='STALE'?409:error.code==='BUSY'?429:error.code==='TIMEOUT'?504:error.code==='COMMAND'||error.code==='STOPPED'?409:500;this.send(res,status,{error:['INVALID','STALE','BUSY','TIMEOUT','COMMAND','STOPPED'].includes(error.code)?error.message:'Télécommande indisponible.'});}
 }
}
module.exports={RemoteHost,sanitizeState,sanitizeCommand,privateIPv4};
