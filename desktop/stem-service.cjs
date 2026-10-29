const fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {STEM_LIMITS,checkedStemOptions,stemBudget,effectiveStemThreads}=require('../public/stem-budget.mjs');
const names=['drums','bass','other','vocals'],turn=()=>new Promise(resolve=>setImmediate(resolve));
function validateWave(bytes){
 const size=bytes?.byteLength??bytes?.length;if(!Number.isInteger(size)||size<52||size>STEM_LIMITS.waveBytes)throw Error('Audio WAV float32 requis, limité à 256 Mio.');
 const b=Buffer.from(bytes instanceof ArrayBuffer?new Uint8Array(bytes):bytes);
 if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==3||b.readUInt16LE(22)!==2||b.readUInt16LE(34)!==32||b.readUInt16LE(32)!==8||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44||(b.length-44)%8)throw Error('Audio stéréo WAV float32 requis.');
 const rate=b.readUInt32LE(24);if(rate<22050||rate>96000||b.readUInt32LE(28)!==rate*8||b.readUInt32LE(4)!==b.length-8||(b.length-44)/8/rate>STEM_LIMITS.duration)throw Error('Fréquence ou durée audio invalide.');return b;
}
const cancelled=job=>{if(job.state==='cancelled')throw Object.assign(Error('Préparation annulée.'),{name:'AbortError'});};
async function hashBytes(bytes,job){const h=createHash('sha256');for(let at=0;at<bytes.length;at+=1048576){cancelled(job);h.update(bytes.subarray(at,at+1048576));if(at%16777216===0)await turn();}return h.digest('hex');}
async function fileHash(file,job){const stream=fsSync.createReadStream(file),h=createHash('sha256');try{for await(const chunk of stream){cancelled(job);h.update(chunk);}return h.digest('hex');}finally{stream.destroy();}}
async function validStemHeader(file,frames,rate,size){const handle=await fs.open(file,'r');try{const b=Buffer.alloc(Math.min(size,65536));await handle.read(b,0,b.length,0);if(b.length<44||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.readUInt32LE(4)+8!==size)return false;let format=false;for(let at=12;at+8<=b.length;){const tag=b.toString('ascii',at,at+4),length=b.readUInt32LE(at+4),begin=at+8;if(tag==='fmt '){if(length<16||begin+16>b.length)return false;format=b.readUInt16LE(begin)===3&&b.readUInt16LE(begin+2)===2&&b.readUInt32LE(begin+4)===rate&&b.readUInt16LE(begin+12)===8&&b.readUInt16LE(begin+14)===32;}if(tag==='data')return format&&length===frames*8&&begin+length<=size;at=begin+length+(length%2);}return false;}finally{await handle.close();}}
class StemService{
 constructor({cache,python,script=path.join(__dirname,'separate.py'),modelCache,bundleRoot,spawnProcess=spawn,parallelism=os.availableParallelism(),timeoutMs}={}){
  bundleRoot||=process.resourcesPath&&fsSync.existsSync(path.join(process.resourcesPath,'stems','runtime-manifest.json'))?path.join(process.resourcesPath,'stems'):path.join(__dirname,'vendor','stems');
  this.bundled=fsSync.existsSync(path.join(bundleRoot,'runtime-manifest.json'));python||=process.env.SILLAGE_STEMS_PYTHON||path.join(bundleRoot,'python','python.exe');modelCache||=process.env.SILLAGE_STEMS_MODELS||path.join(bundleRoot,'models');cache||=path.join(os.homedir(),'.gaerisson-dj-studio','stems');
  Object.assign(this,{cache,python,script,modelCache,bundleRoot,spawnProcess,parallelism,timeoutMs});this.jobs=new Map();this.active=null;
 }
 async availability(){try{await Promise.all([fs.access(this.python),fs.access(this.script),fs.access(path.join(this.modelCache,'hub','checkpoints','955717e8-8726e21a.th'))]);return {available:true,model:'htdemucs',processing:'offline',bundled:this.bundled,busy:Boolean(this.active),active:this.active?this.status(this.active.id):null,maxCpuThreads:effectiveStemThreads(4,this.parallelism),limits:STEM_LIMITS};}catch{return {available:false,busy:Boolean(this.active),active:this.active?this.status(this.active.id):null,message:'Le moteur de stems intégré, son script ou son modèle manque. Utilisez la distribution Windows complète.'};}}
 async begin(bytes,options={}){
  if(this.closed)throw Error('Le moteur est arrêté.');if(this.active)throw Error('Une préparation est déjà en cours. Attendez ou annulez-la.');
  const settings=checkedStemOptions(options),wave=validateWave(bytes),rate=wave.readUInt32LE(24),frames=(wave.length-44)/8;stemBudget({length:frames,sampleRate:rate,numberOfChannels:2},rate,settings);
  const job={id:randomUUID(),state:'queued',stage:'loading',percent:null,error:null,frames,rate,cpuThreads:effectiveStemThreads(settings.cpuThreads,this.parallelism),memoryMiB:settings.memoryMiB,timeoutMinutes:settings.timeoutMinutes};this.jobs.set(job.id,job);this.active=job;
  if(this.jobs.size>20)for(const [key,value]of this.jobs)if(value!==job&&!['running','queued'].includes(value.state)){this.jobs.delete(key);break;}
  job.task=this.run(job,wave);return this.status(job.id);
 }
 async cached(job){
  const m=JSON.parse(await fs.readFile(path.join(job.folder,'complete.json'),'utf8'));if(m.version!==2||m.model!=='htdemucs'||m.inputDigest!==job.digest||m.frames!==job.frames||m.sampleRate!==job.rate||!Array.isArray(m.sources)||m.sources.length!==4||!names.every(n=>m.sources.includes(n)))return null;
  for(const name of names){cancelled(job);if(!/^[a-f0-9]{64}$/.test(m.hashes?.[name]||''))return null;const file=path.join(job.folder,name+'.wav'),stat=await fs.stat(file);if(stat.size<44||stat.size>STEM_LIMITS.waveBytes+65536||!await validStemHeader(file,job.frames,job.rate,stat.size)||await fileHash(file,job)!==m.hashes[name])return null;}
  return m;
 }
 async run(job,wave){
  try{
   const availability=await this.availability();cancelled(job);if(!availability.available)throw Error(availability.message);
   job.digest=await hashBytes(wave,job);job.folder=path.join(this.cache,'htdemucs-v2',job.digest);job.stage='verifying';let cached;
   try{cached=await this.cached(job);}catch(error){if(error.name==='AbortError')throw error;}
   cancelled(job);if(cached){job.manifest=cached;job.cached=true;job.state='done';return;}
   await fs.mkdir(job.folder,{recursive:true});cancelled(job);const helper=path.join(this.cache,'separate-v2.py');await fs.writeFile(helper,await fs.readFile(this.script));cancelled(job);const input=path.join(job.folder,'input.wav');await fs.writeFile(input,wave);wave=null;cancelled(job);
   const cpu=String(job.cpuThreads),child=this.spawnProcess(this.python,['-u',helper,input,job.folder,cpu,job.digest],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TORCH_HOME:this.modelCache,PYTHONUTF8:'1',OMP_NUM_THREADS:cpu,MKL_NUM_THREADS:cpu,OPENBLAS_NUM_THREADS:cpu}});job.child=child;job.state='running';job.stage='loading';let line='',lastError='';
   child.stdout.on('data',data=>{line=(line+data.toString()).slice(-65536);let at;while((at=line.indexOf('\n'))>=0){const text=line.slice(0,at);line=line.slice(at+1);try{const m=JSON.parse(text);if(job.state==='running'){if(['loading','model','separating','writing','verifying'].includes(m.stage))job.stage=m.stage;if(m.error)job.error=String(m.error).slice(0,4000);}}catch{}}});
   child.stderr.on('data',data=>{const text=data.toString();lastError=(lastError+text).slice(-4000);const percentages=[...text.matchAll(/(\d+)%/g)];if(job.stage==='separating'&&percentages.length)job.percent=Math.max(0,Math.min(100,Number(percentages.at(-1)[1])));});
   const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);job.timer=setTimeout(()=>{job.error='Le budget de temps de préparation est dépassé.';child.kill();},this.timeoutMs??job.timeoutMinutes*60*1000);job.timer.unref?.();});clearTimeout(job.timer);job.child=null;cancelled(job);
   if(code!==0||job.error)throw Error(job.error||lastError||'La séparation a échoué.');job.stage='verifying';job.percent=null;job.manifest=await this.cached(job);cancelled(job);if(!job.manifest)throw Error('Les fichiers de stems sont incomplets ou leur cache est altéré.');job.state='done';
  }catch(error){if(job.state!=='cancelled'){job.state='error';job.error=error.message;}}
  finally{clearTimeout(job.timer);job.child=null;if(this.active===job)this.active=null;}
 }
 status(id){const job=this.jobs.get(id);if(!job)throw Error('Préparation inconnue.');return{id,state:job.state,stage:job.stage,percent:job.percent,error:job.error,cached:Boolean(job.cached),cpuThreads:job.cpuThreads,memoryMiB:job.memoryMiB,timeoutMinutes:job.timeoutMinutes,manifest:job.state==='done'?job.manifest:undefined};}
 async read(id,name){const job=this.jobs.get(id);if(!job||job.state!=='done'||!names.includes(name))throw Error('Stem indisponible.');const bytes=await fs.readFile(path.join(job.folder,name+'.wav'));if(await hashBytes(bytes,job)!==job.manifest.hashes[name])throw Error('Le cache de stems a changé. Préparez de nouveau ce morceau.');return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
 cancel(id){const job=this.jobs.get(id);if(!job||!['running','queued'].includes(job.state))return;job.state='cancelled';job.child?.kill();}
 cancelActive(){if(this.active)this.cancel(this.active.id);}
 close(){this.closed=true;for(const job of this.jobs.values())this.cancel(job.id);}
}
module.exports={StemService,validateWave};
