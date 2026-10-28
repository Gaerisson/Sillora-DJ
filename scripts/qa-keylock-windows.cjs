const {app,BrowserWindow}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.runtime','keylock-proof','results');
require('node:fs').mkdirSync(base,{recursive:true});app.setPath('userData',base+'/profile-'+Date.now());app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');app.commandLine.appendSwitch('disable-background-timer-throttling');app.on('window-all-closed',()=>{});
let server,win;const report={completed:false,passed:false,scope:'Stereo-isolated synthetic pulses, post-key-lock pre-EQ audio tap. Signal measurements, not transport position differences.',cases:[],errors:[]};
app.whenReady().then(async()=>{try{
 const {createStudioServer}=await import(pathToFileURL(root+'/server.mjs'));server=await createStudioServer({port:0});
 for(const profile of ['standard','rhythm'])for(const [a,b,morph,keyLock,sr]of [[128,128,false,false,44100],[128,128,false,true,44100],[120,124,false,false,44100],[120,124,false,true,44100],[110,98,true,false,44100],[110,98,true,true,44100],[98,110,true,false,44100],[98,110,true,true,44100],[110,98,true,true,48000],[98,110,true,true,48000]]){
  if(profile==='rhythm'&&!keyLock)continue;
  win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);win.webContents.on('console-message',e=>{if(e.level===3||e.level==='error')report.errors.push(e.message);});await win.loadURL(server.origin);
  const result=await win.webContents.executeJavaScript(`(async()=>{
   const {StudioEngine}=await import('/engine.js'),{tempoTime}=await import('/tempo-automation.mjs');const bpmA=${a},bpmB=${b},morph=${morph},keyLock=${keyLock},sr=${sr},seconds=22,Original=window.AudioContext;
   window.AudioContext=class extends OfflineAudioContext{constructor(){super(2,sr*seconds,sr);}async resume(){}};
   const engine=new StudioEngine({keyLockProfile:${JSON.stringify(profile)}});engine.keyLock=keyLock;await engine.init();
   for(let id=0;id<2;id++){const bpm=id?bpmB:bpmA,buffer=engine.context.createBuffer(2,sr*40,sr),data=buffer.getChannelData(id);for(let beat=0;beat*60/bpm<39;beat++){const first=Math.round(beat*60/bpm*sr);for(let i=0;i<sr*.035;i++){const t=i/sr,p=i/(sr*.035),attack=Math.min(1,t/.001);data[first+i]=.35*attack*Math.exp(-p*6)*Math.sin(2*Math.PI*(id?1391:997)*t);}}engine.load(id,{id:'pulse-'+id,title:'Pulse '+id,buffer,bpm,confidence:'manual',manualGrid:true,manualRegions:true,mixIn:0,mixOut:30,audibleEnd:40,autoGain:1,downbeat:0});engine.decks[id].input.connect(engine.context.destination);}
   engine.musicBus.gain.value=0;await engine.play(0);let transition;
   const arm=engine.context.suspend(1.5).then(async()=>{await engine.startTransition({style:'bass',beats:16,sync:true,quantize:true,tempoBlend:morph,intensity:0});const t=engine.transition;transition={start:t.start,duration:t.duration,bpmA:t.bpmA,bpmB:t.bpmB,latency:engine.keyLockLatency,sourceLatency:engine.decks[0].latency,targetLatency:engine.decks[1].latency,sync:t.sync,keyLockAvailable:engine.keyLockAvailable,inPoint:t.inPoint,outPoint:t.outPoint};return OfflineAudioContext.prototype.resume.call(engine.context);});
   const rendered=await engine.context.startRendering();await arm;window.AudioContext=Original;
   const envelope=channel=>{const d=rendered.getChannelData(channel),n=Math.floor(d.length/sr*1000),e=new Float32Array(n);for(let ms=0;ms<n;ms++){const lo=Math.round(ms*sr/1000),hi=Math.round((ms+1)*sr/1000);let sum=0;for(let i=lo;i<hi;i++)sum+=d[i]*d[i];e[ms]=Math.sqrt(sum/Math.max(1,hi-lo));}return e;};
   const left=envelope(0),right=envelope(1),beats=[];
   for(let k=2;k<=14;k++){
    const expected=transition.start+(morph?tempoTime(k,bpmA,bpmB,transition.duration):k*60/bpmA),center=Math.round(expected*1000),lo=center-140,hi=center+140;
    const inspect=e=>{let peak=lo;for(let i=lo;i<=hi;i++)if(e[i]>e[peak])peak=i;let onset=peak;while(onset>lo&&e[onset-1]>e[peak]*.25)onset--;return {peak:peak-center,onset:onset-center,amplitude:e[peak]};};
    const A=inspect(left),B=inspect(right);let best={lag:0,correlation:-1};
    for(let lag=-80;lag<=80;lag++){let xy=0,xx=0,yy=0;for(let i=lo;i<=hi;i++){const x=left[i]||0,y=right[i+lag]||0;xy+=x*y;xx+=x*x;yy+=y*y;}const correlation=xy/Math.sqrt(Math.max(1e-24,xx*yy));if(correlation>best.correlation)best={lag,correlation};}
    beats.push({k,expected,A,B,lagMs:best.lag,correlation:best.correlation,onsetDeltaMs:B.onset-A.onset});
   }
   let nonFinite=0,peak=0;for(let c=0;c<2;c++)for(const x of rendered.getChannelData(c)){if(!Number.isFinite(x))nonFinite++;peak=Math.max(peak,Math.abs(x));}
   return {profile:engine.keyLockProfile,bpmA,bpmB,morph,keyLock,sampleRate:sr,transition,beats,peak,nonFinite,maxLagMs:Math.max(...beats.map(x=>Math.abs(x.lagMs))),meanLagMs:beats.reduce((s,x)=>s+x.lagMs,0)/beats.length,maxOnsetDeltaMs:Math.max(...beats.map(x=>Math.abs(x.onsetDeltaMs)))};
  })()`,true);
  if(result.nonFinite||result.peak>=1)throw Error('Invalid acoustic render');if(!result.transition.sync)throw Error('Beat clock not synchronized');const limit=keyLock?(profile==='rhythm'?8:16):1;if(result.maxLagMs>limit||result.maxOnsetDeltaMs>limit)throw Error('Acoustic alignment exceeded '+limit+'ms');if(keyLock&&profile==='rhythm'&&result.transition.latency>=.08)throw Error('Rhythm profile was not applied at construction');
  report.cases.push(result);await fs.writeFile(base+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({profile,a,b,morph,keyLock,sr,latencyMs:result.transition.latency*1000,maxLagMs:result.maxLagMs,meanLagMs:result.meanLagMs,maxOnsetDeltaMs:result.maxOnsetDeltaMs}));win.destroy();win=null;
 }
 report.completed=true;report.passed=report.errors.length===0;
 }catch(error){report.failure=error.stack;}finally{await fs.writeFile(base+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({completed:report.completed,passed:report.passed,cases:report.cases.length,failure:report.failure}));win?.destroy();server?.close();app.exit(report.passed?0:1);}
});
