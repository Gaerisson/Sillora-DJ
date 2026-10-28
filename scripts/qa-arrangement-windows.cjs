const {app,BrowserWindow,ipcMain,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.runtime','arrangement-proof','results'),music=process.argv.slice(2);
if(music.length!==2){console.error('Usage : npm run test:arrangement:windows -- "piste-A.mp3" "piste-B.mp3"');app.exit(2);}
require('node:fs').mkdirSync(out,{recursive:true});app.setPath('userData',out+'/profile-'+Date.now());
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');app.commandLine.appendSwitch('disable-background-timer-throttling');app.on('window-all-closed',()=>{});
const report={passed:false,checks:[],viewports:[],errors:[],scope:'Real MP3 import/worker analysis, explicit manual grid correction through UI, arrangement preparation and paired Remote. No semantic phrase or listening-quality certification.'};
 let win,phone,server,remote,catalog=null,simulateCacheUpgrade=false;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const {createStudioServer}=await import(pathToFileURL(root+'/server.mjs'));server=await createStudioServer({port:0});
 const {RemoteHost}=require(root+'/desktop/remote-host.cjs'),{MetadataService}=require(root+'/desktop/metadata-service.cjs'),metadata=new MetadataService({nativeImage}),entries=[],files=new Map();
 for(let i=0;i<music.length;i++){const file=path.resolve(music[i]),raw=await fs.readFile(file),stat=await fs.stat(file),entry={token:'proof-'+i,fileId:'stable-'+i,name:path.basename(file),size:raw.length,lastModified:Math.floor(stat.mtimeMs)};entries.push(entry);files.set(entry.token,{file,raw});}
 remote=new RemoteHost({publicDir:root+'/public',dispatch:message=>win.webContents.send('remote:command',message)});
 const handlers={'studio:choose':()=>entries,'studio:library':()=>entries,'studio:remember':()=>true,'studio:catalog-read':()=>catalog,'studio:catalog-save':(_e,value)=>{catalog=JSON.parse(JSON.stringify(value));if(simulateCacheUpgrade)for(const r of catalog.records||[])if(r.meta?.contentKey)r.meta.contentKey=r.meta.contentKey.replace(/:region2$/,':region1');return true;},'analysis:read':()=>null,'analysis:save':()=>true,'studio:read':(_e,token)=>{const {raw}=files.get(token);return raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);},'studio:metadata':(_e,token)=>metadata.file(files.get(token).file),'studio:ready':()=>true,'studio:playing':()=>true,'stems:available':()=>({available:true}),'downloads:info':()=>({available:true}),'downloads:list':()=>[],'folders:roots':()=>[],'artwork:lookup':()=>null,'remote:status':()=>remote.status(),'remote:start':()=>remote.start(),'remote:stop':()=>remote.stop(),'remote:artwork':(_e,value)=>remote.storeArtwork(value),'remote:copy-link':()=>true};
 for(const [channel,handler]of Object.entries(handlers))ipcMain.handle(channel,handler);
 ipcMain.on('remote:state',(_e,state)=>remote.publish(state));ipcMain.on('remote:ack',(_e,ack)=>remote.acknowledge(ack));
 win=new BrowserWindow({show:false,width:1440,height:960,webPreferences:{preload:root+'/desktop/preload.cjs',contextIsolation:true,sandbox:true,offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 const captureErrors=target=>target.webContents.on('console-message',e=>{if(e.level===3||e.level==='error')report.errors.push(e.message);});captureErrors(win);
 const js=code=>win.webContents.executeJavaScript(code,true),wait=async(fn,label)=>{const until=Date.now()+60000;while(Date.now()<until){if(await fn())return;await sleep(50);}throw Error('Timeout '+label);};
 await win.loadURL(server.origin);
 await js(`(async()=>{const {StudioEngine}=await import('/engine.js'),init=StudioEngine.prototype.init;StudioEngine.prototype.init=async function(...args){window.qaEngine=this;return init.apply(this,args);};document.querySelector('#import-top').click();})()`);
 await wait(()=>js("window.qaEngine?.decks[0].track?.analysisStatus==='ready'"),'native worker analysis');
 report.original=await js('window.qaEngine.decks.map(d=>d.track?({bpm:d.track.bpm,tempoConfidence:d.track.tempoConfidence,beatStability:d.track.beatStability,landmarks:d.track.arrangement?.landmarks.length,analysisVersion:d.track.analysisVersion}):null)');
 const originalBpm=await js('window.qaEngine.decks[0].track.bpm');
 await js("document.querySelector('.deck-a .bpm-half').click();true");
 assert.equal(await js('window.qaEngine.decks[0].track.manualGrid'),true);
 assert.equal(await js('window.qaEngine.decks[0].track.arrangement.bpm'),originalBpm/2);
 await js("document.querySelector('.deck-a .bpm-double').click();true");assert.equal(await js('window.qaEngine.decks[0].track.bpm'),originalBpm);
 report.checks.push({name:'Half/double tempo marks a manual grid and refreshes its arrangement map'});
 await js("(async()=>{await window.qaEngine.seek(0,window.qaEngine.decks[0].track.downbeat);document.querySelector('.deck-a .grid-anchor').click();})()");
 assert.ok(await js('window.qaEngine.decks[0].track.arrangement.landmarks.length>0'));
 await js("document.querySelector('.deck-a .play').click();true");await wait(()=>js('window.qaEngine.decks[0].playing'),'play');
 await js("window.qaVoice=window.qaEngine.decks[0].source;document.querySelector('.deck-a .analysis-open').click();true");
 await wait(()=>js("document.querySelector('.arrangement-row button[data-action=in]:not(:disabled)')?.checkVisibility()"),'reachable arrangement controls');
 const inPoint=await js("(()=>{const b=document.querySelector('.arrangement-row button[data-action=in]:not(:disabled)');return window.qaEngine.decks[0].track.arrangement.landmarks[Number(b.dataset.index)].time;})()");
 await js("document.querySelector('.arrangement-row button[data-action=in]:not(:disabled)').click();true");
 assert.equal(await js('window.qaEngine.decks[0].track.mixIn'),inPoint);assert.equal(await js('window.qaEngine.decks[0].track.manualRegions'),true);assert.equal(await js('window.qaEngine.decks[0].source===window.qaVoice'),true);
 const outPoint=await js("(()=>{const b=[...document.querySelectorAll('.arrangement-row button[data-action=out]:not(:disabled)')].at(-1);return window.qaEngine.decks[0].track.arrangement.landmarks[Number(b.dataset.index)].time;})()");
 await js("[...document.querySelectorAll('.arrangement-row button[data-action=out]:not(:disabled)')].at(-1).click();true");assert.equal(await js('window.qaEngine.decks[0].track.mixOut'),outPoint);assert.equal(await js('window.qaEngine.decks[0].source===window.qaVoice'),true);
 report.checks.push({name:'Visible analysis controls set valid manual IN/OUT without replacing the playing source',inPoint,outPoint});
 await js("document.querySelector('.arrangement-row button[data-action=seek]').click();true");await sleep(100);assert.equal(await js('window.qaEngine.decks[0].playing'),true);assert.ok(Math.abs(await js('window.qaEngine.position(0)-window.qaEngine.decks[0].track.arrangement.landmarks[0].time'))<.5);
 report.checks.push({name:'Go to landmark seeks the real playing deck and preserves playback'});
 for(const skin of ['obsidian','porcelain']){
  await js("document.querySelector('#analysis-dialog').close();document.querySelector('[data-skin-choice="+skin+"]').click();document.querySelector('.deck-a .analysis-open').click();true");
  for(const width of [1440,480]){win.setSize(width,width===480?860:960);await sleep(300);assert.ok(await js("document.querySelector('.arrangement-view').scrollWidth<=document.querySelector('.arrangement-view').clientWidth+1"));assert.ok(await js("document.querySelector('#analysis-dialog').getBoundingClientRect().width<=innerWidth"));report.viewports.push({skin,width,passed:true});if(width===1440){await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await fs.writeFile(out+'/Sillora-Arrangement-'+skin+'.png',(await win.webContents.capturePage()).toPNG());}}
  win.setSize(1440,960);
 }
 report.checks.push({name:'Analysis structure panel remains usable in Obsidian and Porcelain'});
 await js("document.querySelector('#analysis-dialog').close();true");
 await js("[...document.querySelectorAll('[data-load=\"1\"]')].find(b=>b.dataset.id!==window.qaEngine.decks[0].track.id).click();true");await wait(()=>js("window.qaEngine.decks[1].track?.analysisStatus==='ready'"),'second MP3 worker analysis');
 report.original[1]=await js('({bpm:window.qaEngine.decks[1].track.bpm,tempoConfidence:window.qaEngine.decks[1].track.tempoConfidence,beatStability:window.qaEngine.decks[1].track.beatStability,landmarks:window.qaEngine.decks[1].track.arrangement.landmarks.length})');
 await js("(async()=>{await window.qaEngine.seek(1,window.qaEngine.decks[1].track.downbeat);document.querySelector('.deck-b .grid-anchor').click();})()");assert.equal(await js('window.qaEngine.decks[0].playing'),true);assert.ok(await js('window.qaEngine.decks[1].track.arrangement.landmarks.every(p=>Number.isFinite(p.time))'));
 report.checks.push({name:'Second real MP3 is analyzed and its corrected grid does not stop the other deck',landmarks:await js('window.qaEngine.decks[1].track.arrangement.landmarks.length')});
 const status=await remote.start(),link=status.links.find(l=>l.origin.includes('127.0.0.1'));
 phone=new BrowserWindow({show:false,width:390,height:844,webPreferences:{sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}});captureErrors(phone);await phone.loadURL(link.url);const web=code=>phone.webContents.executeJavaScript(code,true);
 await web("window.qaLabels=new Set();const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(/^R\\d+$/.test(text))window.qaLabels.add(text);return original.call(this,text,...args);};true");
 await wait(()=>web('window.qaLabels.size>0'),'Remote arrangement wave markers');assert.ok(await web('document.documentElement.scrollWidth-innerWidth')<=1);
 report.checks.push({name:'Paired Remote draws the transmitted arrangement flags at phone width',labels:await web('[...window.qaLabels]')});
 report.arrangement=await js('window.qaEngine.decks[0].track.arrangement');
 await js("document.querySelector('.deck-a .analysis-open').click();window.qaOldTrack=window.qaEngine.decks[0].track;window.qaOldIn=window.qaOldTrack.mixIn;window.qaStaleIn=document.querySelector('.arrangement-row button[data-action=in]:not(:disabled)');window.qaEngine.load(0,window.qaEngine.decks[1].track);window.qaNewCue=window.qaEngine.decks[0].cue;window.qaNewPosition=window.qaEngine.position(0);window.qaStaleIn.click();true");
 assert.equal(await js('window.qaOldTrack.mixIn===window.qaOldIn'),true);assert.equal(await js('window.qaEngine.decks[0].cue===window.qaNewCue'),true);assert.equal(await js('window.qaEngine.position(0)===window.qaNewPosition'),true);
 await js("window.qaEngine.load(0,window.qaOldTrack);document.querySelector('.deck-a .analysis-open').click();window.qaStaleSeek=document.querySelector('.arrangement-row button[data-action=seek]');window.qaEngine.load(0,window.qaEngine.decks[1].track);window.qaNewPosition=window.qaEngine.position(0);window.qaStaleSeek.click();true");await sleep(80);assert.equal(await js('window.qaEngine.position(0)===window.qaNewPosition'),true);
 report.checks.push({name:'A stale analysis action cannot edit the old track or seek/change the replacement deck'});
 const kept=await js('({id:window.qaOldTrack.id,bpm:window.qaOldTrack.bpm,in:window.qaOldTrack.mixIn,out:window.qaOldTrack.mixOut})');
 await wait(()=>Promise.resolve(Boolean(catalog?.records?.some(r=>r.id===kept.id&&r.meta?.manualRegions))),'saved preparation metadata');
 simulateCacheUpgrade=true;for(const r of catalog.records)if(r.meta?.contentKey)r.meta.contentKey=r.meta.contentKey.replace(/:region2$/,':region1');
 await js("localStorage.removeItem('sillage:preparation');true");await win.loadURL(server.origin);
 await js(`(async()=>{const {StudioEngine}=await import('/engine.js'),init=StudioEngine.prototype.init;StudioEngine.prototype.init=async function(...args){window.qaEngine=this;return init.apply(this,args);};})()`);
 await wait(()=>js("document.querySelector('#local-count').textContent==='2'"),'upgrade catalog restore');
 await js(`document.querySelector('[data-source=local]').click();document.querySelector('[data-load="0"][data-id="${kept.id}"]').click();true`);
 await wait(()=>js("window.qaEngine?.decks[0].track?.analysisStatus==='ready'"),'upgraded track analysis');
 const restored=await js('({bpm:window.qaEngine.decks[0].track.bpm,in:window.qaEngine.decks[0].track.mixIn,out:window.qaEngine.decks[0].track.mixOut,manualGrid:window.qaEngine.decks[0].track.manualGrid,manualRegions:window.qaEngine.decks[0].track.manualRegions,playing:window.qaEngine.decks.some(d=>d.playing)})');
 assert.equal(restored.bpm,kept.bpm);assert.equal(restored.in,kept.in);assert.equal(restored.out,kept.out);assert.equal(restored.manualGrid,true);assert.equal(restored.manualRegions,true);assert.equal(restored.playing,false);
 report.checks.push({name:'Catalog preparations survive region-cache version migration without localStorage fallback or autoplay',restored});
 assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(error){report.failure=error.stack;if(win&&!win.isDestroyed())await fs.writeFile(out+'/Failure.png',(await win.webContents.capturePage()).toPNG());}
 finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));phone?.destroy();win?.destroy();await remote?.stop();server?.close();app.exit(report.passed?0:1);}
});
