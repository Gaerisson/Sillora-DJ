import {audioContentId} from './audio-identity.mjs';
export {audioContentId} from './audio-identity.mjs';
import {fileKey} from './studio-tools.mjs';
const abortError=()=>new DOMException('Import annulé','AbortError');
const audioReady=track=>Boolean(track?.buffer?.getChannelData);
const metadata=track=>Object.fromEntries(['title','artist','album','bpm','key','keyRoot','keyMode','keyConfidence','confidence','favorite','color','contentKey','analysisStatus','analysisVersion','regionAnalysisVersion','manualGrid','manualRegions','manualKey','downbeat','beatOffset','mixIn','mixOut','hotCues'].filter(k=>track?.[k]!==undefined).map(k=>[k,track[k]]));

// File references stay in memory; snapshots contain metadata and durable IDs,
// never PCM, credentials, IPC tokens or renderer-supplied filesystem paths.
export class LibraryImports extends EventTarget{
 constructor({decode,canRun=()=>true}={}){super();this.decode=decode;this.canRun=canRun;this.records=new Map();this.byKey=new Map();this.byContent=new Map();this.jobs=new Map();this.active=null;this.sequence=0;this.batch=null;}
 emit(type='change',detail={}){this.dispatchEvent(new CustomEvent(type,{detail}));}
 discover(files){return files.map(file=>{
  const key=fileKey(file);let record=this.byKey.get(key);
  if(!record){const parts=file.name.replace(/\.[^.]+$/,'').split(' - ');record={id:crypto.randomUUID(),key,name:file.name,size:file.size,lastModified:file.lastModified,fileId:file.fileId||null,title:parts.length>1?parts.slice(1).join(' - '):parts[0],artist:parts.length>1?parts[0]:'Fichier local',state:'discovered',processed:false,priority:50};this.records.set(record.id,record);this.byKey.set(key,record);}
  record.file=file;if(record.state==='missing')record.state=record.processed?'stored':'discovered';return record;
 });}
 rows(){return [...this.records.values()].map(r=>r.track||{id:r.id,fileKey:r.key,title:r.title,artist:r.artist,...r.meta,favorite:r.favorite??r.meta?.favorite??false,buffer:{duration:r.duration||0},libraryState:r.state,analysisStatus:r.meta?.analysisStatus||'waiting'});}
 get(id){return this.records.get(id);}
 stateFor(id){return this.get(id)?.state;}
 ensure(id,{priority=0,manual=true,batch=null}={}){
  const r=this.get(id);if(!r)return Promise.reject(new Error('Titre absent du catalogue.'));
  r.lastUsed=Date.now();if(audioReady(r.track)){r.state='ready';return Promise.resolve(r.track);}
  if(!r.file){r.state='missing';this.emit();return Promise.reject(new Error('Resélectionnez le fichier ou son dossier pour le charger.'));}
  let job=this.jobs.get(id);
  if(job&&!job.controller.signal.aborted){job.priority=Math.min(job.priority,priority);job.manual||=manual;if(batch)job.batch=batch;r.priority=job.priority;this.emit();this.drainSoon();return job.promise;}
  let resolve,reject;job={id,record:r,priority,manual,batch,sequence:this.sequence++,controller:new AbortController(),promise:new Promise((a,b)=>{resolve=a;reject=b;})};Object.assign(job,{resolve,reject});
  this.jobs.set(id,job);r.state='queued';r.priority=priority;r.error=null;this.emit();this.drainSoon();return job.promise;
 }
 start(files,{onTrack=async()=>{},label='Import'}={}){
  if(this.batch&&['running','paused'].includes(this.batch.state))throw new Error('Reprenez ou annulez l’import en cours.');
  const records=this.discover(files),batch={id:crypto.randomUUID(),label,keys:records.map(r=>r.id),completed:[],state:'running',errors:0};this.batch=batch;this.emit();
  batch.promise=Promise.all(records.map((r,i)=>this.ensure(r.id,{priority:i<2?5:50,manual:false,batch}).then(async track=>{batch.completed.push(r.id);if(batch.state!=='cancelled')await onTrack(track);this.emit();return track;}).catch(error=>{if(error.name!=='AbortError')batch.errors++;return null;}))).then(items=>{if(batch.state!=='cancelled')batch.state='done';this.emit();return items.filter(Boolean);});
  return batch;
 }
 pause(){if(this.batch?.state==='running'){this.batch.state='paused';this.emit();}}
 resume(){if(this.batch?.state==='paused'){this.batch.state='running';this.emit();this.drainSoon();}}
 cancel(){const batch=this.batch;if(!batch)return;batch.state='cancelled';for(const job of [...this.jobs.values()])if(job.batch===batch&&!job.manual){job.controller.abort();if(job!==this.active){this.jobs.delete(job.id);job.record.state='cancelled';job.reject(abortError());}}this.emit();this.drainSoon();}
 promote(ids,priority){for(const id of ids){const job=this.jobs.get(id);if(job){job.priority=Math.min(job.priority,priority);job.record.priority=job.priority;}}this.drainSoon();}
 setPriorities(priorities){for(const job of this.jobs.values()){const priority=priorities.get(job.id)??50;job.priority=job.manual?Math.min(job.priority,priority):priority;job.record.priority=job.priority;}this.drainSoon();}
 drainSoon(){queueMicrotask(()=>this.drain());}
 async drain(){
  if(this.active)return;const job=[...this.jobs.values()].filter(j=>!j.controller.signal.aborted&&(j.manual||j.batch?.state==='running')&&this.canRun(j)).sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];if(!job)return;
  this.active=job;const r=job.record;r.state='decoding';this.emit();
  try{const track=await this.decode(r.file,r,job.controller.signal);if(job.controller.signal.aborted)throw abortError();r.track=track;r.state='ready';r.processed=true;r.duration=track.buffer.duration;r.meta=metadata(track);this.indexContent(r);track.libraryState='ready';track.ensureAudio=options=>this.ensure(r.id,options);this.emit('ready',{record:r,track});job.resolve(track);}
  catch(error){if(this.jobs.get(r.id)===job){r.state=error.name==='AbortError'?'cancelled':'error';r.error=error.message;}job.reject(error);}
  finally{if(this.jobs.get(r.id)===job)this.jobs.delete(r.id);this.active=null;this.emit();this.drainSoon();}
 }
 indexContent(record){const key=audioContentId(record.meta?.contentKey),prior=this.byContent.get(key);if(key&&(!prior||(record.userUpdatedAt||0)>=(prior.userUpdatedAt||0)))this.byContent.set(key,record);}
 touch(track,{user=false}={}){const r=this.get(track.id);if(r){r.meta=metadata(track);r.title=track.title;r.artist=track.artist;r.duration=track.buffer.duration;if(user)r.userUpdatedAt=Date.now();this.indexContent(r);this.emit();}}
 bind(files){const records=this.discover(files),keys=new Set(records.map(r=>r.key));for(const r of this.records.values())if(!r.file&&!keys.has(r.key))r.state='missing';this.emit();return records;}
 snapshot(){return{version:1,records:[...this.records.values()].slice(-20000).map(r=>({id:r.id,key:r.key,name:r.name,size:r.size,lastModified:r.lastModified,fileId:r.fileId,title:r.track?.title||r.title,artist:r.track?.artist||r.artist,duration:r.duration,meta:r.track?metadata(r.track):r.meta,processed:r.processed,userUpdatedAt:r.userUpdatedAt||0,favorite:r.favorite})),batch:this.batch?{id:this.batch.id,label:this.batch.label,keys:this.batch.keys,completed:this.batch.completed,state:this.batch.state}:this.restoredBatch||null};}
 restore(snapshot){
  if(snapshot?.version!==1||!Array.isArray(snapshot.records))return;
  for(const v of snapshot.records.slice(-20000)){if(!v||typeof v.id!=='string'||typeof v.key!=='string'||typeof v.name!=='string'||this.byKey.has(v.key)||this.records.has(v.id))continue;const r={...v,duration:Number.isFinite(v.duration)?v.duration:0,favorite:typeof v.favorite==='boolean'?v.favorite:undefined,meta:metadata(v.meta),state:'missing',file:null,track:null};this.records.set(r.id,r);this.byKey.set(r.key,r);this.indexContent(r);}
  this.restoredBatch=snapshot.batch;this.emit();
 }
 resumeFiles(){const b=this.restoredBatch;if(!b)return [];const done=new Set(b.completed||[]);return(b.keys||[]).filter(id=>!done.has(id)).map(id=>this.get(id)?.file).filter(Boolean);}
 get pending(){return [...this.jobs.values()].some(j=>!j.controller.signal.aborted&&(j.manual||j.batch?.state==='running'));}
 evict({pinned=new Set(),budget=384*1024*1024}={}){
  const records=[...this.records.values()],bytes=r=>(audioReady(r.track)?r.track.buffer.length*r.track.buffer.numberOfChannels*4:0)+(r.track?.stemBuffer?r.track.stemBuffer.length*r.track.stemBuffer.numberOfChannels*4:0);let total=records.reduce((sum,r)=>sum+bytes(r),0),removed=0;
  for(const r of records.sort((a,b)=>(a.lastUsed||0)-(b.lastUsed||0))){if(total<=budget)break;const track=r.track,size=bytes(r);if(!size||!r.file||pinned.has(track)||!['ready','error','cancelled'].includes(track.analysisStatus)||this.active?.id===r.id||track.stemPreparing)continue;const b=track.buffer;if(track.stemBuffer){track.stemBuffer=null;track.stemEnvelopes=null;track.stemStatus='Stems sur disque';}track.buffer={duration:b.duration,sampleRate:b.sampleRate,numberOfChannels:b.numberOfChannels};track.libraryState=r.state='stored';total-=size;removed++;}
  this.bufferBytes=total;if(removed)this.emit();return{bytes:total,removed};
 }
}
