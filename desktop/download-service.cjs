const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {PublicHttps,publicURL}=require('./public-https.cjs');
const {coverJPEG}=require('./metadata-service.cjs');

const MAX_DURATION=30*60,MAX_BYTES=250*1024*1024;
const AUDIO=/\.(m4a|webm|opus|ogg|mp3|aac|flac|wav)$/i;
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
function youtubeURL(value){
 if(typeof value!=='string'||value.length>2048)throw new Error('Collez le lien d’une vidéo YouTube.');
 let url;try{url=new URL(value.trim());}catch{throw new Error('Lien YouTube invalide.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash)throw new Error('Utilisez un lien HTTPS YouTube public.');
 const host=url.hostname.toLowerCase(),long=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host);let id;
 if(host==='youtu.be'||host==='www.youtu.be')id=url.pathname.slice(1);
 else if(long&&url.pathname==='/watch')id=url.searchParams.get('v');
 else if(long&&/^\/(?:shorts|live|embed)\/[A-Za-z0-9_-]{11}$/.test(url.pathname))id=url.pathname.split('/')[2];
 if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Ce lien doit désigner une seule vidéo YouTube.');
 return{id,url:'https://www.youtube.com/watch?v='+id};
}
function soundcloudURL(value){
 if(typeof value!=='string'||value.length>2048)throw new Error('Collez le lien d’un titre SoundCloud.');
 let url;try{url=new URL(value.trim());}catch{throw new Error('Lien SoundCloud invalide.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||!['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(url.hostname.toLowerCase()))throw new Error('Utilisez un lien HTTPS SoundCloud public.');
 const segments=url.pathname.replace(/\/$/,'').split('/').slice(1);if(segments.length!==2||segments.some(value=>!(/^[A-Za-z0-9_-]{1,200}$/).test(value))||/^(?:sets|discover|stream|you|search|stations|charts|upload|pages|terms|privacy|jobs|mobile)$/i.test(segments[0])||segments[1]==='sets'||[...url.searchParams.keys()].some(key=>/token|secret|auth|client/i.test(key)))throw new Error('Ce lien doit désigner un seul titre SoundCloud public.');
 return{provider:'soundcloud',id:null,url:'https://soundcloud.com/'+segments.join('/')};
}
function mediaURL(value){let host;try{host=new URL(typeof value==='string'?value.trim():'').hostname;}catch{throw new Error('Collez un lien YouTube ou SoundCloud valide.');}if(['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(host))return soundcloudURL(value);return{...youtubeURL(value),provider:'youtube'};}
function soundcloudFormat(info){
 const formats=(Array.isArray(info.formats)?info.formats:[]).filter(format=>typeof format.format_id==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(format.format_id)&&!/(?:preview|premium)/i.test(format.format_id+' '+(format.format_note||''))&&!format.has_drm&&format.vcodec==='none'&&['http','https','m3u8_native'].includes(format.protocol)&&['m4a','mp3','opus','ogg','wav','flac','aac'].includes(format.ext)&&(!Number.isFinite(format.filesize)||format.filesize<=MAX_BYTES));
 formats.sort((a,b)=>Number(b.protocol==='http'||b.protocol==='https')-Number(a.protocol==='http'||a.protocol==='https')||(b.abr||0)-(a.abr||0));
 if(!formats.length)throw new Error('SoundCloud public full audio unavailable (Go+, preview or protected track).');return formats[0].format_id;
}
function filename(value){let name=clean(value,110).replace(/[<>:"/\\|?*]/g,' ').replace(/[. ]+$/g,'').replace(/\s+/g,' ').trim();if(!name||/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(name))name='YouTube';return name;}
async function childDirectory(parent,name){
 const destination=path.join(parent,name);try{const stat=await fs.lstat(destination);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Le dossier de téléchargement ne peut pas être utilisé.');}catch(error){if(error.code!=='ENOENT')throw error;await fs.mkdir(destination);}
 const real=await fs.realpath(destination);if(!inside(parent,real))throw new Error('Dossier de téléchargement hors du dossier Musique.');return real;
}
function downloadError(message){
 if(/duration|longer|match.*filter/i.test(message))return 'Seuls les titres de 30 minutes au maximum sont pris en charge.';
 if(/filesize|too large|larger than|max.filesize/i.test(message))return 'Ce fichier dépasse la limite de 250 Mo.';
 if(/sign in|login|confirm.*bot|age.restrict|private|members.only|not available|unavailable|copyright|drm/i.test(message))return 'Cette vidéo est privée, protégée ou indisponible. Choisissez une vidéo publique accessible sans compte.';
 if(/network|resolve|timed out|connection|HTTP Error|certificate|SSL/i.test(message))return 'YouTube est inaccessible pour le moment. Vérifiez la connexion et réessayez.';
 return 'Le téléchargement a échoué. La vidéo peut être indisponible ou son format audio incompatible.';
}

class DownloadService{
 constructor({music,profileDir,vendorDir,describe,nativeImage,network=new PublicHttps(),spawnProcess=spawn,onEvent=()=>{},now=Date.now}={}){
  Object.assign(this,{music,profileDir,describe,nativeImage,network,spawnProcess,onEvent,now});
  this.vendorDir=vendorDir||path.join(process.resourcesPath||path.join(__dirname,'..'),'media');
  if(!vendorDir&&!process.resourcesPath)this.vendorDir=path.join(__dirname,'vendor','media');
  this.jobs=new Map();this.metadata={};this.active=null;this.closed=false;this.ready=null;
 }
 async init(){
  if(this.ready)return this.ready;
  this.ready=(async()=>{
   if(!path.isAbsolute(this.music||'')||!path.isAbsolute(this.profileDir||''))throw new Error('Dossier Musique indisponible.');
   await fs.mkdir(this.music,{recursive:true});const music=await fs.realpath(this.music);this.folder=await childDirectory(music,'Gaerisson DJ Studio');this.youtubeFolder=await childDirectory(this.folder,'YouTube');this.soundcloudFolder=await childDirectory(this.folder,'SoundCloud');
   await fs.mkdir(this.profileDir,{recursive:true});this.staging=await childDirectory(this.profileDir,'youtube-staging');this.metadataFile=path.join(this.profileDir,'youtube-library.json');
   try{const saved=JSON.parse(await fs.readFile(this.metadataFile,'utf8'));for(const [file,entry]of Object.entries(saved||{}).slice(-1000))if(inside(this.folder,file)&&[this.youtubeFolder,this.soundcloudFolder].includes(path.dirname(file))&&AUDIO.test(file)&&entry&&typeof entry==='object')this.metadata[file]=this.safeMetadata(entry);}catch{}
   this.executable=path.join(this.vendorDir,'yt-dlp.exe');this.node=path.join(this.vendorDir,'node.exe');
   this.available=await Promise.all([this.executable,this.node].map(file=>fs.stat(file).then(stat=>stat.isFile()).catch(()=>false))).then(values=>values.every(Boolean));
   return this.info();
  })();return this.ready;
 }
 info(){return{available:!!this.available,folder:'Musique / Gaerisson DJ Studio',path:this.folder||'',providers:['youtube','soundcloud'],soundcloud:{publicLinks:true,goPlus:false,accountConnected:false,message:'Les liens publics accessibles sans compte peuvent être importés. La connexion SoundCloud Go+ nécessite une application partenaire enregistrée.'},maxDuration:MAX_DURATION,maxBytes:MAX_BYTES};}
 safeMetadata(entry){let sourceURL='',source='youtube';try{const media=mediaURL(entry.sourceURL);sourceURL=media.url;source=media.provider;}catch{}return{title:clean(entry.title),artist:clean(entry.artist),album:clean(entry.album),duration:Number.isFinite(entry.duration)&&entry.duration>0&&entry.duration<=MAX_DURATION?entry.duration:0,cover:typeof entry.cover==='string'&&entry.cover.startsWith('data:image/jpeg;base64,')&&entry.cover.length<=200*1024?entry.cover:null,source,sourceURL};}
 metadataForFile(file){return this.metadata[path.resolve(file)]||null;}
 state(job){return{id:job.id,provider:job.video.provider,status:job.status,title:job.title,progress:job.progress||0,bytes:job.bytes||0,totalBytes:job.totalBytes||0,speed:job.speed||0,eta:job.eta??null,message:job.message||'',createdAt:job.createdAt,updatedAt:job.updatedAt,descriptor:job.descriptor||null};}
 list(){return[...this.jobs.values()].map(job=>this.state(job));}
 get(id){const job=typeof id==='string'?this.jobs.get(id):null;if(!job)throw new Error('Téléchargement introuvable.');return this.state(job);}
 update(job,values,force=false){Object.assign(job,values,{updatedAt:this.now()});if(force||this.now()-(job.emittedAt||0)>200){job.emittedAt=this.now();try{this.onEvent(this.state(job));}catch{}}}
 async start(value){
  await this.init();if(this.closed)throw new Error('Le service de téléchargement est fermé.');if(!this.available)throw new Error('Le moteur YouTube inclus est indisponible. Réinstallez la version Windows complète.');
  const video=mediaURL(typeof value==='string'?value:value?.url);if(this.active)throw new Error('Un titre est déjà en téléchargement. Attendez ou annulez-le.');
  const job={id:randomUUID(),video,status:'queued',title:video.provider==='soundcloud'?'Titre SoundCloud':'Vidéo YouTube',progress:0,createdAt:this.now(),updatedAt:this.now(),cancelled:false};this.jobs.set(job.id,job);this.active=job;
  while(this.jobs.size>40){const key=this.jobs.keys().next().value;if(key===job.id)break;this.jobs.delete(key);}
  this.update(job,{message:'Préparation du titre…'},true);job.promise=this.run(job).finally(()=>{if(this.active===job)this.active=null;});return this.state(job);
 }
 async cancel(id){const job=typeof id==='string'?this.jobs.get(id):null;if(!job)throw new Error('Téléchargement introuvable.');if(['completed','error','cancelled'].includes(job.status))return this.state(job);job.cancelled=true;this.update(job,{status:'cancelled',message:'Téléchargement annulé.'},true);job.process?.kill();return this.state(job);}
 baseArguments(){return['--ignore-config','--no-playlist','--no-plugin-dirs','--no-cache-dir','--no-colors','--fixup','never','--socket-timeout','20','--retries','2','--fragment-retries','2','--no-js-runtimes','--js-runtimes','node:'+this.node];}
 command(job,args,{json=false}={}){
  return new Promise((resolve,reject)=>{
   if(job.cancelled)return reject(new Error('CANCELLED'));
   let child;try{child=this.spawnProcess(this.executable,args,{cwd:job.directory,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_OPTIONS:'',NODE_PATH:'',PYTHONPATH:'',PYTHONHOME:''}});}catch(error){return reject(error);}
   job.process=child;let stdout='',stderr='',line='',settled=false;const timer=setTimeout(()=>{child.kill();finish(new Error('Le téléchargement a expiré.'));},json?90000:10*60*1000);
   const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(job.process===child)job.process=null;error?reject(error):resolve(result);};
   child.stdout.on('data',chunk=>{
    if(json){stdout+=chunk.toString('utf8');if(Buffer.byteLength(stdout)>8*1024*1024){child.kill();finish(new Error('Métadonnées trop volumineuses.'));}return;}
    line+=chunk.toString('utf8');if(line.length>65536)line=line.slice(-65536);const lines=line.split(/\r?\n/);line=lines.pop();
    for(const item of lines)if(item.startsWith('SILLAGE_PROGRESS:'))try{const progress=JSON.parse(item.slice(17)),bytes=Number(progress.downloaded_bytes)||0,totalBytes=Number(progress.total_bytes||progress.total_bytes_estimate)||0;if(bytes>MAX_BYTES){child.kill();return finish(new Error('filesize too large'));}this.update(job,{progress:totalBytes>0?Math.min(.99,bytes/totalBytes):0,bytes,totalBytes,speed:Number(progress.speed)||0,eta:Number.isFinite(progress.eta)?progress.eta:null});}catch{}
   });
   child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8')).slice(-12000);});child.on('error',error=>finish(error));
   child.on('close',code=>{if(job.cancelled)return finish(new Error('CANCELLED'));if(code!==0)return finish(new Error(stderr||'yt-dlp exit '+code));if(json)try{return finish(null,JSON.parse(stdout));}catch{return finish(new Error('Métadonnées YouTube invalides.'));}finish(null);});
  });
 }
 async run(job){
  try{
   job.directory=await childDirectory(this.staging,job.id);this.update(job,{status:'inspecting',message:'Lecture du titre et du format audio…'},true);
   const info=await this.command(job,[...this.baseArguments(),'--skip-download','--dump-single-json','--',job.video.url],{json:true});if(job.cancelled)throw new Error('CANCELLED');
   if(job.video.provider==='soundcloud'){if(!/^\d{1,20}$/.test(String(info.id))||!/^soundcloud$/i.test(info.extractor_key||info.extractor||'')||info.entries)throw new Error('SoundCloud track unavailable');job.video.id=String(info.id);job.format=soundcloudFormat(info);}
   if(String(info.id)!==job.video.id||!Number.isFinite(info.duration)||info.duration<=0||info.duration>MAX_DURATION||info.is_live||info.live_status==='is_live'||info.live_status==='is_upcoming')throw new Error('duration unavailable or longer than permitted');
   const metadata=this.safeMetadata({title:info.track||info.title,artist:info.artist||info.creator||info.uploader,album:info.album,duration:info.duration,sourceURL:job.video.url});
   this.update(job,{title:metadata.title||'Vidéo YouTube',status:'downloading',message:'Téléchargement audio…'},true);
   await this.command(job,[...this.baseArguments(),'--newline','--progress','--progress-template','download:SILLAGE_PROGRESS:%(progress)j','--no-overwrites','--no-continue','--no-mtime','--max-filesize',String(MAX_BYTES),'--match-filters','duration <= '+MAX_DURATION+' & !is_live','--format',job.format||'bestaudio[ext=m4a]/bestaudio','--output',path.join(job.directory,'%(id)s.%(ext)s'),'--',job.video.url]);
   if(job.cancelled)throw new Error('CANCELLED');this.update(job,{status:'finalizing',progress:.99,message:'Ajout à votre bibliothèque…'},true);
   const names=await fs.readdir(job.directory),files=names.filter(name=>name.startsWith(job.video.id+'.')&&AUDIO.test(name));if(files.length!==1)throw new Error('Format audio indisponible.');
   const source=path.join(job.directory,files[0]),stat=await fs.lstat(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>MAX_BYTES)throw new Error('filesize too large');
   if(this.nativeImage&&typeof info.thumbnail==='string')try{const url=publicURL(info.thumbnail);if(['i.ytimg.com','i9.ytimg.com','i1.sndcdn.com','a1.sndcdn.com'].includes(url.hostname)){const image=await this.network.read(url.href,{maxBytes:1024*1024,timeout:6000,redirects:2});metadata.cover=coverJPEG(image.buffer,this.nativeImage);}}catch{}
   if(job.cancelled)throw new Error('CANCELLED');
   const folder=job.video.provider==='soundcloud'?this.soundcloudFolder:this.youtubeFolder,root=await fs.realpath(folder);if(root!==folder||!inside(this.folder,root))throw new Error('Dossier de téléchargement modifié.');
   const extension=path.extname(files[0]).toLowerCase(),base=filename([metadata.artist,metadata.title].filter(Boolean).join(' - '))+' ['+job.video.id+']';let destination;
   for(let index=0;index<1000;index++){const file=path.join(folder,base+(index?' ('+(index+1)+')':'')+extension);try{await fs.copyFile(source,file,constants.COPYFILE_EXCL);destination=file;break;}catch(error){if(error.code!=='EEXIST')throw error;}}
   if(!destination)throw new Error('Impossible d’enregistrer ce titre.');
   this.metadata[destination]=metadata;try{await fs.writeFile(this.metadataFile,JSON.stringify(this.metadata));}catch{}
   let descriptor=null;try{if(this.describe){const result=await this.describe(destination);if(typeof result?.token==='string')descriptor={...result,metadata:{...result.metadata,...metadata}};}}catch{}
   const location='Musique / Gaerisson DJ Studio / '+(job.video.provider==='soundcloud'?'SoundCloud':'YouTube');
   this.update(job,{status:'completed',progress:1,bytes:stat.size,totalBytes:stat.size,eta:0,descriptor,message:'Titre enregistré dans '+location+'.'+(descriptor?'':' Actualisez la bibliothèque pour le charger.')},true);
  }catch(error){if(job.cancelled||error.message==='CANCELLED')this.update(job,{status:'cancelled',message:'Téléchargement annulé.'},true);else this.update(job,{status:'error',message:downloadError(error.message)},true);}
  finally{if(job.directory&&path.isAbsolute(job.directory)&&inside(this.staging,job.directory))try{const [stage,folder]=await Promise.all([fs.realpath(this.staging),fs.realpath(job.directory)]);if(stage===this.staging&&folder===job.directory&&inside(stage,folder))await fs.rm(folder,{recursive:true,force:true});}catch{}}
 }
 async dispose(){this.closed=true;if(this.active){await this.cancel(this.active.id);await this.active?.promise;}}
}
module.exports={DownloadService,youtubeURL,soundcloudURL,mediaURL,soundcloudFormat,filename,childDirectory,inside,downloadError,MAX_DURATION,MAX_BYTES};
