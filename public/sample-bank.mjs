const bounded=(value,min,max,fallback=min)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const slotId=value=>{const id=Number(value);if(!Number.isInteger(id)||id<0||id>7)throw new Error('Pad non valide.');return id;};

export class IndexedDbSampleStorage {
 constructor(){this.database=null;}
 async open(){
  if(typeof indexedDB==='undefined')return null;
  this.database??=new Promise((resolve,reject)=>{const request=indexedDB.open('sillage-sample-bank',1);request.onupgradeneeded=()=>request.result.createObjectStore('pads',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return this.database;
 }
 async run(mode,operation){const db=await this.open();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('pads',mode),request=operation(tx.objectStore('pads'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
 list(){return this.run('readonly',store=>store.getAll());}
 put(record){return this.run('readwrite',store=>store.put(record));}
 delete(id){return this.run('readwrite',store=>store.delete(id));}
}

export class SampleBank extends EventTarget {
 constructor(engine,{storage=new IndexedDbSampleStorage()}={}){
  super();this.engine=engine;this.storage=storage;this.pads=Array.from({length:8},(_,id)=>({id,title:'Pad '+(id+1),buffer:null,voice:null,gain:.8,loop:false,revision:0}));
  this.ready=this.restore().catch(error=>{this.dispatchEvent(new CustomEvent('error',{detail:error}));});
 }
 get state(){return this.pads.map(p=>({id:p.id,title:p.title,duration:p.buffer?.duration||(p.saved?.channels?.[0]?.length||0)/(p.saved?.sampleRate||1),loaded:Boolean(p.buffer||p.saved),playing:Boolean(p.voice),loop:p.loop,gain:p.gain}));}
 changed(){this.dispatchEvent(new Event('change'));}
 async restore(){const records=await this.storage?.list?.();for(const record of records||[]){if(!Number.isInteger(record.id)||record.id<0||record.id>7||!Array.isArray(record.channels)||!record.channels.length||record.channels.length>2||!(record.sampleRate>=8000&&record.sampleRate<=192000))continue;const length=record.channels[0]?.length;if(!length||length/record.sampleRate>30.001||record.channels.some(c=>c.length!==length))continue;Object.assign(this.pads[record.id],{title:String(record.title||'Pad '+(record.id+1)),gain:bounded(record.gain,0,1,.8),loop:Boolean(record.loop),saved:record});}this.changed();}
 async materialize(pad){if(pad.buffer||!pad.saved)return;const ctx=await this.engine.init(),record=pad.saved,buffer=ctx.createBuffer(record.channels.length,record.channels[0].length,record.sampleRate);for(let ch=0;ch<record.channels.length;ch++)buffer.getChannelData(ch).set(record.channels[ch]);pad.buffer=buffer;}
 async persist(pad){
  if(!this.storage)return;const record=pad.buffer?{id:pad.id,title:pad.title,gain:pad.gain,loop:pad.loop,sampleRate:pad.buffer.sampleRate,channels:Array.from({length:pad.buffer.numberOfChannels},(_,ch)=>pad.buffer.getChannelData(ch).slice())}:pad.saved?{...pad.saved,gain:pad.gain,loop:pad.loop}:null;
  if(record){pad.persistQueue=(pad.persistQueue||Promise.resolve()).then(()=>this.storage.put?.(record)).catch(error=>{this.dispatchEvent(new CustomEvent('error',{detail:new Error('Le pad fonctionne, mais son enregistrement local a échoué : '+error.message)}));});await pad.persistQueue;}
 }
 copy(buffer,start,seconds){
  const sr=buffer.sampleRate,first=Math.max(0,Math.min(buffer.length-1,Math.round(start*sr))),length=Math.min(buffer.length-first,Math.round(seconds*sr));if(length<sr*.025)throw new Error('Extrait trop court à cette position.');
  const result=this.engine.context.createBuffer(Math.min(2,buffer.numberOfChannels),length,sr),edge=Math.min(Math.round(sr*.005),Math.floor(length/2));
  for(let ch=0;ch<result.numberOfChannels;ch++){const data=result.getChannelData(ch);data.set(buffer.getChannelData(ch).subarray(first,first+length));for(let i=0;i<edge;i++){const scale=i/Math.max(1,edge-1);data[i]*=scale;data[length-1-i]*=scale;}data[0]=data[length-1]=0;}
  return result;
 }
 async capture(slot,deck,{seconds=4}={}){
  await this.ready;const pad=this.pads[slotId(slot)],d=this.engine.decks[Number(deck)];if(!d?.track?.buffer)throw new Error('Charge un titre sur cette platine.');const revision=++pad.revision,track=d.track;await this.engine.init();if(track.ensureAudio&&!track.buffer.getChannelData)await track.ensureAudio({priority:0});if(pad.revision!==revision||d.track!==track)return this.state[pad.id];
  const start=this.engine.position(d.id),buffer=this.copy(d.track.buffer,start,bounded(seconds,1,16,4));this.stop(pad.id);Object.assign(pad,{buffer,saved:null,title:(d.track.title||'Platine '+(d.id+1))+' · '+start.toFixed(1)+' s'});this.changed();await this.persist(pad);return this.state[pad.id];
 }
 async loadFile(slot,file){
  await this.ready;const pad=this.pads[slotId(slot)],revision=++pad.revision,ctx=await this.engine.init();if(!file?.arrayBuffer)throw new Error('Fichier audio non valide.');const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
  if(decoded.duration>30.001)throw new Error('Choisis un sample de 30 secondes maximum. Pour un titre long, utilise Capturer A ou B.');if(pad.revision!==revision)return this.state[pad.id];
  const buffer=this.copy(decoded,0,decoded.duration);this.stop(pad.id);Object.assign(pad,{buffer,saved:null,title:String(file.name||'Sample').replace(/\.[^.]+$/,'')});this.changed();await this.persist(pad);return this.state[pad.id];
 }
 async trigger(slot,{loop}={}){
  await this.ready;const pad=this.pads[slotId(slot)],revision=pad.revision;await this.engine.init();await this.materialize(pad);if(pad.revision!==revision)return this.state[pad.id];if(!pad.buffer)throw new Error('Ce pad est vide. Capture ou importe un sample.');this.stop(pad.id);
  const ctx=this.engine.context,source=ctx.createBufferSource(),envelope=ctx.createGain(),level=ctx.createGain(),start=ctx.currentTime;source.buffer=pad.buffer;source.loop=loop??pad.loop;pad.loop=Boolean(source.loop);source.connect(envelope).connect(level).connect(this.engine.musicBus);level.gain.value=pad.gain;
  envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+.005);if(!source.loop){const end=start+pad.buffer.duration;envelope.gain.setValueAtTime(1,Math.max(start+.005,end-.005));envelope.gain.linearRampToValueAtTime(0,end);}
  const voice={source,envelope,level,started:start,loop:pad.loop};pad.voice=voice;source.onended=()=>{source.disconnect();envelope.disconnect();level.disconnect();if(pad.voice===voice){pad.voice=null;this.changed();}};source.start(start);this.changed();this.persist(pad);return this.state[pad.id];
 }
 stop(slot){const pad=this.pads[slotId(slot)],voice=pad.voice;if(!voice)return;pad.voice=null;const now=this.engine.context.currentTime;voice.envelope.gain.cancelScheduledValues(now);voice.envelope.gain.setTargetAtTime(0,now,.002);try{voice.source.stop(now+.012);}catch{}this.changed();}
 stopAll(){for(const pad of this.pads)this.stop(pad.id);}
 setGain(slot,value){const pad=this.pads[slotId(slot)];pad.gain=bounded(value,0,1,.8);pad.voice?.level.gain.setTargetAtTime(pad.gain,this.engine.context.currentTime,.008);this.changed();this.persist(pad);return pad.gain;}
 setLoop(slot,value){const pad=this.pads[slotId(slot)];pad.loop=Boolean(value);const voice=pad.voice;if(voice&&voice.loop!==pad.loop){const now=this.engine.context.currentTime,duration=pad.buffer.duration,position=voice.loop?(now-voice.started)%duration:Math.min(duration,now-voice.started),end=now+duration-position;voice.source.loop=pad.loop;voice.loop=pad.loop;voice.envelope.gain.cancelScheduledValues(now);voice.envelope.gain.setTargetAtTime(1,now,.003);if(!pad.loop){voice.envelope.gain.setValueAtTime(1,Math.max(now,end-.005));voice.envelope.gain.linearRampToValueAtTime(0,end);}}this.changed();this.persist(pad);return pad.loop;}
 async clear(slot){await this.ready;const pad=this.pads[slotId(slot)];this.stop(pad.id);pad.revision++;Object.assign(pad,{buffer:null,saved:null,title:'Pad '+(pad.id+1),loop:false,gain:.8});this.changed();pad.persistQueue=(pad.persistQueue||Promise.resolve()).then(()=>this.storage?.delete?.(pad.id)).catch(error=>this.dispatchEvent(new CustomEvent('error',{detail:error})));await pad.persistQueue;return this.state[pad.id];}
}
