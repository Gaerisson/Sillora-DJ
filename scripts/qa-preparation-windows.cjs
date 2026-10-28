const {app,BrowserWindow,ipcMain,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.SILLORA_QA_OUT||path.join(root,'.runtime','preparation-proof','results')),music=process.argv.slice(2);
if(music.length!==2){console.error('Usage : npm run test:preparation:windows -- "piste-A.mp3" "piste-B.opus"');app.exit(2);}
require('node:fs').mkdirSync(out,{recursive:true});app.setPath('userData',out+'/profile-'+Date.now());
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');app.commandLine.appendSwitch('disable-background-timer-throttling');app.on('window-all-closed',()=>{});
const report={passed:false,checks:[],viewports:[],errors:[],scope:'Real audio import/worker analysis through production preload. Draft grid preparation, native transport, conflict protection and content-linked persistence. This recipe does not test paired Remote. No manual ground truth or listening-quality certification.'};
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
 await js("document.querySelector('.deck-a .analysis-open').click();window.qaBaseline=JSON.stringify(window.qaEngine.decks[0].track.analysis);window.qaBpm=window.qaEngine.decks[0].track.bpm;true");
 await wait(()=>js("document.querySelector('.grid-detail').getBoundingClientRect().width>0"),'visible grid editor');
 const baseline=await js('({bpm:window.qaBpm,downbeat:window.qaEngine.decks[0].track.downbeat})');
 await js("(async()=>{await window.qaEngine.seek(0,10.123);document.querySelector('[data-grid=anchor]').click();document.querySelector('[data-grid=later]').click();})()");
 assert.ok(Math.abs(await js("Number(document.querySelector('.grid-anchor-time').value)")-10.128)<.00001);
 assert.equal(await js('window.qaEngine.decks[0].track.downbeat'),baseline.downbeat);
 report.checks.push({name:'Native anchor and 5 ms shift change only a draft, leaving the measured track intact'});
 await js("document.querySelector('[data-grid=apply]').click();true");
 assert.equal(await js('window.qaEngine.decks[0].track.downbeat'),10.128);assert.equal(await js('window.qaEngine.decks[0].track.manualGrid'),true);
 await js("document.querySelector('[data-grid=play]').click();true");await wait(()=>js('window.qaEngine.decks[0].playing'),'native preview transport');
 await js("window.qaVoice=window.qaEngine.decks[0].source;document.querySelector('[data-grid=earlier]').click();document.querySelector('[data-grid=apply]').click();true");
 assert.equal(await js('window.qaEngine.decks[0].source===window.qaVoice'),true);assert.equal(await js('JSON.stringify(window.qaEngine.decks[0].track.analysis)===window.qaBaseline'),true);
 await js("document.querySelector('[data-grid=play]').click();true");
 report.checks.push({name:'Applying preparation while playing retains the real native source, rate and automatic analysis baseline'});
 await js("(async()=>{const e=window.qaEngine;await e.seek(0,12.25);document.querySelector('[data-grid=start]').click();await e.seek(0,28.25);document.querySelector('[data-grid=end]').click();document.querySelector('.grid-beats').value='32';document.querySelector('[data-grid=calibrate]').click();})()");
 assert.equal(await js("Number(document.querySelector('.grid-bpm').value)"),120);assert.equal(await js('window.qaEngine.decks[0].track.bpm'),baseline.bpm);
 await js("document.querySelector('[data-grid=apply]').click();true");assert.equal(await js('window.qaEngine.decks[0].track.bpm'),120);assert.equal(await js('window.qaEngine.decks[0].track.downbeat'),12.25);
 report.checks.push({name:'Explicit two-impact/32-beat calibration yields 120 BPM and preserves native precision on apply'});
 await js("document.querySelector('[data-grid=restore]').click();true");assert.equal(await js('window.qaEngine.decks[0].track.manualGrid'),true);
 await js("document.querySelector('[data-grid=apply]').click();true");assert.equal(await js('window.qaEngine.decks[0].track.manualGrid'),false);assert.equal(await js('window.qaEngine.decks[0].track.bpm'),baseline.bpm);
 report.checks.push({name:'Restore previews the measured grid before application and clears the manual override only after apply'});
 const clickCanvas=async(selector,xFraction)=>{await js(`document.querySelector('${selector}').scrollIntoView({block:'center'});true`);await sleep(80);const r=await js(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.x+r.width*${xFraction},y:r.y+r.height/2};})()`);win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(r.x),y:Math.round(r.y),button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(r.x),y:Math.round(r.y),button:'left',clickCount:1});await sleep(200);};
 await clickCanvas('#analysis-map',.45);const duration=await js('window.qaEngine.decks[0].track.buffer.duration');assert.ok(Math.abs(await js('window.qaEngine.position(0)')-duration*.45)<.5);
 await js("document.querySelector('[data-grid=anchor]').click();document.querySelector('[data-grid=apply]').click();true");const corrected=await js('({bpm:window.qaEngine.decks[0].track.bpm,downbeat:window.qaEngine.decks[0].track.downbeat,id:window.qaEngine.decks[0].track.id})');
 report.checks.push({name:'Actual mouse input on the overview seeks the native paused deck and can anchor the grid at that position'});
 await js("document.querySelector('[data-grid=later]').click();window.qaEngine.setGrid(0,{bpm:126,downbeat:1.234});true");await sleep(60);
 assert.equal(await js("document.querySelector('[data-grid=apply]').disabled"),true);
 await js("document.querySelector('[data-grid=reload]').click();true");assert.equal(await js("Number(document.querySelector('.grid-bpm').value)"),126);
 await js(`window.qaEngine.setGrid(0,{bpm:${corrected.bpm},downbeat:${corrected.downbeat}});document.querySelector('[data-grid=reload]').click();document.querySelector('[data-grid=later]').click();document.querySelector('[data-grid=apply]').click();true`);
 corrected.downbeat+=.005;assert.ok(Math.abs(await js('window.qaEngine.decks[0].track.downbeat')-corrected.downbeat)<1e-7);
 report.checks.push({name:'External grid changes invalidate the draft and require explicit reload before another edit'});
 for(const skin of ['obsidian','porcelain']){
  await js("document.querySelector('#analysis-dialog').close();document.querySelector('[data-skin-choice="+skin+"]').click();document.querySelector('.deck-a .analysis-open').click();true");
  for(const width of [1440,480]){win.setSize(width,width===480?900:1000);await sleep(250);assert.ok(await js("document.querySelector('.grid-editor').scrollWidth<=document.querySelector('.grid-editor').clientWidth+1"));assert.ok(await js("document.querySelector('#analysis-dialog').getBoundingClientRect().width<=innerWidth"));await js("document.querySelector('.grid-editor').scrollIntoView({block:'center'});true");assert.ok(await js("document.querySelector('.grid-position').textContent.length>0"),'Reopened editor animation must remain active');const painted=await js("(()=>{const c=document.querySelector('.grid-detail'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n/(c.width*c.height);})()");assert.ok(painted>.9,'Detailed waveform must actually paint');report.viewports.push({skin,width,passed:true,painted});await sleep(120);await fs.writeFile(out+'/Sillora-Preparation-'+skin+'-'+width+'.png',(await win.webContents.capturePage()).toPNG());}
 }
 report.checks.push({name:'Actual editor renders without horizontal overflow at 1440 and 480 px in both themes'});win.setSize(1440,1000);
 await wait(()=>Promise.resolve(Boolean(catalog?.records?.some(r=>r.id===corrected.id&&r.meta?.manualGrid&&Math.abs(r.meta.downbeat-corrected.downbeat)<1e-7))),'catalog saves manual preparation');
 await js("document.querySelector('#analysis-dialog').close();true");
 await js("[...document.querySelectorAll('[data-load]')].find(b=>b.dataset.load==='1'&&b.dataset.id!==window.qaEngine.decks[0].track.id).click();true");await wait(()=>js("window.qaEngine.decks[1].track?.analysisStatus==='ready'"),'second audio file');
 await js("document.querySelector('.deck-a .analysis-open').click();window.qaOld=window.qaEngine.decks[0].track;window.qaBefore=window.qaOld.downbeat;window.qaStale=document.querySelector('[data-grid=apply]');document.querySelector('[data-grid=later]').click();window.qaEngine.load(0,window.qaEngine.decks[1].track);window.qaReplacementGrid=window.qaEngine.decks[0].track.downbeat;window.qaStale.click();true");
 assert.equal(await js('window.qaOld.downbeat'),await js('window.qaBefore'));assert.equal(await js('window.qaEngine.decks[0].track.downbeat'),await js('window.qaReplacementGrid'));
 report.checks.push({name:'An obsolete editor cannot change the old preparation or its replacement track'});
 await js("localStorage.removeItem('sillage:preparation');true");await win.loadURL(server.origin);
 await js(`(async()=>{const {StudioEngine}=await import('/engine.js'),init=StudioEngine.prototype.init;StudioEngine.prototype.init=async function(...args){window.qaEngine=this;return init.apply(this,args);};})()`);
 await wait(()=>js("document.querySelector('#local-count').textContent==='2'"),'catalog restore');
 await js(`document.querySelector('[data-source=local]').click();document.querySelector('[data-load="0"][data-id="${corrected.id}"]').click();true`);await wait(()=>js("window.qaEngine?.decks[0].track?.analysisStatus==='ready'"),'restored native file');
 assert.equal(await js('window.qaEngine.decks[0].track.bpm'),corrected.bpm);assert.ok(Math.abs(await js('window.qaEngine.decks[0].track.downbeat')-corrected.downbeat)<1e-7);assert.equal(await js('window.qaEngine.decks[0].track.manualGrid'),true);assert.equal(await js('window.qaEngine.decks.some(d=>d.playing)'),false);
 report.checks.push({name:'Renderer restart with localStorage preparations removed restores the content-linked native catalog correction without autoplay',restored:corrected});
 assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(error){report.failure=error.stack;if(win&&!win.isDestroyed())await fs.writeFile(out+'/Failure.png',(await win.webContents.capturePage()).toPNG());}
 finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));phone?.destroy();win?.destroy();await remote?.stop();server?.close();app.exit(report.passed?0:1);}
});
