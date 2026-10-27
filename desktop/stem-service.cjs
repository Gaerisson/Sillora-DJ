const fs=require('node:fs/promises');
const fsSync=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const names=['drums','bass','other','vocals'];
function validateWave(bytes){
 const b=Buffer.from(bytes);
 if(b.length<44||b.length>160*1024*1024||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==3||b.readUInt16LE(22)!==2||b.readUInt16LE(34)!==32||b.readUInt16LE(32)!==8||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44||(b.length-44)%8)throw new Error('Audio stéréo WAV float32 requis, limité à 160 Mo.');
 const rate=b.readUInt32LE(24);if(rate<22050||rate>96000||b.readUInt32LE(28)!==rate*8||b.readUInt32LE(4)!==b.length-8)throw new Error('Fréquence audio invalide.');
 return b;
}
class StemService{
 constructor({cache,python,script=path.join(__dirname,'separate.py'),modelCache,bundleRoot}={}){
  bundleRoot||=process.resourcesPath&&fsSync.existsSync(path.join(process.resourcesPath,'stems','runtime-manifest.json'))?path.join(process.resourcesPath,'stems'):path.join(__dirname,'vendor','stems');
  this.bundled=fsSync.existsSync(path.join(bundleRoot,'runtime-manifest.json'));
  python||=process.env.SILLAGE_STEMS_PYTHON||path.join(bundleRoot,'python','python.exe');
  modelCache||=process.env.SILLAGE_STEMS_MODELS||path.join(bundleRoot,'models');
  cache||=path.join(require('node:os').homedir(),'.gaerisson-dj-studio','stems');
  Object.assign(this,{cache,python,script,modelCache,bundleRoot});this.jobs=new Map();this.active=null;
 }
 async availability(){try{await fs.access(this.python);await fs.access(path.join(this.modelCache,'hub','checkpoints','955717e8-8726e21a.th'));return {available:true,model:'htdemucs',processing:'offline',bundled:this.bundled};}catch{return {available:false,message:'Le moteur de stems intégré ou son modèle manque. Utilisez la distribution Windows complète.'};}}
 async begin(bytes){
  if(this.active||this.starting)throw new Error('Une préparation est déjà en cours. Attendez ou annulez-la.');
  if(this.closed)throw new Error('Le moteur est arrêté.');
  this.starting=true;try{return await this.start(bytes);}finally{this.starting=false;}
 }
 async start(bytes){
  if(this.active)throw new Error('Une préparation est déjà en cours. Attendez ou annulez-la.');
  if(!(await this.availability()).available)throw new Error((await this.availability()).message);
  const wave=validateWave(bytes),digest=createHash('sha256').update(wave).digest('hex'),folder=path.join(this.cache,'htdemucs-v1',digest),id=randomUUID();
  const job={id,folder,state:'queued',stage:'loading',percent:null,error:null};this.jobs.set(id,job);
  if(this.jobs.size>20)for(const [key,value] of this.jobs){if(value!==this.active&&key!==id){this.jobs.delete(key);break;}}
  try{const manifest=JSON.parse(await fs.readFile(path.join(folder,'complete.json'),'utf8'));if(manifest.version===1&&names.every(name=>manifest.sources.includes(name))){for(const name of names)await fs.access(path.join(folder,name+'.wav'));job.state='done';job.manifest=manifest;job.cached=true;return this.status(id);}}catch{}
  // Reserve before the first asynchronous write so concurrent callers cannot race.
  this.active=job;
  try{
   await fs.mkdir(folder,{recursive:true});await fs.mkdir(this.modelCache,{recursive:true});
   const helper=path.join(this.cache,'separate-v1.py');await fs.writeFile(helper,await fs.readFile(this.script));
   const input=path.join(folder,'input.wav');await fs.writeFile(input,wave);
   if(this.closed||job.state==='cancelled'){this.active=null;return this.status(id);}
   const child=spawn(this.python,['-u',helper,input,folder],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TORCH_HOME:this.modelCache,PYTHONUTF8:'1',OMP_NUM_THREADS:'4'}});
   job.child=child;job.state='running';let line='',lastError='';
   child.stdout.on('data',data=>{line+=data.toString();let at;while((at=line.indexOf('\n'))>=0){const text=line.slice(0,at);line=line.slice(at+1);try{const message=JSON.parse(text);job.stage=message.stage;if(message.error)job.error=message.error;if(message.stage==='done')job.manifest=message;}catch{}}});
   child.stderr.on('data',data=>{const text=data.toString();lastError=(lastError+text).slice(-4000);const percentages=[...text.matchAll(/(\d+)%/g)];if(job.stage==='separating'&&percentages.length)job.percent=Number(percentages.at(-1)[1]);});
   const finish=()=>{clearTimeout(job.timer);if(this.active===job)this.active=null;job.child=null;};
   child.on('error',error=>{job.error=error.message;job.state='error';finish();});
   child.on('close',code=>{if(job.state!=='cancelled'){job.state=code===0&&job.manifest?'done':'error';if(job.state==='error')job.error||=lastError||'La séparation a échoué.';}finish();});
   job.timer=setTimeout(()=>{job.error='La préparation a dépassé 30 minutes.';child.kill();},30*60*1000);job.timer.unref();
   return this.status(id);
  }catch(error){if(this.active===job)this.active=null;job.state='error';job.error=error.message;throw error;}
 }
 status(id){const job=this.jobs.get(id);if(!job)throw new Error('Préparation inconnue.');return {id,state:job.state,stage:job.stage,percent:job.percent,error:job.error,cached:Boolean(job.cached),manifest:job.state==='done'?job.manifest:undefined};}
 async read(id,name){const job=this.jobs.get(id);if(!job||job.state!=='done'||!names.includes(name))throw new Error('Stem indisponible.');const bytes=await fs.readFile(path.join(job.folder,name+'.wav'));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
 cancel(id){const job=this.jobs.get(id);if(!job||!['running','queued'].includes(job.state))return;job.state='cancelled';job.child?.kill();}
 close(){this.closed=true;for(const job of this.jobs.values())this.cancel(job.id);}
}
module.exports={StemService,validateWave};
