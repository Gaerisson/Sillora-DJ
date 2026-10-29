import {tempoRampSnapshot} from './remote-clock.mjs';
import {updateTempoControl} from './tempo-control.mjs';
import {effectiveStemGain} from './stem-mix.mjs';
import {Workspace} from './workspace.js';
import {mountGridEditor} from './grid-editor-view.js';
import {gridStatus,gridDetail} from './grid-status.mjs';
import {audioContentId} from './audio-identity.mjs';
import {overlapSummary} from './mix-density.mjs';
import {mountPhraseEditor} from './phrase-editor.js';
import {readPhraseCues} from './phrase-cues.mjs';
import {renderArrangement} from './arrangement-view.js';
import {mixRegionPatch} from './studio-tools.mjs';
import {KeyLockSettings} from './keylock-settings.js';
import {LiveMixer} from './live-mixer.js';
import {LiveSettings} from './audio-settings.js';
import {ProgramSettings} from './program-settings.js';
import {mountConsoleLayout} from './console-layout.js';
import {newBranding} from './branding.js';
import {DownloadPanel} from './download-panel.js';
import {ArtworkPanel} from './artwork-panel.js';
import {readCover,writeCover} from './cover-cache.mjs';
import {SampleBank} from './sample-bank.mjs';
import {SampleBankPanel} from './sample-bank-panel.js';
import {bindWaveSeek} from './wave-seek.mjs';
import {RemotePanel} from './remote-panel.js';
import {DJSession} from './dj-session.mjs';
import {AutomixScheduler} from './automix-scheduler.mjs';
import {NextPreparation} from './next-preparation.mjs';
import {LibraryImports} from './library-imports.mjs';
import {loadLibrary,saveLibrary} from './library-store.mjs';
import {LibraryJobsView} from './library-jobs-view.js';
import {mountAudioMeters} from './audio-meter-view.js';
import {camelotKey,keyLabel,rankCandidates,sortTracks,selectionModes,harmonicCompatibility,selectNextTrack} from './dj-library.mjs';
import {drawDJWaveform} from './dj-waveform.mjs';
import {FolderBrowser} from './folder-browser.js';
import {Appearance} from './appearance.js';
import {tempoMean,tempoFraction,warpTempoCurve} from './tempo-automation.mjs';
import {transitionCatalog,transitionName,faderCurves,textureNames} from './transition-design.mjs';
import { StudioEngine, createDemo } from './engine.js';
import { clamp, transitionSeconds } from './audio-math.mjs';
import {nextMusicalTime,makeTransitionPlan} from './analysis.mjs';
import {transitionPresets,sanitizePreferences,trackKey,fileKey,trackPreparation,restorePreparation,moveQueueItem,smoothQueue,TapTempo,csvTracklist} from './studio-tools.mjs';
import {MixRecorder} from './recording.mjs';
import {StemSettings} from './stem-settings.js';
import {stemProgressLabel} from './stem-budget.mjs';
import {prepareStems,stemNames,stemLabels} from './stems.mjs';

const stemControllers=new Map();
const stemSettings=new StemSettings({desktop:window.sillageDesktop,getActive:()=>[...stemControllers.keys()][0],cancel:()=>{for(const c of stemControllers.values())c.abort();window.sillageDesktop?.cancelActiveStems?.().catch(()=>{});},onChange:()=>update(),onError:error=>toast(error.message)});

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const time = seconds => `${Math.floor(Math.max(0, seconds || 0) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds || 0) % 60).toString().padStart(2, '0')}`;
const icons = {
  settings: '<path d="m9 3 1-1h4l1 1 .5 2 2 1 2-.5 2 3-1 2v3l1 2-2 3-2-.5-2 1-.5 2-1 1h-4l-1-1-.5-2-2-1-2 .5-2-3 1-2v-3l-1-2 2-3 2 .5 2-1Z"/><circle cx="12" cy="11.5" r="3"/>',
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3L12 17.3l-5.7 3 1.1-6.3L3 9.6l6.2-.9Z"/>',
  music:'<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  sliders:'<path d="M4 4v16M12 4v16M20 4v16M1 8h6M9 15h6M17 10h6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v5M17.5 4.5h5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  headphones:'<path d="M3 13v-1a9 9 0 0 1 18 0v1M3 12h4v9H5a2 2 0 0 1-2-2Zm18 0h-4v9h2a2 2 0 0 0 2-2Z"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  pause:'<path d="M7 5h3v14H7ZM14 5h3v14h-3Z"/>',
  loop:'<path d="M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();

const groups=[...new Set(transitionCatalog.map(item=>item.group))];$('#transition-style').innerHTML=groups.map(group=>'<optgroup label="'+group+'">'+transitionCatalog.filter(item=>item.group===group).map(item=>'<option value="'+item.id+'">'+item.label+'</option>').join('')+'</optgroup>').join('');
if(document.querySelector('.lab-count'))document.querySelector('.lab-count').textContent=transitionCatalog.length+' MODES';
const appearance=new Appearance();
const engine = new StudioEngine({keyLockProfile:readStorage('sillage:preferences',{})?.keyLockProfile});let keyLockSettings=null;
const sampleBank=new SampleBank(engine);
const liveMixer=new LiveMixer(engine),audioIO=liveMixer.primary;let audioSettings=null,consoleLayout=null,programSettings=null,meterViews=null,brand=null,sourcesPanel=null,pumpQuick=null,lastPumpUI=0;
const remotePanel=new RemotePanel($('#remote-settings'));
const preferences=sanitizePreferences(readStorage('sillage:preferences',{}));
if(!localStorage.getItem('sillage:musical-v9')){Object.assign(preferences,{style:'auto',profile:'musical',beats:32,intensity:.65});writeStorage('sillage:preferences',preferences);localStorage.setItem('sillage:musical-v9','1');}
if(!localStorage.getItem('gaerisson:tempo-v15')){preferences.tempoBlend=true;writeStorage('sillage:preferences',preferences);localStorage.setItem('gaerisson:tempo-v15','1');}
const savedPreparation=readStorage('sillage:preparation',{});
const recorder=new MixRecorder(),tapTempos=[new TapTempo(),new TapTempo()],eraseCues=[false,false];
const visibleRanges=[[0,1],[0,1]],cueColors=[...appearance.colors.cues];
let waveZoom=preferences.zoom,lastQueue=null,recordUrl=null,recordResult=null,sortBy='order',queueDragIndex=null,importing=false,tracklistUrl=null;
const tracks = [], queue = [], prepared = [false, false];
let libraryPage=0,libraryCount=0,librarySaveTimer,libraryEvictionPending=false,libraryJobsView,libraryLoadSequence=[0,0],pendingLibraryLoads=[null,null];
const library=new LibraryImports({decode:decodeLibraryFile,canRun:job=>job.manual||job.priority<=5||(!engine.transition&&!stemControllers.size&&(library.bufferBytes||0)<384*1024*1024)});
library.addEventListener('ready',({detail:{track}})=>{if(!tracks.includes(track))tracks.push(track);});
library.addEventListener('change',()=>{renderLibrary();clearTimeout(librarySaveTimer);librarySaveTimer=setTimeout(()=>saveLibrary(library.snapshot()).catch(()=>toast('Impossible de mémoriser cet import.')),350);scheduleLibraryBudget();});
library.addEventListener('ready',()=>{renderLibrary();scheduleLibraryBudget();});
function libraryRows(){const known=new Set(tracks.map(t=>t.id));return [...tracks,...library.rows().filter(t=>!known.has(t.id))];}
function reprioritizeLibrary(visible){const priorities=new Map(),assign=(id,priority)=>{if(id)priorities.set(id,Math.min(priority,priorities.get(id)??100));};for(const record of library.records.values())if(viewedScope&&record.scope?.path===viewedScope.path)assign(record.id,35);for(const t of visible)assign(t.id,20);queue.forEach((id,i)=>assign(id,i===0?5:10));for(const d of engine.decks)assign(d.track?.id,0);library.setPriorities(priorities);engine.analysisQueue.setPriorities(priorities);}
function libraryTrack(id){return tracks.find(t=>t.id===id)||library.rows().find(t=>t.id===id);}
function scheduleLibraryBudget(){if(libraryEvictionPending)return;libraryEvictionPending=true;queueMicrotask(()=>{libraryEvictionPending=false;library.evict({pinned:new Set(engine.decks.map(d=>d.track))});library.drainSoon();updateLibraryJobs();});}
function updateLibraryJobs(){libraryJobsView?.update({batch:library.batch,active:library.active,analysis:engine.analysisQueue.state,records:library.records.size,bytes:library.bufferBytes,page:libraryPage,total:libraryCount,restored:!library.batch&&Boolean(library.restoredBatch?.keys?.some(id=>!library.restoredBatch.completed?.includes(id)))});}
async function bindSavedLibrary(){if(!window.sillageDesktop?.library)return;const entries=await window.sillageDesktop.library();library.bind(desktopFiles(entries));}
async function ensureLibraryTrack(id,priority=0){const record=library.get(id);if(record&&!record.file)await bindSavedLibrary();if(record?.file?.token)await window.sillageDesktop?.rememberAudio?.([record.file.token]).catch(()=>{});return record?library.ensure(id,{priority}):tracks.find(t=>t.id===id);}
async function requestLibraryLoad(id,target){const sequence=++libraryLoadSequence[target],previous=engine.decks[target].track;stopAutomix();pendingLibraryLoads[target]=id;update();try{const t=await ensureLibraryTrack(id,0);if(sequence!==libraryLoadSequence[target]||engine.decks[target].track!==previous||engine.decks[target].playing||engine.decks[target].playRequest)return null;loadDeck(target,t);renderLibrary();return t;}finally{if(sequence===libraryLoadSequence[target])pendingLibraryLoads[target]=null;update();}}
async function resumeLibraryImport(){if(library.batch?.state==='paused'){library.resume();return;}await bindSavedLibrary();const b=library.batch||library.restoredBatch,done=new Set(b?.completed||[]),files=(b?.keys||[]).filter(id=>!done.has(id)).map(id=>library.get(id)?.file).filter(Boolean);if(!files.length){renderLibrary();return toast('Resélectionnez les fichiers absents pour reprendre.');}const missing=(b?.keys||[]).filter(id=>!done.has(id)&&!library.get(id)?.file);library.restoredBatch=null;const result=await importFiles(files,null,{autoLoad:false});if(missing.length&&library.batch){library.batch.keys.push(...missing);library.batch.errors+=missing.length;library.emit();toast(missing.length+' fichier(s) absent(s), à resélectionner.');}return result;}
async function decodeLibraryFile(file,record,signal){
 if(record.track){const t=record.track,decoded=await engine.decodeFile(file,{signal});if(t.contentKey&&audioContentId(t.contentKey)!==audioContentId(decoded.contentKey))throw new Error('Ce fichier a changé. Actualisez le dossier puis réimportez-le.');signal.throwIfAborted();t.buffer=decoded.buffer;t.contentKey=decoded.contentKey;t.decodeMs=decoded.decodeMs;return t;}
 const t=await engine.importFile(file,{deferAnalysis:true,priority:record.priority,id:record.id,signal});t.fileKey=record.key;t.legacyFileKey=JSON.stringify([file.name,file.size,file.lastModified]);
 let metadata=file.metadata;if(!metadata&&file.readMetadata)try{metadata=await file.readMetadata();}catch{}signal.throwIfAborted();
 if(metadata)for(const field of ['title','artist','album','year','cover','license','link','provider'])if(metadata[field])t[field]=metadata[field];if(metadata?.provider)t.source=metadata.provider;
 if(record.scope)attachFolder([t],record.scope);t.detectedKey={key:t.key,keyRoot:t.keyRoot,keyMode:t.keyMode,keyConfidence:t.keyConfidence};const specific=savedPreparation[t.fileKey]||savedPreparation[t.legacyFileKey],related=library.byContent.get(audioContentId(t.contentKey)),preparation=specific||(audioContentId(record.meta?.contentKey)===audioContentId(t.contentKey)?record.meta:null)||related?.meta;if(preparation)restorePreparation(t,preparation);if(specific)record.userUpdatedAt=Date.now();else if(!record.meta?.contentKey&&related)record.userUpdatedAt=related.userUpdatedAt||0;if(record.favorite!==undefined)t.favorite=record.favorite;
 const savedCover=await readCover(t.fileKey)||await readCover(t.legacyFileKey);if(savedCover)t.cover=savedCover;signal.throwIfAborted();scheduleArtwork(t);return t;
}
const djSession=new DJSession();let viewedScope=null,visualPlan=null,visualPlanSource=0,recommendationSignature='',recommendationIds=[];
const folderBrowser=new FolderBrowser($('#folder-browser'),{onError:message=>toast(message),onScopeChanged:scope=>{viewedScope=scope;const entries=library.discover(desktopFiles(scope.files)),present=new Set(entries.map(r=>r.key));for(const r of library.records.values())if(r.scope?.path===scope.path&&!present.has(r.key)){r.file=null;r.state='missing';}for(const r of entries)r.scope={id:scope.id,path:scope.path,name:scope.name};library.emit();},onImport:async(entries,target,addQueue,scope)=>{if(target!==null)stopAutomix();const imported=await importDesktop(entries,target)||[];attachFolder(imported,scope);if(addQueue)replaceQueue([...queue,...imported.map(t=>t.id)]);update();},onAutomix:(entries,scope,mode)=>startFolderAutomix(entries,scope,mode)});
let setLaunch=0,nextPreparation=null,automixImportLaunch=null;
let source = 'local', automix = false, autoBusy = false, toastTimer, fileDeck = null, sessionStart = null, demoLoaded = false;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5500); }
function readStorage(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;}catch{return fallback;}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('La mémorisation locale est indisponible. Le studio reste utilisable pendant cette session.');}}
function savePreparation(track){if(!track)return;const key=trackKey(track);delete savedPreparation[key];savedPreparation[key]=trackPreparation(track);const keys=Object.keys(savedPreparation);while(keys.length>500)delete savedPreparation[keys.shift()];writeStorage('sillage:preparation',savedPreparation);library.touch(track,{user:true});}
function rememberTrack(track){return restorePreparation(track,savedPreparation[trackKey(track)]||savedPreparation[track.legacyFileKey]);}
function savePreferences(){Object.assign(preferences,{keyLockProfile:engine.keyLockProfile,view:document.body.dataset.view||'decks',zoom:waveZoom,master:engine.masterVolume,style:$('#transition-style').value,profile:$('#set-profile').value,intensity:Number($('#transition-intensity').value),beats:Number($('#transition-beats').value),sync:$('#tempo-sync').checked,tempoBlend:$('#tempo-blend').checked,protectOverlap:$('#overlap-protect').checked,tempoShape:$('#tempo-shape').value,maxTempoPercent:Number($('#tempo-limit').value),alignArrival:$('#align-arrival').checked,quantize:$('#quantize').checked});writeStorage('sillage:preferences',preferences);}
function stopAutomix(){automix=false;setLaunch++;nextPreparation?.invalidate({clearFailures:true});automixScheduler.reset();engine.releaseContinuity(0);engine.releaseContinuity(1);engine.cancelTransition();update();}
function preciseTime(value){return time(value)+'.'+Math.floor((value%1)*100).toString().padStart(2,'0');}
function replaceQueue(next){lastQueue=[...queue];queue.splice(0,queue.length,...next);renderLibrary();}
async function run(action) { try { return await action(); } catch (error) { toast(error.message || 'Une erreur est survenue.'); } }
$$('.deck').forEach((el, id) => {
  const letter = id ? 'B' : 'A';
  el.innerHTML = `<div class="deck-titlebar"><span class="deck-number">${letter}</span><div class="deck-track"><h2>Chargez un morceau</h2><p>Déposez un titre de votre collection</p></div><button class="deck-load" aria-label="Importer sur la platine ${letter}" title="Importer un morceau">${icon('download')}</button></div><div class="deck-summary"><label class="tempo"><input class="bpm-input" aria-label="BPM platine ${letter}" type="number" min="40" max="240" step="0.1" placeholder="—"><span>BPM</span></label><div class="deck-timing"><div class="elapsed">00:00</div><div class="remaining">− 00:00</div></div></div><div class="deck-visual"><div class="vinyl"><span class="vinyl-marker"></span><div class="vinyl-label"><span>SILLORA</span><b>SIDE ${letter}</b></div></div><label class="pitch-area"><span>TEMPO</span><input type="range" class="pitch" min="-16" max="16" value="0" step="0.1" aria-label="Vitesse platine ${letter}"><output>+0.0%</output></label></div><div class="waveform-wrap"><canvas class="waveform" width="600" height="94" aria-label="Forme d’onde platine ${letter}" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></canvas><div class="waveform-label">AUCUN SIGNAL</div></div><div class="transport"><div class="transport-primary"><button class="control cue" title="Retour au cue · Maj + clic : définir le cue">CUE</button><button class="control play" aria-label="Lire platine ${letter}">${icon('play')}</button><button class="control sync" title="Synchroniser le BPM et la phase avec l’autre platine">SYNC</button></div><div class="transport-secondary"><button class="control echo" title="Écho synchronisé au tempo">FX</button><select class="loop-size" aria-label="Longueur de boucle ${letter}"><option value="4">4</option><option value="8">8</option><option value="16">16</option></select><button class="control loop" aria-label="Boucle platine ${letter}" title="Activer / désactiver la boucle">${icon('loop')}</button></div></div>`;
  el.querySelector('.play').onclick = () => run(async () => { await prepareLocalPlayback(); if(automix)stopAutomix();if(engine.decks[id].playRequest)engine.pause(id);else if(engine.decks[id].playing)await engine.brake(id);else await engine.play(id); if (engine.decks[id].playing) sessionStart ??= Date.now(); });
  el.querySelector('.cue').onclick = event => run(async () => {
    const d = engine.decks[id]; if (!d.track) return;
    if (event.shiftKey) { d.cue = engine.position(id); toast(`Point Cue ${letter} défini à ${time(d.cue)}.`); }
    else { engine.cancelTransition(); engine.pause(id); await engine.seek(id, d.cue); }
  });
  el.querySelector('.sync').onclick = () => run(() => engine.sync(id));
  el.querySelector('.echo').textContent='ECHO';
  el.querySelector('.echo').onclick = () => { if (!engine.decks[id].track) return; engine.setEcho(id, !engine.decks[id].echo); update(); };
  el.querySelector('.loop').title='Boucle sur la grille · Maj + clic : capture immédiate';
  el.querySelector('.loop').onclick = event => { if(automix)stopAutomix();engine.cancelTransition(); engine.loop(id, Number(el.querySelector('.loop-size').value),{quantize:!event.shiftKey&&$('#quantize').checked}); };
  el.querySelector('.bpm-input').onchange = event => { const d = engine.decks[id]; if (d.track) { engine.setGrid(id,{bpm:clamp((Number(event.target.value)||120)/d.rate,40,240),downbeat:d.track.downbeat??d.track.beatOffset??0});savePreparation(d.track);renderLibrary(); update(); } };
  el.querySelector('.pitch').oninput = event => run(() => engine.setRate(id, 1 + Number(event.target.value) / 100));
  el.querySelector('.pitch').ondblclick = () => run(() => engine.setRate(id, 1));
  const keyControl=document.createElement('label');keyControl.className='deck-key';keyControl.innerHTML='CLÉ <select class="deck-key-select" aria-label="Tonalité platine '+letter+'"><option value="auto">Auto · Clé incertaine</option>'+['major','minor'].map(mode=>Array.from({length:12},(_,root)=>'<option value="'+root+':'+mode+'">'+keyLabel({keyRoot:root,keyMode:mode,keyConfidence:1})+'</option>').join('')).join('')+'</select>';el.querySelector('.deck-summary').after(keyControl);
  keyControl.querySelector('select').onchange=event=>{const t=engine.decks[id].track;if(!t)return;engine.cancelTransition();if(event.target.value==='auto'){t.manualKey=false;Object.assign(t,t.detectedKey||{key:null,keyConfidence:0});}else{const [root,mode]=event.target.value.split(':');Object.assign(t,{manualKey:true,keyRoot:Number(root),keyMode:mode,keyConfidence:1});t.key=camelotKey(t).key;}savePreparation(t);renderLibrary();update();};
  bindScratch(el.querySelector('.vinyl'),id);const scratchHint=document.createElement('small');scratchHint.className='scratch-hint';scratchHint.textContent='SCRATCH · maintenir et tourner le vinyle';el.querySelector('.deck-visual').after(scratchHint);
  bindWaveSeek(el.querySelector('.waveform'),{getRange:()=>visibleRanges[id],seek:seconds=>run(async()=>{stopAutomix();await engine.seek(id,seconds);})});
  el.querySelector('.waveform').onkeydown = event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      run(() => engine.seek(id, event.key === 'Home' ? 0 : event.key === 'End' ? (engine.decks[id].track?.buffer.duration || 0) : engine.position(id) + (event.key === 'ArrowRight' ? 5 : -5)));
    }
  };
  el.querySelector('.deck-load').onclick = () => { fileDeck = id; $('#file-input').click(); };
  const regions=document.createElement('div');regions.className='region-controls';regions.innerHTML=`<button class="region-in" title="Définir le point d’entrée au curseur actuel">IN <span>00:00</span></button><button class="region-out" title="Définir le point de sortie au curseur actuel">OUT <span>00:00</span></button><button class="region-reset" title="Restaurer les régions estimées">AUTO</button><button class="grid-confidence analysis-open" title="Voir l’analyse de la piste">ANALYSE</button>`;
  el.querySelector('.transport').before(regions);
  regions.querySelector('.analysis-open').onclick=()=>showAnalysis(id);
  regions.querySelector('.region-in').onclick=()=>{const d=engine.decks[id];if(!d.track)return;const value=engine.position(id);if(value>=(d.track.mixOut??d.track.buffer.duration)-0.1)return toast('Le point d’entrée doit précéder la sortie.');d.track.manualRegions=true;d.track.mixIn=value;d.cue=value;savePreparation(d.track);update();};
  regions.querySelector('.region-out').onclick=()=>{const d=engine.decks[id];if(!d.track)return;const value=engine.position(id);if(value<=(d.track.mixIn||0)+0.1)return toast('Le point de sortie doit suivre l’entrée.');d.track.manualRegions=true;d.track.mixOut=value;savePreparation(d.track);update();};
  regions.querySelector('.region-reset').onclick=()=>{const d=engine.decks[id];if(!d.track)return;d.track.manualRegions=false;d.track.mixIn=d.track.analysis?.mixIn||0;d.track.mixOut=d.track.analysis?.mixOut??Math.max(0,d.track.buffer.duration-16*60/(d.track.bpm||120));d.cue=d.track.mixIn;savePreparation(d.track);update();};
  const status=document.createElement('span');status.className='deck-state';status.textContent='EN ATTENTE';el.querySelector('.deck-load').before(status);
  const waveTools=document.createElement('div');waveTools.className='wave-tools';waveTools.innerHTML=`<span class="beat-dots" aria-label="Repère de mesure"><i></i><i></i><i></i><i></i></span><button class="grid-anchor" title="Placer le premier temps de mesure au curseur actuel">1er temps</button><label>ZOOM <select class="wave-zoom" aria-label="Zoom de la forme d’onde ${letter}"><option value="full">Morceau</option><option value="16">16 temps</option><option value="8">8 temps</option></select></label>`;el.querySelector('.waveform-wrap').before(waveTools);
  const performancePanel=document.createElement('div');performancePanel.className='performance-panel';performancePanel.innerHTML=`<div class="pad-heading"><span>HOT CUES</span><small>Clic : définir / jouer</small><button class="cue-erase" aria-label="Mode effacement des Hot Cues ${letter}" aria-pressed="false" title="Activer l’effacement, ou utiliser Maj + clic sur un pad">Effacer</button></div><div class="hot-cue-pads">${Array.from({length:4},(_,slot)=>`<button class="hot-cue" data-slot="${slot}" style="--cue-color:${cueColors[slot]}"><span>${slot+1}</span><small>＋ DÉFINIR</small></button>`).join('')}</div><div class="beat-tools"><span>BEAT JUMP</span><button class="jump-back" aria-label="Saut rythmique arrière ${letter}">−</button><select class="jump-size" aria-label="Longueur du saut ${letter}"><option value="4">4 temps</option><option value="8">8 temps</option><option value="16">16 temps</option></select><button class="jump-forward" aria-label="Saut rythmique avant ${letter}">＋</button><div class="tempo-tools"><button class="bpm-half" aria-label="Diviser le BPM par deux ${letter}">÷2</button><button class="tap-tempo" aria-label="Tap tempo ${letter}" title="Tapez au moins trois fois au rythme du morceau">TAP</button><button class="bpm-double" aria-label="Doubler le BPM ${letter}">×2</button></div></div>`;el.append(performancePanel);
  performancePanel.querySelector('.cue-erase').onclick=()=>{eraseCues[id]=!eraseCues[id];update();};
  performancePanel.querySelectorAll('.hot-cue').forEach(button=>{button.onclick=event=>run(async()=>{const d=engine.decks[id];if(!d.track)return toast('Chargez un morceau sur cette platine.');const slot=Number(button.dataset.slot);if(event.shiftKey||eraseCues[id]){engine.clearHotCue(id,slot);toast(`Hot Cue ${slot+1} effacé sur ${letter}.`);}else{if(Number.isFinite(d.track.hotCues?.[slot])){await prepareLocalPlayback();stopAutomix();}await engine.triggerHotCue(id,slot);if(d.playing)sessionStart??=Date.now();}savePreparation(d.track);update();});});
  for(const [selector,direction] of [['.jump-back',-1],['.jump-forward',1]])performancePanel.querySelector(selector).onclick=()=>run(async()=>{stopAutomix();await engine.beatJump(id,direction*Number(performancePanel.querySelector('.jump-size').value));});
  const changeBpm=value=>{const d=engine.decks[id];if(!d.track)return;if(value<40||value>240)return toast('Le BPM doit être compris entre 40 et 240.');engine.setGrid(id,{bpm:value,downbeat:d.track.downbeat??d.track.beatOffset??0});savePreparation(d.track);renderLibrary();update();};
  performancePanel.querySelector('.bpm-half').onclick=()=>changeBpm((engine.decks[id].track?.bpm||120)/2);
  performancePanel.querySelector('.bpm-double').onclick=()=>changeBpm((engine.decks[id].track?.bpm||120)*2);
  performancePanel.querySelector('.tap-tempo').onclick=()=>{const bpm=tapTempos[id].tap(performance.now());if(bpm)changeBpm(bpm);else toast('Continuez à taper au rythme du morceau…');};
  waveTools.querySelector('.grid-anchor').onclick=()=>{if(!engine.decks[id].track)return;engine.setDownbeat(id);savePreparation(engine.decks[id].track);toast(`Premier temps de ${letter} placé à ${preciseTime(engine.position(id))}.`);};
  waveTools.querySelector('.wave-zoom').onchange=event=>{waveZoom=event.target.value;$$('.wave-zoom').forEach(select=>select.value=waveZoom);savePreferences();};
  el.querySelector('.loop-size').innerHTML='<option value="0.25">¼</option><option value="0.5">½</option><option value="1">1</option><option value="2">2</option><option value="4" selected>4</option><option value="8">8</option><option value="16">16</option>';
  const rack=document.createElement('div');rack.className='deck-fx-rack';rack.innerHTML='<div class="deck-fx-line"><span>FX RACK</span><select class="deck-fx-type" aria-label="Effet platine '+letter+'"><option value="reverb">Reverb</option><option value="flanger">Flanger</option><option value="tremolo">Tremolo · ½ temps</option></select><input class="deck-fx-amount" type="range" aria-label="Dosage effet '+letter+'" min="0" max="1" value="0" step="0.05"><output class="deck-fx-value">OFF</output></div><div class="deck-tools-line"><span>SLIP ROLL</span><button data-roll="0.25" aria-label="Slip roll quart de temps '+letter+'">¼</button><button data-roll="0.5" aria-label="Slip roll demi-temps '+letter+'">½</button><button data-roll="1" aria-label="Slip roll un temps '+letter+'">1</button><span class="kill-label">KILL</span><button data-kill="0" aria-label="Couper les basses '+letter+'">LOW</button><button data-kill="1" aria-label="Couper les médiums '+letter+'">MID</button><button data-kill="2" aria-label="Couper les aigus '+letter+'">HI</button></div>';el.append(rack);
  const applyFx=()=>{const kind=rack.querySelector('.deck-fx-type').value,amount=Number(rack.querySelector('.deck-fx-amount').value);return run(async()=>{await engine.init();engine.setDeckEffect(id,kind,amount);});};rack.querySelector('.deck-fx-type').onchange=applyFx;rack.querySelector('.deck-fx-amount').oninput=applyFx;
  const stems=document.createElement('details');stems.className='stem-panel';stems.innerHTML=`<summary><span>STEMS · 4 PISTES</span><small class="stem-state">À préparer</small></summary><p>Préparez le morceau, puis dosez séparément ses voix, sa batterie, sa basse et ses instruments. Le calcul reste sur cet ordinateur.</p><div class="stem-actions"><button class="stem-prepare">Préparer les stems</button><button class="stem-cancel" hidden>Annuler</button><button class="stem-settings">Réglages</button></div><div class="stem-levels">${stemNames.map(name=>`<div class="stem-channel"><label>${stemLabels[name]}<input type="range" min="0" max="1" step=".01" value="1" data-stem="${name}" aria-label="${stemLabels[name]} platine ${letter}" disabled><output>100%</output></label><div class="stem-switches"><button type="button" data-stem-mute="${name}" aria-label="Couper ${stemLabels[name]} platine ${letter}" aria-pressed="false" disabled>M</button><button type="button" data-stem-solo="${name}" aria-label="Solo ${stemLabels[name]} platine ${letter}" aria-pressed="false" disabled>S</button></div></div>`).join('')}</div><div class="stem-presets"><button data-stem-preset="instrumental" disabled>Instrumental</button><button data-stem-preset="acappella" disabled>Acappella</button><button data-stem-preset="original" disabled>Tout rétablir</button></div>`;el.append(stems);
  stems.querySelector('.stem-prepare').onclick=()=>run(async()=>{
    const track=engine.decks[id].track;if(!track)return;
    if(track.stemBuffer){await engine.activateStems(id);update();return;}
    if(stemControllers.size)return toast('Une préparation est déjà en cours. Annulez-la dans les réglages Stems si nécessaire.');
    if(!window.sillageDesktop?.prepareStems)return toast('La préparation des stems nécessite la nouvelle application Windows.');
    const controller=new AbortController();stemControllers.set(track,controller);track.stemPreparing=true;track.stemStatus='Préparation…';update();
    try{await engine.init();await prepareStems(track,engine.context,window.sillageDesktop,state=>{
      track.stemStatus=stemProgressLabel(state);update();
    },controller.signal,stemSettings.get());track.stemStatus='Stems prêts';toast('Stems prêts : les quatre pistes sont disponibles.');}
    catch(error){track.stemStatus=controller.signal.aborted?'Préparation annulée':error.message;toast(track.stemStatus);}
    finally{track.stemPreparing=false;stemControllers.delete(track);scheduleLibraryBudget();stemSettings.refresh();update();}
  });
  stems.querySelector('.stem-settings').onclick=()=>stemSettings.open(engine.decks[id].track);
  stems.querySelector('.stem-cancel').onclick=()=>stemControllers.get(engine.decks[id].track)?.abort();
  const advanced=document.createElement('button');advanced.className='deck-advanced-toggle';advanced.textContent='Outils DJ · cues, FX, stems';advanced.setAttribute('aria-expanded','false');advanced.onclick=()=>{const open=el.classList.toggle('show-advanced');advanced.setAttribute('aria-expanded',String(open));advanced.textContent=open?'Réduire les outils':'Outils DJ · cues, FX, stems';};el.append(advanced);
  stems.querySelectorAll('[data-stem]').forEach(input=>input.oninput=()=>engine.setStemLevel(id,input.dataset.stem,Number(input.value)));
  stems.querySelectorAll('[data-stem-mute]').forEach(button=>button.onclick=()=>engine.setStemMute(id,button.dataset.stemMute,button.getAttribute('aria-pressed')!=='true'));stems.querySelectorAll('[data-stem-solo]').forEach(button=>button.onclick=()=>engine.setStemSolo(id,button.dataset.stemSolo,button.getAttribute('aria-pressed')!=='true'));stems.querySelectorAll('[data-stem-preset]').forEach(button=>button.onclick=()=>engine.setStemPreset(id,button.dataset.stemPreset));
  rack.querySelectorAll('[data-roll]').forEach(button=>button.onclick=()=>run(async()=>{if(!engine.decks[id].track)return toast('Chargez un morceau pour utiliser Slip Roll.');await prepareLocalPlayback();stopAutomix();await engine.roll(id,Number(button.dataset.roll));update();}));
  rack.querySelectorAll('[data-kill]').forEach(button=>button.onclick=()=>{const d=engine.decks[id],band=Number(button.dataset.kill);engine.setEQ(id,band,d.eq[band]<=-23.9?0:-24);update();});
  el.ondragover = event => { if (event.dataTransfer.types.includes('text/track-id')) { event.preventDefault(); el.classList.add('drop-target'); } };
  el.ondragleave = () => el.classList.remove('drop-target');
  el.ondrop = event => { const track = tracks.find(t => t.id === event.dataTransfer.getData('text/track-id')); el.classList.remove('drop-target'); if (track) { event.preventDefault();stopAutomix(); loadDeck(id, track); } };
});

$('#eq-area').innerHTML = ['HIGH', 'MID', 'LOW'].map((label, row) => `<div class="eq-row">${knob(0, 2 - row)}<span>${label}</span>${knob(1, 2 - row)}</div>`).join('') + `<div class="eq-row">${knob(0, 'filter')}<span>FILTER</span>${knob(1, 'filter')}</div>`;
function knob(id, band) {
  const filter = band === 'filter';
  return `<label class="knob-wrap" style="--accent:var(--${id ? 'b' : 'a'})"><span class="knob"></span><input type="range" aria-label="${filter ? 'Filtre' : ['Basses', 'Médiums', 'Aigus'][band]} ${id ? 'B' : 'A'}" data-eq="${band}" data-channel="${id}" min="${filter ? -1 : -24}" max="${filter ? 1 : 12}" step="${filter ? 0.01 : 0.5}" value="0"><output>0</output></label>`;
}
$$('[data-eq]').forEach(input => {
  input.oninput = () => { if (input.dataset.eq === 'filter') engine.setFilter(Number(input.dataset.channel), Number(input.value)); else engine.setEQ(Number(input.dataset.channel), Number(input.dataset.eq), Number(input.value)); updateKnob(input); };
  input.ondblclick = () => { input.value = 0; input.oninput(); };
});
function updateKnob(input) {
  const value = Number(input.value), angle = input.dataset.eq === 'filter' ? value * 135 : value / (value > 0 ? 12 : 24) * 135;
  input.parentElement.querySelector('.knob').style.transform = `rotate(${angle}deg)`;
  input.parentElement.querySelector('output').textContent = input.dataset.eq === 'filter' ? value === 0 ? 'OFF' : `${Math.abs(Math.round(value * 100))}%` : `${value > 0 ? '+' : ''}${value}`;
}
$$('[data-volume]').forEach(input => { input.oninput = () => engine.setVolume(Number(input.dataset.volume), Number(input.value)); });
$('#crossfader').oninput = event => { engine.setCrossfade(Number(event.target.value)); updateTransitionText(); };
$('#crossfader').ondblclick = () => { engine.setCrossfade(0.5); $('#crossfader').value = 0.5; updateTransitionText(); };
$('#master').oninput = event => { engine.setMaster(Number(event.target.value)); $('#master-value').textContent = `${Math.round(Number(event.target.value) * 100)}%`; };

function loadDeck(id, track,{preparing=false}={}) { if(!track)return;if(!preparing)nextPreparation?.invalidate();prepared[id] = true;visibleRanges[id]=[0,track.buffer.duration];engine.load(id, track);update(); }
function bindScratch(vinyl,id){
 let gesture=null;vinyl.title='Maintenir le bouton gauche et tourner pour scratcher';vinyl.setAttribute('aria-label','Vinyle de scratch platine '+(id?'B':'A'));
 const angle=event=>{const r=vinyl.getBoundingClientRect();return Math.atan2(event.clientY-r.top-r.height/2,event.clientX-r.left-r.width/2);};
 const finish=async event=>{const g=gesture;if(!g||g.pointer!==event.pointerId)return;g.ended=true;if(vinyl.hasPointerCapture(g.pointer))vinyl.releasePointerCapture(g.pointer);if(g.ready){gesture=null;await engine.endScratch(id);update();}};
 vinyl.onpointerdown=event=>{if(event.button!==0||gesture||!engine.decks[id].track)return;event.preventDefault();stopAutomix();vinyl.setPointerCapture(event.pointerId);const g=gesture={pointer:event.pointerId,angle:angle(event),time:event.timeStamp,ready:false,ended:false,pending:0};
  run(async()=>{await prepareLocalPlayback();const ready=await engine.beginScratch(id);g.ready=ready;if(gesture!==g)return;if(!ready){gesture=null;return;}if(g.ended){if(g.pending){engine.scratchBy(id,g.pending,32);await new Promise(resolve=>setTimeout(resolve,Math.min(160,Math.max(32,Math.abs(g.pending)/8*1000+25))));}if(gesture===g){await engine.endScratch(id);gesture=null;}}else if(g.pending)engine.scratchBy(id,g.pending,32);update();}).finally(()=>{if(gesture===g&&!engine.decks[id].scratching)gesture=null;});
 };
 vinyl.onpointermove=event=>{const g=gesture;if(!g||g.ended||event.pointerId!==g.pointer)return;const a=angle(event);let delta=a-g.angle;if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;const seconds=delta/(Math.PI*2)*1.8,elapsed=Math.max(1,event.timeStamp-g.time);g.angle=a;g.time=event.timeStamp;if(g.ready)engine.scratchBy(id,seconds,elapsed);else g.pending=clamp(g.pending+seconds,-1,1);};
 vinyl.onpointerup=event=>run(()=>finish(event));vinyl.onpointercancel=event=>run(()=>finish(event));vinyl.onlostpointercapture=event=>{if(gesture&&!gesture.ended)run(()=>finish(event));};vinyl.ondragstart=event=>event.preventDefault();
}

function attachFolder(items,scope){if(!scope)return;for(const t of items){t.sourceFolders||=[];if(!t.sourceFolders.some(f=>f.path===scope.path))t.sourceFolders.push({id:scope.id,path:scope.path,name:scope.name});}}
function selectionSource(active=engine.transition?.source??(engine.crossfade<.5?0:1)){const d=engine.decks[active];return d.track?{...d.track,bpm:d.track.bpm?d.track.bpm*engine.currentRate(active):d.track.bpm}:null;}
function planSessionQueue(next){
 const planned=[],played=[...djSession.played,next.id],exclude=[...nextPreparation?.failed.keys()||[]];let cursor=next;
 for(let n=0;n<djSession.tracks.length;n++){const item=selectNextTrack(cursor,djSession.tracks,{mode:djSession.mode,played,exclude,transition:transitionOptions()});if(!item)break;planned.push(item.id);played.push(item.id);cursor=item;}
 queue.splice(0,queue.length,...planned);
}
function nextTrack(active=engine.transition?.source??(engine.crossfade<.5?0:1)){
 const current=engine.decks[active].track,other=1-active;
 const ready=prepared[other]&&engine.decks[other].track;
 if(ready&&ready.id!==current?.id&&!nextPreparation?.failed.has(ready.id))return ready;
 const queued=tracks.find(t=>t.id===queue[0]&&t.id!==current?.id);
 if(queued&&!nextPreparation?.failed.has(queued.id)&&(!djSession.enabled||djSession.tracks.some(t=>t.id===queued.id)))return queued;
 if(djSession.enabled)return djSession.next(selectionSource(active),{exclude:[...nextPreparation?.failed.keys()||[]],transition:transitionOptions()});
 const scope=current?.sourceFolders?.[0],candidates=scope?tracks.filter(t=>t.sourceFolders?.some(f=>f.path===scope.path)):tracks;
 return selectNextTrack(selectionSource(active),candidates,{mode:$('#session-mode').value,exclude:[...nextPreparation?.failed.keys()||[]],played:current?[current.id]:[],transition:transitionOptions()});
}
async function mixNext(){
 if(engine.transition){if(engine.context.currentTime<engine.transition.start)engine.cancelTransition();else return;}
 const active=engine.crossfade<.5?0:1,other=1-active,current=engine.decks[active].track;
 if(!current)throw new Error('Chargez un titre avant de passer au suivant.');
 let next=nextTrack(active);
 if(!next&&current.sourceFolders?.[0]&&window.sillageDesktop?.folderList&&!djSession.enabled){
  const scope=current.sourceFolders[0],folder=await window.sillageDesktop.folderList(scope.id),items=await importDesktop(folder.files,null,{autoLoad:false});attachFolder(items||[],scope);
  djSession.start({scope,tracks:items||[],current,mode:$('#session-mode').value});next=nextTrack(active);
 }
 if(!next)throw new Error('Aucun titre suivant dans ce dossier ou cette file.');
 if(engine.decks[other].track?.id!==next.id||!prepared[other])loadDeck(other,next);
 if(queue[0]===next.id)queue.shift();
 await prepareLocalPlayback();sessionStart??=Date.now();
 await engine.startTransition({...transitionOptions(),startNow:true,skipBeats:Math.min(16,Number($('#transition-beats').value)||16)});update();
}
function fillNextDeck(active,{force=false,alternate=false}={}){
 if(!djSession.enabled||engine.transition)return false;const other=1-active;if(prepared[other]&&!force&&!alternate&&!nextPreparation?.failed.has(engine.decks[other].track?.id))return true;
 const current=engine.decks[active].track,previous=engine.decks[other].track;
 const queued=!force&&!alternate?djSession.tracks.find(t=>t.id===queue[0]&&!nextPreparation?.failed.has(t.id)&&!djSession.played.has(t.id)&&t.id!==current?.id):null;
 const next=queued||djSession.next(selectionSource(active),{exclude:[...nextPreparation?.failed.keys()||[],...(alternate&&previous?[previous.id]:[])],transition:transitionOptions()});
 if(!next){if(alternate){toast('Aucune autre proposition non jouée dans ce dossier.');return false;}prepared[other]=false;engine.unload(other);queue.splice(0);return false;}
 loadDeck(other,next);planSessionQueue(next);update();return true;
}
async function startFolderAutomix(entries,scope,mode='compatible'){
 if(!entries?.length)return toast('Ce dossier ne contient pas de morceau audio.');
 if(importing)return toast('Un dossier est déjà en cours de préparation. Les titres déjà chargés restent disponibles.');
 stopAutomix();const active=engine.crossfade<.5?0:1,other=1-active,current=engine.decks[active].track;
 const launch=setLaunch;automixImportLaunch=launch;const currentEntry=entries.find(entry=>fileKey(entry)===current?.fileKey),ordered=currentEntry?[currentEntry,...entries.filter(entry=>entry!==currentEntry)]:entries;
 let started=false;
 try{await importDesktop(ordered,null,{autoLoad:false,onTrack:async track=>{
  attachFolder([track],scope);if(launch!==setLaunch)return;
  if(!started){
   const keepCurrent=track===current&&engine.position(active)<track.buffer.duration-.05;
   djSession.start({scope,tracks:[track],current:track,mode});$('#session-mode').value=djSession.mode;
   queue.splice(0);prepared[other]=false;engine.pause(other);
   if(!keepCurrent){engine.pause(active);loadDeck(active,track);engine.setCrossfade(active);}
   await prepareLocalPlayback();if(launch!==setLaunch)return;automix=true;await engine.play(active);sessionStart??=Date.now();started=true;
  }else if(!djSession.tracks.some(item=>item.id===track.id))djSession.tracks.push(track);
  if(!engine.transition)fillNextDeck(engine.crossfade<.5?0:1);
  renderLibrary();update();
 }});
 }finally{if(automixImportLaunch===launch)automixImportLaunch=null;}
 if(started&&launch===setLaunch)toast('Automix dans '+scope.name+' · analyse en arrière-plan.');
}
function updateDJSession(){
 $('#session-scope').textContent=djSession.enabled?djSession.scope.name:'Choisissez un dossier de musique';$('#session-scope').title=djSession.scope?.path||'';
 const active=engine.transition?.source??(engine.crossfade<.5?0:1),current=engine.decks[active].track,other=1-active;
 const remaining=djSession.remaining(current,{exclude:[...nextPreparation?.failed.keys()||[]]});$('#session-remaining').textContent=djSession.enabled?remaining+' titre'+(remaining>1?'s':'')+' restant'+(remaining>1?'s':'')+' · '+selectionModes[djSession.mode]+(nextPreparation?.failed.size?' · '+nextPreparation.failed.size+' indisponible'+(nextPreparation.failed.size>1?'s':''):''):'Tempo, tonalité et énergie guident le prochain passage.';
 $('#session-toggle').textContent=automix?'Ⅱ Arrêter Automix':'▶ Démarrer Automix';$('#session-toggle').classList.toggle('active',automix);$('#session-next').disabled=!djSession.enabled||Boolean(engine.transition)||djSession.remaining(current,{exclude:[...nextPreparation?.failed.keys()||[]]})<2;
 const ranked=djSession.enabled?djSession.recommendations(selectionSource(active),{exclude:[...nextPreparation?.failed.keys()||[]],transition:transitionOptions()}).slice(0,3):[],signature=ranked.map(r=>r.track.id+':'+r.reason).join('|')+':'+engine.decks[other].track?.id;
 if(signature===recommendationSignature)return;recommendationSignature=signature;recommendationIds=ranked.map(r=>r.track.id);$('#recommendation-empty').hidden=Boolean(ranked.length);
 $('#recommendation-empty').textContent=djSession.enabled?'Tous les titres de ce dossier ont été proposés ou joués.':'Lancez Automix depuis un dossier pour découvrir les propositions.';
 $('#recommendation-list').innerHTML=ranked.map(r=>'<button class="recommendation-row" data-recommend="'+esc(r.track.id)+'" title="'+esc(r.reason)+'"><strong>'+esc(r.track.title)+'</strong><span class="track-key">'+esc(keyLabel(r.track))+'</span><span class="match-badge">'+(r.tempo.sync?'Beatmatch':'Tempo naturel')+' · '+r.track.bpm+' BPM</span><small>'+esc(r.reason)+'</small>'+(engine.decks[other].track?.id===r.track.id?'<b>PRÉPARÉ</b>':'')+'</button>').join('');
 $$('[data-recommend]').forEach(button=>button.onclick=()=>{if(engine.transition)return toast('Le passage est en cours. Attendez sa fin pour changer le prochain titre.');const next=djSession.tracks.find(t=>t.id===button.dataset.recommend);if(!next||djSession.played.has(next.id))return;loadDeck(other,next);planSessionQueue(next);renderLibrary();update();});
}
function update() {
  stemSettings.update();
  keyLockSettings?.update();
  $$('.deck').forEach((el, id) => {
    const d = engine.decks[id];
    const hasStems=Boolean(d.track?.stemBuffer),pending=hasStems&&d.playing&&!d.stemGains,preparing=Boolean(d.track?.stemPreparing);
    el.querySelector('.scratch-hint').textContent=hasStems&&stemNames.some(name=>effectiveStemGain(d.track,name)!==1)?'SCRATCH · mix original, dosage stems repris au relâchement':'SCRATCH · maintenir et tourner le vinyle';
    el.querySelector('.stem-state').textContent=pending?'Prêts · activer pour écouter':d.track?.stemStatus||(hasStems?'Stems prêts':'À préparer');
    el.querySelector('.stem-prepare').textContent=preparing?'Préparation en cours…':pending?'Activer les stems':hasStems?'Stems prêts':'Préparer les stems';
    el.querySelector('.stem-prepare').disabled=!d.track||preparing||(!hasStems&&stemSettings.preparation().active)||(hasStems&&!pending);
    el.querySelector('.stem-cancel').hidden=!preparing;
    el.querySelectorAll('[data-stem]').forEach(input=>{input.disabled=!hasStems||pending;input.value=d.track?.stemLevels?.[input.dataset.stem]??1;input.nextElementSibling.textContent=Math.round(Number(input.value)*100)+'%';input.closest('.stem-channel')?.classList.toggle('is-muted',hasStems&&effectiveStemGain(d.track,input.dataset.stem)===0);});
    for(const [attribute,key]of [['stem-mute','stemMuted'],['stem-solo','stemSolo']])el.querySelectorAll('[data-'+attribute+']').forEach(button=>{button.disabled=!hasStems||pending;button.setAttribute('aria-pressed',String(d.track?.[key]?.[button.getAttribute('data-'+attribute)]===true));});
    el.querySelectorAll('[data-stem-preset]').forEach(button=>button.disabled=!hasStems||pending);
    el.querySelector('.deck-key-select').options[0].textContent='Auto · '+keyLabel(d.track);el.querySelector('.deck-key-select').value=d.track?.manualKey?d.track.keyRoot+':'+d.track.keyMode:'auto';
    el.classList.toggle('is-scratching',Boolean(d.scratching));el.querySelector('.vinyl').classList.toggle('scratching',Boolean(d.scratching));
    el.querySelector('.play').disabled=Boolean(pendingLibraryLoads[id]);el.dataset.playing=String(d.playing);el.querySelector('.deck-state').textContent=pendingLibraryLoads[id]||d.playRequest?'CHARGEMENT':d.scratching?'SCRATCH':d.playing?'EN LECTURE':d.track?.ensureAudio&&!d.track.buffer?.getChannelData?'SUR DISQUE':d.track?'PRÊTE':'EN ATTENTE';
    el.querySelector('h2').textContent = d.track?.title || 'Chargez un morceau';
    el.querySelector('.deck-track p').textContent = d.track?.artist || 'Déposez un titre de votre collection';
    if (document.activeElement !== el.querySelector('.bpm-input')) el.querySelector('.bpm-input').value = d.track?.bpm ? Number((d.track.bpm * d.rate).toFixed(1)) : '';
    el.querySelector('.play').innerHTML = icon(d.playing ? 'pause' : 'play');
    el.querySelector('.play').setAttribute('aria-label', `${d.playing ? 'Pause' : 'Lire'} platine ${id ? 'B' : 'A'}`);
    el.querySelector('.loop').classList.toggle('on', Boolean(d.loop));
    el.querySelector('.echo').classList.toggle('on', Boolean(d.echo));
    el.querySelector('.deck-fx-amount').value=d.fx?.amount||0;el.querySelector('.deck-fx-value').textContent=d.fx?.amount?Math.round(d.fx.amount*100)+'%':'OFF';
    el.querySelectorAll('[data-roll]').forEach(button=>button.setAttribute('aria-pressed',String(Boolean(d.roll)&&d.roll.beats===Number(button.dataset.roll))));
    el.querySelectorAll('[data-kill]').forEach(button=>button.setAttribute('aria-pressed',String(d.eq[Number(button.dataset.kill)]<=-23.9)));
    el.querySelector('.waveform-label').hidden = Boolean(d.track);
    const pitch = (d.rate - 1) * 100;
    el.querySelector('.pitch').value = pitch;
    el.querySelector('.pitch-area output').textContent = `${pitch >= 0 ? '+' : ''}${pitch.toFixed(1)}%`;
    el.querySelector('.region-in span').textContent=time(d.track?.mixIn||0);
    el.querySelector('.region-out span').textContent=time(d.track?.mixOut||0);
    el.querySelector('.grid-confidence').textContent=d.track?.confidence==='manual'?'GRILLE CORRIGÉE':d.track?.confidence==='generated'?'GRILLE DÉMO':d.track?.bpm?'ANALYSE · '+Math.round((d.track.tempoConfidence||0)*100)+'%':'ANALYSE';
    el.querySelector('.cue-erase').setAttribute('aria-pressed',String(eraseCues[id]));
    el.querySelectorAll('.hot-cue').forEach((button,slot)=>{const cue=d.track?.hotCues?.[slot],filled=Number.isFinite(cue);button.classList.toggle('filled',filled);button.classList.toggle('erasing',eraseCues[id]);button.querySelector('small').textContent=filled?preciseTime(cue):'＋ DÉFINIR';button.setAttribute('aria-label',`${eraseCues[id]?'Effacer':filled?'Déclencher':'Définir'} Hot Cue ${slot+1} ${id?'B':'A'}`);});
  });
  $$('[data-eq]').forEach(input => {
    const d = engine.decks[Number(input.dataset.channel)];
    input.value = input.dataset.eq === 'filter' ? d.filter : d.eq[Number(input.dataset.eq)]; updateKnob(input);
  });
  if (engine.context) {
    $('#audio-status').textContent = `${(engine.context.sampleRate / 1000).toFixed(1)} kHz · WEB AUDIO`;
    $('#audio-detail').textContent = `Sortie du studio · ${(engine.context.sampleRate / 1000).toFixed(1)} kHz · latence de base ${Math.round((engine.context.baseLatency || 0) * 1000)} ms · Key Lock compensé ${Math.round((engine.keyLockLatency||0)*1000)} ms`;
    $('#engine-status').textContent = `Audio ${engine.context.state === 'running' ? 'actif' : 'en veille'} · ${engine.keyLock&&engine.keyLockAvailable?'Key Lock actif':'hauteur liée à la vitesse'} · limiteur`;
  }
  $('#automix-toggle').classList.toggle('active', automix);
  $('#automix-state').textContent = automix ? 'ON' : 'OFF';
  updateSessionPanel();
  updateDJSession();
  updateTransitionText();
}
function updateTransitionText() {
  const dest = engine.crossfade < 0.5 ? 'A → B' : 'B → A';
  $('#transition-start').innerHTML = engine.transition ? `Annuler le fondu ${icon('pause')}` : `Lancer ${dest} ${icon('arrow-right')}`;
  if (!engine.transition) { $('#transition-status').textContent = automix ? 'Automix en attente du prochain enchaînement' : 'Prêt pour le prochain mouvement'; $('#transition-progress').style.width = '0%'; }
}
function updateSessionPanel(){
  const active=engine.transition?.source??(engine.crossfade<0.5?0:1),other=1-active,a=engine.decks[active],next=nextTrack(active);
  $('#next-track-name').textContent=next?.title||'Votre prochain titre';$('#next-track-artist').textContent=next?.artist||'Ajoutez un morceau à la platine libre ou à la file.';
  $('#next-track-bpm').textContent=next?.bpm?next.bpm.toFixed(1)+' BPM':'—';
  $('#mix-readiness').textContent=engine.transition?'EN COURS':nextPreparation?.busy?'PRÉPARATION…':a.track&&next?'PRÊT':'À PRÉPARER';$('#mix-readiness').dataset.ready=String(Boolean(a.track&&next&&!nextPreparation?.busy));
  if(a.track&&next){const plan=engine.transition?{...engine.transition,seconds:engine.transition.duration}:makeTransitionPlan({...a,rate:engine.currentRate(active)},{track:next,rate:1},transitionOptions());updateTransitionPreview(plan);const seconds=plan.seconds??(plan.tempoBlend?plan.beats*60/(tempoMean(plan.bpmA,plan.bpmB,plan.tempoShape)):transitionSeconds(plan.bpmA,plan.beats));$('#next-mix-time').textContent='≈ '+seconds.toFixed(1)+' s';$('#mix-advice').textContent=plan.reason|| (plan.fallback?'Tempos éloignés : synchronisation désactivée. Le mode Adaptatif privilégie un écho court.':plan.tempoBlend?'Les deux tempos évoluent ensemble vers '+next.bpm+' BPM.':plan.sync?'Les mesures sont alignées et le tempo entrant est synchronisé.':'Passage sans synchronisation des tempos.');}
  else{updateTransitionPreview();$('#next-mix-time').textContent='—';$('#mix-advice').textContent='Préparez la file, choisissez un scénario et laissez les titres se répondre.';}
  $$('[data-preset]').forEach(button=>{const preset=transitionPresets[button.dataset.preset],current=transitionOptions();button.setAttribute('aria-pressed',String(preset.style===current.style&&preset.beats===current.beats&&preset.sync===current.sync&&preset.tempoBlend===current.tempoBlend&&preset.quantize===current.quantize));});
}

function updateTransitionPreview(plan){
  $('#tempo-limit').disabled=!$('#tempo-sync').checked;
  updateTempoControl($('#tempo-shape'),{enabled:$('#tempo-sync').checked&&$('#tempo-blend').checked,active:Boolean(engine.transition),shape:engine.transition?.tempoShape||$('#tempo-shape').value});
  const arrival=plan?.incomingLanding,showArrival=$('#transition-style').value==='auto'&&$('#set-profile').value==='musical';$('.overlap-setting').hidden=!showArrival;$('#overlap-protect').disabled=!$('#tempo-sync').checked;$('#overlap-status').hidden=!showArrival||!plan;const overlapText=overlapSummary(plan?.overlap);if($('#overlap-status').textContent!==overlapText)$('#overlap-status').textContent=overlapText;$('#overlap-status').dataset.active=String(Boolean(plan?.overlap?.applied));$('#arrival-setting').hidden=!showArrival;$('#arrival-status').hidden=!showArrival||!$('#align-arrival').checked;const arrivalText=arrival?arrival.label+' · '+preciseTime(arrival.time)+' au relais':'Arrivée sans repère fiable';if($('#arrival-status').textContent!==arrivalText)$('#arrival-status').textContent=arrivalText;
  visualPlan=plan||null;visualPlanSource=engine.transition?.source??(engine.crossfade<.5?0:1);
  const stages=plan?.stages||[],signature=JSON.stringify(stages),timeline=$('#transition-timeline');if(timeline.dataset.signature!==signature){timeline.dataset.signature=signature;timeline.innerHTML=stages.map((stage,i)=>'<span class="transition-stage" data-at="'+stage.at+'"><b>'+String(i+1).padStart(2,'0')+'</b>'+esc(stage.label)+'</span>').join('');}
  const style=plan?.style||$('#transition-style').value,item=transitionCatalog.find(item=>item.id===style)||transitionCatalog[0];
  $('#selected-transition-name').textContent=($('#transition-style').value==='auto'?'✦ Choix dynamique · ':'')+item.label;$('#selected-transition-description').textContent=item.description;
  $('#set-profile').disabled=$('#transition-style').value!=='auto';$('#transition-intensity-value').textContent=Math.round(Number($('#transition-intensity').value)*100)+'%';
  const canvas=$('#transition-shape'),ctx=canvas.getContext('2d'),rawCurves=faderCurves(0,1,style,plan?.seconds||plan?.duration||8,100,plan?.score),curves=plan?.tempoBlend?rawCurves.map(curve=>warpTempoCurve(curve,plan.bpmA,plan.bpmB,plan.seconds||plan.duration,plan.tempoShape)):rawCurves;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=appearance.colors.grid;ctx.beginPath();ctx.moveTo(3,45);ctx.lineTo(207,45);ctx.stroke();for(let id=0;id<2;id++){ctx.strokeStyle=id?appearance.colors.b:appearance.colors.a;ctx.lineWidth=1.7;ctx.beginPath();curves[id].forEach((v,i)=>i?ctx.lineTo(5+i*2,44-v*36):ctx.moveTo(5,44-v*36));ctx.stroke();}if(plan?.score){const x=5+198*(plan.tempoBlend?tempoFraction(plan.score.handoffFraction,plan.bpmA,plan.bpmB,plan.seconds||plan.duration,plan.tempoShape)/(plan.seconds||plan.duration):plan.score.handoffFraction);ctx.strokeStyle=appearance.colors.text||'#e9edf2';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x,3);ctx.lineTo(x,45);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.font='8px sans-serif';ctx.fillText('RELAIS',Math.min(170,x+3),9);}
}
function renderSetHistory(){const log=engine.performanceLog;$('#history-empty').hidden=Boolean(log.length);$('#history-clear').disabled=!log.length;$('#set-history').innerHTML=log.slice(-4).reverse().map(t=>'<li><span>'+esc(transitionName(t.style))+' · '+t.seconds.toFixed(1)+' s</span><strong>'+esc(t.from)+' → '+esc(t.to)+'</strong></li>').join('');}
$('#history-clear').onclick=()=>{engine.performanceLog=[];renderSetHistory();};
$('#texture-pads').innerHTML=Object.entries(textureNames).map(([id,label],index)=>'<button class="texture-pad" data-texture="'+id+'"><small>0'+(index+1)+'</small><strong>'+label+'</strong><span>'+['↗','↘','◉','⌁','▥','≋'][index]+'</span></button>').join('');
$$('[data-texture]').forEach(button=>button.onclick=()=>run(async()=>{await prepareLocalPlayback();await engine.init();const id=engine.crossfade<0.5?0:1,d=engine.decks[id],bpm=(d.track?.bpm||120)*engine.currentRate(id),now=engine.context.currentTime;const wait=$('#texture-quantize').checked&&d.playing?(nextMusicalTime(engine.position(id)+0.025*d.rate,d.track.bpm||120,d.track.beatOffset||0,1)-engine.position(id))/d.rate:0;const duration=Number($('#texture-beats').value)*60/bpm;await engine.playTexture(button.dataset.texture,{start:now+Math.max(0,wait),duration,intensity:Number($('#texture-level').value)});button.classList.add('fired');setTimeout(()=>button.classList.remove('fired'),350);$('#texture-status').textContent=textureNames[button.dataset.texture]+' · '+duration.toFixed(1)+' s';}));
$('#texture-stop').onclick=()=>{engine.stopTextures();$('#texture-status').textContent='Textures coupées';};

function bindQueueDrag(root){
  root.querySelectorAll('[data-q-index]').forEach(row=>{
    row.draggable=true;
    row.ondragstart=event=>{queueDragIndex=Number(row.dataset.qIndex);event.dataTransfer.setData('text/sillage-queue',String(queueDragIndex));event.dataTransfer.setData('text/track-id',queue[queueDragIndex]);event.dataTransfer.effectAllowed='move';row.classList.add('dragging');};
    row.ondragover=event=>{if(event.dataTransfer.types.includes('text/sillage-queue')){event.preventDefault();row.classList.add('queue-drop');}};
    row.ondragleave=()=>row.classList.remove('queue-drop');
    row.ondrop=event=>{if(!event.dataTransfer.types.includes('text/sillage-queue'))return;event.preventDefault();event.stopPropagation();const from=Number(event.dataTransfer.getData('text/sillage-queue'));replaceQueue(moveQueueItem(queue,from,Number(row.dataset.qIndex)));queueDragIndex=null;};
    row.ondragend=()=>{queueDragIndex=null;$$('.dragging,.queue-drop').forEach(element=>element.classList.remove('dragging','queue-drop'));};
  });
}
function renderQueuePreview(){
  $('#preview-count').textContent=queue.length;$('#queue-duration').textContent=time(queue.reduce((total,id)=>total+(tracks.find(t=>t.id===id)?.buffer.duration||0),0));
  $('#queue-preview-empty').hidden=Boolean(queue.length);$('#queue-organize').disabled=queue.length<2;$('#queue-undo').hidden=!lastQueue;
  $('#queue-preview').innerHTML=queue.slice(0,5).map((id,index)=>{const t=libraryTrack(id);if(!t)return '';return `<li data-q-index="${index}"><span class="queue-order">${String(index+1).padStart(2,'0')}</span><div><strong>${esc(t.title)}</strong><small>${t.bpm||'—'} BPM · ${time(t.buffer.duration)}</small></div><div class="queue-actions"><button data-qmove="-1" aria-label="Monter ${esc(t.title)} dans la file" ${index===0?'disabled':''}>↑</button><button data-qmove="1" aria-label="Descendre ${esc(t.title)} dans la file" ${index===queue.length-1?'disabled':''}>↓</button><button data-qremove aria-label="Retirer ${esc(t.title)} de la file">×</button></div></li>`;}).join('');
  $$('#queue-preview [data-qmove]').forEach(button=>{button.onclick=()=>{const index=Number(button.closest('li').dataset.qIndex);replaceQueue(moveQueueItem(queue,index,index+Number(button.dataset.qmove)));};});
  $$('#queue-preview [data-qremove]').forEach(button=>{button.onclick=()=>replaceQueue(queue.filter((_,index)=>index!==Number(button.closest('li').dataset.qIndex)));});bindQueueDrag($('#queue-preview'));
}
function prepareSet(items){
  if(items.length)djSession.start({scope:{id:'selection',path:'',name:'Sélection préparée'},tracks:items,current:items[0],mode:$('#session-mode').value});
  if(!items.length)return toast('Ajoutez au moins un morceau à votre collection.');stopAutomix();engine.pause(0);engine.pause(1);
  loadDeck(0,tracks.find(t=>t.id===items[0].id));
  if(items[1])loadDeck(1,tracks.find(t=>t.id===items[1].id));else{prepared[1]=false;engine.unload(1);}
  replaceQueue(items.slice(2).map(t=>t.id));engine.setCrossfade(0);update();toast(items.length+' titre'+(items.length>1?'s prêts':' prêt')+' pour votre set. Activez Automix pour commencer.');
}
function updateRecordingUI(){
  const active=recorder.state!=='idle';$('#record-toggle').disabled=recorder.state==='starting'||recorder.state==='stopping';$('#record-toggle').setAttribute('aria-pressed',String(active));$('#record-toggle').setAttribute('aria-label',active?'Arrêter l’enregistrement':'Enregistrer le mix local');$('#record-label').textContent=active?'STOP':'REC';document.body.dataset.recording=String(active);
  if(recorder.result&&recorder.result!==recordResult&&!recorder.error){recordResult=recorder.result;if(recordUrl)URL.revokeObjectURL(recordUrl);recordUrl=URL.createObjectURL(recordResult.blob);$('#record-download').href=recordUrl;$('#record-download').download='Sillage-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+recordResult.extension;$('#record-preview').src=recordUrl;}
  $('#record-download').hidden=active||!recordUrl;$('#record-preview').hidden=active||!recordUrl;
  $('#record-status').textContent=recorder.error?'Enregistrement interrompu : '+recorder.error.message:active?'Capture de la sortie master en cours. Cliquez sur STOP pour récupérer votre mix.':recordResult?'Votre mix est prêt · '+time(recordResult.duration)+' · '+(recordResult.blob.size<1048576?Math.ceil(recordResult.blob.size/1024)+' Ko.':(recordResult.blob.size/1048576).toFixed(1)+' Mo.'):'Enregistrez le mix de vos platines, avec les effets et les transitions.';
}
recorder.addEventListener('change',updateRecordingUI);recorder.addEventListener('warning',event=>toast(event.detail));
$('#record-preview').onplay=()=>{sampleBank.stopAll();engine.stopTextures();stopAutomix();liveMixer.muteAll();engine.silence();applyPreviewOutput();};
$('#record-toggle').onclick=()=>run(async()=>{if(recorder.state==='recording'){await recorder.stop();toast('Votre mix est prêt à écouter et à télécharger.');}else if(recorder.state==='idle'){if(!engine.decks.some(deck=>deck.track)&&!liveMixer.state.inputs.some(input=>input.armed&&input.monitor&&input.talking))throw new Error('Chargez un morceau ou diffusez une entrée live avant d’enregistrer.');await prepareLocalPlayback();await recorder.start(engine);}});
window.addEventListener('beforeunload',event=>{if(recorder.state!=='idle'){event.preventDefault();event.returnValue='';}});
$$('[data-view]').forEach(button=>{button.onclick=()=>{document.body.dataset.view=button.dataset.view;$$('[data-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));savePreferences();};});
$$('[data-preset]').forEach(button=>{button.onclick=()=>{const preset=transitionPresets[button.dataset.preset];$('#transition-style').value=preset.style;if(preset.profile)$('#set-profile').value=preset.profile;$('#transition-beats').value=preset.beats;$('#tempo-sync').checked=preset.sync;$('#tempo-blend').checked=preset.tempoBlend;$('#quantize').checked=preset.quantize;savePreferences();updateSessionPanel();toast('Scénario '+preset.label+' prêt.');};});
for(const selector of ['#transition-style','#transition-beats','#tempo-sync','#tempo-blend','#tempo-shape','#overlap-protect','#tempo-limit','#align-arrival','#quantize','#set-profile','#transition-intensity'])$(selector).addEventListener('change',()=>{savePreferences();updateSessionPanel();updateDJSession();if(sortBy==='match')renderLibrary();});
$('#master').addEventListener('change',savePreferences);
$('#library-sort').onchange=event=>{sortBy=event.target.value;renderLibrary();};
$$('[data-sort]').forEach(button=>button.onclick=()=>{sortBy=button.dataset.sort;$('#library-sort').value=sortBy;renderLibrary();});
$('#session-folder').onclick=()=>{$('[data-source="folders"]').click();$('.library').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
$('#session-toggle').onclick=()=>$('#automix-toggle').click();
$('#session-next').onclick=()=>{if(engine.transition)return;fillNextDeck(engine.crossfade<.5?0:1,{alternate:true});renderLibrary();update();};
$('#session-mode').onchange=()=>{djSession.mode=$('#session-mode').value;if(djSession.enabled&&!engine.transition){fillNextDeck(engine.crossfade<.5?0:1,{force:true});renderLibrary();}update();};
$('#queue-show').onclick=()=>{$('[data-source="queue"]').click();$('.library').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
$('#queue-add-all').onclick=()=>prepareSet(selectedTracks());
$('#queue-clear').onclick=()=>replaceQueue([]);
$('#queue-undo').onclick=()=>{if(!lastQueue)return;queue.splice(0,queue.length,...lastQueue);lastQueue=null;renderLibrary();};
$('#queue-organize').onclick=()=>{const active=engine.crossfade<.5?0:1,other=1-active,items=queue.map(id=>libraryTrack(id)).filter(Boolean),ordered=[],played=[];let current=prepared[other]?engine.decks[other].track:engine.decks[active].track;while(ordered.length<items.length){const next=selectNextTrack(current,items,{mode:'compatible',played,transition:transitionOptions()});if(!next)break;ordered.push(next.id);played.push(next.id);current=next;}replaceQueue(ordered);toast('La file suit la proximité de tempo, de tonalité et d’énergie.');};
$('#tracklist-export').onclick=()=>{const csv=csvTracklist(selectedTracks());if(tracklistUrl)URL.revokeObjectURL(tracklistUrl);tracklistUrl=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));$('#tracklist-download').href=tracklistUrl;$('#tracklist-content').value=csv;$('#tracklist-dialog').showModal();};
$('#tracklist-copy').onclick=()=>run(async()=>{try{await navigator.clipboard.writeText($('#tracklist-content').value);toast('La liste a été copiée.');}catch{$('#tracklist-content').focus();$('#tracklist-content').select();toast('Texte sélectionné. Utilisez Ctrl + C pour copier la liste.');}});
function transitionOptions(){return ({history:engine.transitionHistory,profile:$('#set-profile').value,intensity:Number($('#transition-intensity').value), beats: Number($('#transition-beats').value), style: $('#transition-style').value, quantize: $('#quantize').checked, sync: $('#tempo-sync').checked,tempoBlend:$('#tempo-blend').checked,protectOverlap:$('#overlap-protect').checked,tempoShape:$('#tempo-shape').value,maxTempoPercent:Number($('#tempo-limit').value),alignArrival:$('#align-arrival').checked } );}
async function auditionTransition(){
  await prepareLocalPlayback();automix=false;engine.cancelTransition();
  const active=engine.crossfade<.5?0:1,other=1-active,a=engine.decks[active],b=engine.decks[other];
  if(!a.track||!b.track)throw new Error('Chargez un morceau sur A et sur B pour écouter leur passage.');
  engine.pause(active);engine.pause(other);engine.setCrossfade(active);
  const options=transitionOptions(),plan=makeTransitionPlan(a,b,{...options,position:0,stemsAvailable:Boolean(a.track.stemBuffer&&b.track.stemBuffer)});
  const point=plan.outPoint??a.track.mixOut??Math.max(0,a.track.buffer.duration-plan.seconds);
  await engine.seek(active,Math.max(0,point-6*a.rate));await engine.play(active);await engine.startTransition({...options,automix:true});
  toast('Écoute du passage : six secondes de contexte, puis la transition préparée.');update();
}
$('#transition-audition').onclick=()=>run(auditionTransition);
async function launchTransition() {
  if (engine.transition) { engine.cancelTransition(); update(); return; }
  await prepareLocalPlayback();const target=engine.crossfade<0.5?1:0;if(!prepared[target]){const next=await ensureLibraryTrack(queue[0],5);if(!next)throw new Error('Chargez le prochain titre sur la platine libre ou ajoutez-le à la file.');queue.shift();loadDeck(target,next);renderLibrary();}await engine.startTransition(transitionOptions()); sessionStart ??= Date.now();
}
$('#transition-start').onclick=()=>run(launchTransition);

function selectedTracks(){
 const query=$('#search').value.toLocaleLowerCase('fr'),all=libraryRows(),items=source==='queue'?queue.map((id,queueIndex)=>{const track=libraryTrack(id);return track?{...track,queueIndex}:null;}).filter(Boolean):source==='favorites'?all.filter(t=>t.favorite):all;
 const result=items.filter(t=>(t.title+' '+t.artist).toLocaleLowerCase('fr').includes(query));
 if(source==='queue'||sortBy==='order')return result;
 if(sortBy==='match'){const active=engine.decks[engine.crossfade<.5?0:1].track;return rankCandidates(selectionSource(),result.filter(t=>t.id!==active?.id),{transition:transitionOptions()}).map(r=>r.track).concat(result.filter(t=>t.id===active?.id));}
 return sortTracks(result,sortBy);
}
function renderLibrary(){
 const folders=source==='folders',allItems=selectedTracks();libraryCount=allItems.length;libraryPage=Math.min(libraryPage,Math.max(0,Math.ceil(libraryCount/100)-1));const items=allItems.slice(libraryPage*100,(libraryPage+1)*100);
 $('#folder-browser').hidden=!folders;$('.track-table-wrap').hidden=folders;$('.library-actions').hidden=folders;
 $('#local-count').textContent=libraryRows().length;$('#queue-count').textContent=queue.length;$('#favorite-count').textContent=libraryRows().filter(t=>t.favorite).length;
 $('#library-title').textContent=folders?'Vos dossiers':source==='queue'?'File Automix':source==='favorites'?'Vos favoris':'Collection locale';
 $('#library-subtitle').textContent=folders?'Parcourez vos fichiers et chargez-les directement sur les platines.':source==='queue'?'Les prochains morceaux, dans l’ordre de lecture.':'Vos fichiers audio, prêts à mixer.';
 $('#library-total').textContent=folders?'Bibliothèque sur cet ordinateur':libraryCount+' morceau'+(libraryCount>1?'x':'')+(libraryCount?' · '+time(allItems.reduce((sum,t)=>sum+t.buffer.duration,0)):'');
 $('#library-hint').textContent=folders?'A / B : charger · + : ajouter à la file':'Glisser sur une platine · A / B pour charger · + pour la file';
 $('.search-field').hidden=folders;$('#queue-add-all').hidden=source==='queue';$('#queue-add-all').disabled=!items.length;$('#queue-clear').hidden=source!=='queue';$('#queue-clear').disabled=!queue.length;$('.sort-control').hidden=source==='queue';$('#tracklist-export').disabled=!items.length;
 $('#empty-state').hidden=items.length>0;$('#empty-state h2').textContent=source==='queue'?'Préparez la suite de votre set':$('#search').value?'Aucun morceau trouvé':source==='favorites'?'Gardez vos valeurs sûres':'Votre set commence ici';
 $('#empty-state p').textContent=source==='queue'?'Ajoutez des titres avec le bouton +.':'Ouvrez Dossiers pour retrouver votre musique, ou importez des fichiers.';$('#demo-empty').hidden=true;
 $('#track-list').innerHTML=items.map((t,i)=>'<tr data-track="'+esc(t.id)+'" draggable="true"><td>'+String(i+1).padStart(2,'0')+'</td><td><div class="track-cell"><div class="cover-art" style="--hue:'+Number(t.color||180)+'">'+(t.cover?'<img src="'+esc(t.cover)+'" alt="" loading="lazy">':'<span>≋</span>')+'</div><div><div class="track-name">'+esc(t.title)+'</div><div class="track-artist">'+esc(t.artist)+'</div></div></div></td><td><span class="track-key">'+keyLabel(t)+'</span></td><td>'+(t.bpm||'—')+'</td><td>'+time(t.buffer.duration)+'</td><td><div class="row-actions"><button class="load-button a" data-load="0" data-id="'+esc(t.id)+'" aria-label="Charger '+esc(t.title)+' sur A">A</button><button class="load-button b" data-load="1" data-id="'+esc(t.id)+'" aria-label="Charger '+esc(t.title)+' sur B">B</button><button class="load-button" data-queue="'+esc(t.id)+'" data-index="'+i+'" aria-label="'+(source==='queue'?'Retirer':'Ajouter')+' '+esc(t.title)+' à la file">'+(source==='queue'?'−':'+')+'</button></div></td></tr>').join('');
 $$('[data-load]').forEach(btn=>btn.onclick=()=>{run(()=>requestLibraryLoad(btn.dataset.id,Number(btn.dataset.load)));});
 $$('[data-queue]').forEach(btn=>btn.onclick=()=>replaceQueue(source==='queue'?queue.filter((_,index)=>index!==Number(btn.dataset.index)):[...queue,btn.dataset.queue]));
 $$('[data-track]').forEach(row=>row.ondragstart=event=>event.dataTransfer.setData('text/track-id',row.dataset.track));
 $$('#track-list tr').forEach((row,index)=>{const t=items[index],actions=row.querySelector('.row-actions'),favorite=document.createElement('button');favorite.className='favorite-button'+(t.favorite?' active':'');favorite.innerHTML=icon('star');favorite.setAttribute('aria-label',(t.favorite?'Retirer ':'Ajouter ')+t.title+(t.favorite?' des favoris':' aux favoris'));favorite.setAttribute('aria-pressed',String(Boolean(t.favorite)));favorite.onclick=()=>{const real=tracks.find(track=>track.id===t.id),record=library.get(t.id);if(real){real.favorite=!real.favorite;savePreparation(real);}if(record){record.favorite=real?real.favorite:!t.favorite;if(record.meta)record.meta.favorite=record.favorite;library.emit();}renderLibrary();};actions.prepend(favorite);const coverButton=document.createElement('button');coverButton.className='load-button artwork-edit';coverButton.textContent='▧';coverButton.title='Choisir une pochette';coverButton.setAttribute('aria-label','Choisir la pochette de '+t.title);coverButton.disabled=!tracks.some(track=>track.id===t.id);coverButton.onclick=()=>openArtwork(tracks.find(track=>track.id===t.id));actions.append(coverButton);
  const record=library.get(t.id),state=record?.state;row.querySelectorAll('[data-load]').forEach(button=>button.disabled=Boolean(record&&!record.file&&!window.sillageDesktop));if(state&&state!=='ready'){const badge=document.createElement('span');badge.className='library-state';badge.dataset.state=state;badge.textContent=({discovered:'À charger',queued:'En attente',decoding:'Chargement…',stored:'Sur disque',missing:'À retrouver',cancelled:'Import annulé',error:'Erreur'})[state]||state;badge.title=record.error||'';row.querySelector('.track-artist').append(badge);}row.draggable=Boolean(tracks.some(track=>track.id===t.id));
  const analyze=document.createElement('button');analyze.className='load-button reanalyze-track';analyze.textContent='↻';analyze.title='Réanalyser BPM, tonalité et repères automatiques';analyze.setAttribute('aria-label','Réanalyser '+t.title);analyze.disabled=['queued','analyzing'].includes(t.analysisStatus)||Boolean(t.analysisReanalyzing);analyze.onclick=()=>run(async()=>{const track=await ensureLibraryTrack(t.id,20);if(track)await engine.analyzeTrack(track,{force:true,deferAnalysis:true,priority:20});});actions.append(analyze);
  if(source==='queue'){row.dataset.qIndex=t.queueIndex;row.querySelector('[data-queue]').dataset.index=t.queueIndex;for(const [delta,label] of [[-1,'Monter'],[1,'Descendre']]){const button=document.createElement('button');button.className='queue-move';button.textContent=delta<0?'↑':'↓';button.setAttribute('aria-label',label+' '+t.title);button.disabled=t.queueIndex+delta<0||t.queueIndex+delta>=queue.length;button.onclick=()=>replaceQueue(moveQueueItem(queue,t.queueIndex,t.queueIndex+delta));actions.prepend(button);}}
 });
 $$('#track-list tr').forEach((row,index)=>{const t=items[index];if(t.analysisError||(t.analysisStatus&&t.analysisStatus!=='ready')){const badge=document.createElement('span');badge.className='analysis-badge';badge.dataset.state=t.analysisStatus;badge.textContent=t.analysisError?'Analyse à relancer':({queued:'Analyse en attente',analyzing:'Analyse…',error:'Analyse à relancer',cancelled:'Analyse annulée'})[t.analysisStatus]||'';row.querySelector('.track-artist')?.append(' · ',badge);}});
 bindQueueDrag($('#track-list'));renderQueuePreview();updateSessionPanel();reprioritizeLibrary(items);updateLibraryJobs();if(folders)folderBrowser.render();
}
$$('[data-source]').forEach(btn=>btn.onclick=()=>{source=btn.dataset.source;$('#search').value='';$$('[data-source]').forEach(b=>b.classList.toggle('active',b===btn));renderLibrary();if(source==='folders')folderBrowser.open().catch(error=>toast(error.message));});
$('#search').oninput=()=>{libraryPage=0;renderLibrary();};
async function importOne(file,{priority=0}={}){const record=library.discover([file])[0];return ensureLibraryTrack(record.id,priority);}
async function importFiles(files,target=null,{autoLoad=true,onTrack}={}){
 if(importing){if(target===null||!files.length)return toast('Un import est déjà en cours.');const t=await importOne(files[0],{priority:0});loadDeck(target,t);renderLibrary();return[t];}
 const entries=library.discover(files);renderLibrary();if(window.sillageDesktop?.rememberAudio){const tokens=files.map(f=>f.token).filter(Boolean);if(tokens.length)await window.sillageDesktop.rememberAudio(tokens).catch(()=>toast('Import disponible ; sa reprise Windows ne peut pas être mémorisée.'));}
 importing=true;const loadGeneration=[...libraryLoadSequence],originalLabel=$('#import-top').innerHTML;$('#import-top').disabled=true;let first=null;
 try{const batch=library.start(files,{onTrack:async t=>{first??=t;if(first===t){if(target!==null&&loadGeneration[target]===libraryLoadSequence[target])loadDeck(target,t);else if(target===null&&autoLoad&&!engine.decks[0].track&&loadGeneration[0]===libraryLoadSequence[0])loadDeck(0,t);}await onTrack?.(t);renderLibrary();update();}});const selected=await batch.promise;renderLibrary();update();if(batch.state!=='cancelled')toast(selected.length+' titre(s) disponible(s).');return selected;}
 finally{importing=false;$('#import-top').disabled=false;$('#import-top').innerHTML=originalLabel;updateLibraryJobs();}
}
$('#file-input').onchange = event => { const files = [...event.target.files]; const target = fileDeck; fileDeck = null; run(() => importFiles(files, target)); event.target.value = ''; };
function desktopFiles(entries){return entries.map(entry=>({...entry,arrayBuffer:()=>window.sillageDesktop.readAudio(entry.token),readMetadata:()=>window.sillageDesktop.audioMetadata?.(entry.token)}));}
async function importDesktop(entries,target=null,options){
 return await importFiles(desktopFiles(entries),target,options);
}
$('#import-top').onclick=()=>run(async()=>{fileDeck=null;if(window.sillageDesktop)await importDesktop(await window.sillageDesktop.chooseAudio());else $('#file-input').click();});
if(window.sillageDesktop){
 document.body.dataset.platform='windows';$('.workspace-label').firstChild.textContent='';$('.workspace-label').innerHTML='<span class="live-dot"></span> STUDIO WINDOWS <span class="version">/ 024.0</span>';
 $('#desktop-library').hidden=false;$('#desktop-library').onclick=()=>run(async()=>{const entries=await window.sillageDesktop.library();if(!entries.length)return toast('Importez des fichiers avec le sélecteur Windows pour mémoriser votre bibliothèque.');await importDesktop(entries);});
 window.sillageDesktop.ready({audioReady:false}).catch(()=>{});let lastPlaying=null;setInterval(()=>{const playing=engine.decks.some(d=>d.playing);if(playing!==lastPlaying){lastPlaying=playing;window.sillageDesktop.setPlaying(playing).catch(()=>{});if(playing)window.sillageDesktop.ready({audioReady:true}).catch(()=>{});}},500);
}

async function createDemoAsync(context,spec){if(typeof Worker==='undefined')return createDemo(context,spec);return new Promise((resolve,reject)=>{const worker=new Worker('/demo-worker.js',{type:'module'});worker.onmessage=({data})=>{worker.terminate();if(data.error)return reject(new Error(data.error));const length=data.channels[0].byteLength/4,buffer=context.createBuffer(data.channels.length,length,context.sampleRate);data.channels.forEach((channel,index)=>buffer.copyToChannel(new Float32Array(channel),index));resolve({...data.track,buffer});};worker.onerror=()=>{worker.terminate();reject(new Error('Démo indisponible.'));};worker.postMessage({sampleRate:context.sampleRate,spec});});}
async function demos() {
  if (demoLoaded) { toast('Les démos sont déjà dans votre collection.'); return; }
  $('#demo-load').disabled = true; $('#demo-empty').disabled = true;
  try {
    toast('Création des démos audio originales…');
    const ctx = await engine.init();
    const specs = [ { title: 'Afterglow', bpm: 120, root: 55, color: 190, variant: 0 }, { title: 'Velvet Hours', bpm: 124, root: 55, color: 30, variant: 1 }, { title: 'Blue Current', bpm: 122, root: 65.406, color: 250, variant: 2 } ];
    for (const spec of specs) {
      await new Promise(resolve => setTimeout(resolve, 20)); tracks.push(rememberTrack(await createDemoAsync(ctx, spec)));
    }
    demoLoaded = true; loadDeck(0, tracks.at(-3)); loadDeck(1, tracks.at(-2)); queue.push(tracks.at(-1).id);
    renderLibrary(); toast('Trois démos prêtes. Lancez A puis une transition, ou activez Automix.');
  } finally { $('#demo-load').disabled = false; $('#demo-empty').disabled = false; }
}
$('#demo-load').onclick = $('#demo-empty').onclick = () => run(demos);
let dragDepth = 0;
window.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
window.addEventListener('dragleave', event => { if (event.dataTransfer.types.includes('Files')) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').hidden = true; } });
window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
window.addEventListener('drop', event => { if (event.dataTransfer.files.length) { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; run(() => importFiles([...event.dataTransfer.files])); } });

async function toggleAutomix() {
  if(!automix&&!djSession.enabled&&source==='folders'&&folderBrowser.scope)return startFolderAutomix(folderBrowser.files,folderBrowser.scope,$('#session-mode').value);
  if (automix) { stopAutomix(); return; }
  nextPreparation.invalidate({clearFailures:true});automixScheduler.reset();
  const active = engine.crossfade < 0.5 ? 0 : 1;
  if(djSession.enabled&&!djSession.remaining(engine.decks[active].track)&&engine.position(active)>=(engine.decks[active].track?.buffer.duration||Infinity)-.05){if(window.sillageDesktop?.folderList&&djSession.scope?.id!=='selection'){const folder=await window.sillageDesktop.folderList(djSession.scope.id);return startFolderAutomix(folder.files,djSession.scope,djSession.mode);}const previous=[...djSession.tracks];prepareSet(previous);automix=true;await engine.play(0);update();return;}
  if(!djSession.enabled){const currentScope=engine.decks[active].track?.sourceFolders?.[0];if(currentScope&&window.sillageDesktop?.folderList){const folder=await window.sillageDesktop.folderList(currentScope.id);return startFolderAutomix(folder.files,currentScope,$('#session-mode').value);}if(!engine.decks[active].track&&viewedScope)return startFolderAutomix(viewedScope.files,viewedScope,$('#session-mode').value);}
  if (!engine.decks[active].track) throw new Error('Chargez au moins un morceau sur la platine active.');
  if(!djSession.enabled){const current=engine.decks[active].track,scope=current?.sourceFolders?.[0];if(scope){const items=tracks.filter(t=>t.sourceFolders?.some(f=>f.path===scope.path));djSession.start({scope,tracks:items,current,mode:$('#session-mode').value});queue.splice(0);prepared[1-active]=false;fillNextDeck(active);}}
  await prepareLocalPlayback(); automix = true;djSession.markPlayed(engine.decks[active].track);await engine.play(active); sessionStart ??= Date.now(); update();
}
$('#automix-toggle').onclick=()=>run(toggleAutomix);
engine.addEventListener('transitionend', event => {
  const { source: free } = event.detail; prepared[free] = false;
  djSession.markPlayed(engine.decks[event.detail.target].track);
  if(automix&&djSession.enabled){fillNextDeck(event.detail.target);renderLibrary();}
  else if (automix && queue.length) { const nextId = queue.shift(); const next = tracks.find(t => t.id === nextId); if (next) loadDeck(free, next); renderLibrary(); }
  updateDJSession();
});
engine.addEventListener('change', update);
engine.addEventListener('analysis',event=>{
 const track=event.detail.track;if(!tracks.includes(track))return;
 if(track.analysisStatus==='ready'){track.detectedKey={key:track.analysis.key,keyRoot:track.analysis.keyRoot,keyMode:track.analysis.keyMode,keyConfidence:track.analysis.keyConfidence};rememberTrack(track);}
 library.touch(track);scheduleLibraryBudget();
 remotePeakCache.delete(track);waveRemote.delete(track);
 renderLibrary();update();
});
engine.addEventListener('warning',event=>toast(event.detail));
nextPreparation=new NextPreparation({
 select:(context,failed)=>{const {active}=context,other=1-active;if(prepared[other]&&engine.decks[other].track&&!failed.has(engine.decks[other].track.id))return engine.decks[other].track;
  if(djSession.enabled){const queued=djSession.tracks.find(t=>t.id===queue[0]&&!failed.has(t.id)&&!djSession.played.has(t.id));return queued||djSession.next(selectionSource(active),{exclude:[...failed.keys()],transition:transitionOptions()});}
  while(queue.length){const t=libraryTrack(queue[0]);if(t&&!failed.has(t.id))return t;queue.shift();}return null;
 },
 ensure:async(candidate,c)=>{c.releases||=[];c.releases.push(library.retain(candidate.id));const t=candidate.buffer?.getChannelData?candidate:await ensureLibraryTrack(candidate.id,5)||candidate;if(t.ensureAudio&&!t.buffer?.getChannelData)await t.ensureAudio({priority:5});if(t.analysisTask&&['queued','analyzing'].includes(t.analysisStatus))await engine.analyzeTrack(t,{priority:5}).catch(()=>{});return t;},
 isCurrent:c=>automix&&c.launch===setLaunch&&!engine.transition&&(engine.crossfade<.5?0:1)===c.active&&engine.decks[c.active].track===c.source&&engine.decks[1-c.active].track===c.slot&&!engine.decks[1-c.active].playing,
 commit:(t,c)=>{const other=1-c.active;if(engine.decks[other].track!==t||!prepared[other])loadDeck(other,t,{preparing:true});if(queue[0]===t.id)queue.shift();renderLibrary();},
 reject:(t,c)=>{const other=1-c.active;if(engine.decks[other].track?.id===t.id){prepared[other]=false;engine.unload(other);c.slot=null;}for(let i=queue.length-1;i>=0;i--)if(queue[i]===t.id)queue.splice(i,1);renderLibrary();},
 release:c=>{for(const release of c.releases||[])release();c.releases=[];},
 onSkip:t=>toast('Titre indisponible : '+t.title+' · recherche du suivant.'),onState:()=>update()
});
const automixScheduler=new AutomixScheduler(engine,{
 enabled:()=>automix,options:transitionOptions,pending:()=>nextPreparation.busy||(automixImportLaunch===setLaunch&&library.pending),
 prepare:active=>{const slot=engine.decks[1-active].track;if(prepared[1-active]&&slot?.buffer?.getChannelData&&!['queued','analyzing'].includes(slot.analysisStatus)&&!nextPreparation.failed.has(slot.id))return true;return nextPreparation.prepare({active,source:engine.decks[active].track,slot,launch:setLaunch});},
 onExhausted:()=>{if(automixImportLaunch===setLaunch&&library.pending)return;automix=false;update();toast('Tous les titres du set ont été joués.');},
 onError:error=>{automix=false;toast(error.message);update();}
});
setInterval(()=>automixScheduler.tick(),100);
engine.addEventListener('naturalend',()=>automixScheduler.tick());

let lastMasterPeakDb=-100,lastContinuityPhase='off';const waveCanvases = $$('.waveform'), vinyls = $$('.vinyl');
function draw() {
  const colors={...appearance.colors,a:getComputedStyle(document.documentElement).getPropertyValue('--a').trim()||appearance.colors.a,b:getComputedStyle(document.documentElement).getPropertyValue('--b').trim()||appearance.colors.b};
  const progress = engine.tick();
  if (progress !== null && engine.transition) {
    const p=Math.max(0,progress);$$('.transition-stage').forEach((stage,index,all)=>{const at=Number(stage.dataset.at),next=Number(all[index+1]?.dataset.at??2);stage.classList.toggle('is-current',p>=at&&p<next);stage.classList.toggle('is-done',p>=next);});
    $('#crossfader').value = engine.crossfade;
    $('#transition-progress').style.width = `${progress * 100}%`;
    const stage=engine.transition.stages?.findLast(stage=>progress>=stage.at)?.label;
    const wait=engine.transition.start-engine.context.currentTime;
    $('#transition-status').textContent = wait>0?`Prêt · ${transitionName(engine.transition.style)} dans ${wait.toFixed(1)} s`:`${engine.transition.source ? 'B → A' : 'A → B'} · ${stage||Math.round(progress*100)+'%'} · ${Math.max(0, engine.transition.duration * (1 - progress)).toFixed(1)} s${engine.transition.tempoBlend?' · '+((engine.decks[engine.transition.source].track?.bpm||120)*engine.currentRate(engine.transition.source)).toFixed(1)+' → '+engine.transition.bpmB.toFixed(1)+' BPM':''}`;
  } else if (document.activeElement !== $('#crossfader')) $('#crossfader').value = engine.crossfade;
  for (let id = 0; id < 2; id++) {
    const canvas = waveCanvases[id],d = engine.decks[id],height=document.body.dataset.view==='waves'?160:94;if(canvas.height!==height)canvas.height=height;const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, pos = engine.position(id), duration = d.track?.buffer.duration || 1;
    ctx.clearRect(0, 0, w, h);
    if (d.track) {
      const beat=60/(d.track.bpm||120),span=waveZoom==='full'?duration:Math.min(duration,Number(waveZoom)*beat),from=clamp(pos-span*0.35,0,Math.max(0,duration-span)),to=from+span;
      visibleRanges[id]=[from,to];const xAt=seconds=>(seconds-from)/span*w,peaks=d.track.peaks;
      drawDJWaveform(ctx,{track:d.track,position:pos,from,to,width:w,height:h,colors,deckColor:id?colors.b:colors.a,transitionPlan:id===visualPlanSource?visualPlan:null,loop:d.loop,arrivalPoint:Boolean(visualPlan?.incomingLanding)&&d.track?.id===visualPlan.incomingLanding.trackId?visualPlan.incomingLanding:null});
      canvas.setAttribute('aria-valuenow',Math.round(pos/duration*100));
    } else { ctx.fillStyle = colors.grid; ctx.fillRect(0, h / 2, w, 1); }
    const deckEl = canvas.closest('.deck'); deckEl.querySelector('.elapsed').textContent = time(pos); deckEl.querySelector('.remaining').textContent = `− ${time(d.track ? duration - pos : 0)}`;
    const beatIndex=d.track&&d.playing?((Math.floor((pos-(d.track.downbeat??d.track.beatOffset??0))/(60/(d.track.bpm||120)))%4)+4)%4:-1;if(deckEl.dataset.beat!==String(beatIndex))deckEl.dataset.beat=beatIndex;
    vinyls[id].style.transform = `rotate(${appearance.settings.motion&&!appearance.reducedMotion?pos*200:0}deg)`;
    if(d.rateRamp){const effective=(d.track?.bpm||120)*engine.currentRate(id);if(document.activeElement!==deckEl.querySelector('.bpm-input'))deckEl.querySelector('.bpm-input').value=effective.toFixed(1);}
  }
  const metrics=engine.readAudioMetrics(),master=metrics.master;meterViews?.update(metrics,colors);
  lastMasterPeakDb=metrics.available?Math.max(master.left.peakDb,master.right.peakDb):-100;
  const db=metrics.available?Math.max(master.left.rmsDb,master.right.rmsDb):-100,level=clamp((db+60)/60,0,1);
  const phase=automixScheduler.state.phase;if(phase==='holding')$('#transition-status').textContent='Secours · prochain titre en préparation · '+Math.ceil(automixScheduler.state.remaining||0)+' s max';else if(lastContinuityPhase==='holding')updateTransitionText();lastContinuityPhase=phase;
  if (sessionStart) { const seconds = Math.floor((Date.now() - sessionStart) / 1000); $('#session-clock').textContent = `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${time(seconds % 3600)}`; }
  const recordTime=time(recorder.duration);if($('#record-timer').textContent!==recordTime)$('#record-timer').textContent=recordTime;
  publishProgramFrame(level);
  if(performance.now()-lastPumpUI>100){lastPumpUI=performance.now();programSettings?.update();if(pumpQuick){const s=engine.pumping?.state,on=engine.programOptions.pumpEnabled;pumpQuick.setAttribute('aria-pressed',String(on));pumpQuick.title='Sidechain · '+(s?.reductionDb||0).toFixed(1)+' dB';const meter=document.querySelector('#pump-quick-meter');if(meter)meter.value=s?.reductionDb||0;}}
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

let initialOutputRestored=false;
async function prepareLocalPlayback(){ $('#record-preview').pause();if(!initialOutputRestored){await engine.init();initialOutputRestored=true;await liveMixer.restoreOutput();} }
async function openAudioSettings(){consoleLayout?.openPane('live');consoleLayout?.liveRoot.scrollIntoView({behavior:'smooth',block:'start'});await audioSettings?.open();}
$('#settings-open').onclick=$('#mic-panel-open').onclick=()=>run(openAudioSettings);
$('#remote-open').onclick=()=>run(async()=>{if(!$('#remote-dialog').open)$('#remote-dialog').showModal();await remotePanel.open();});
$('#mic-talk-toggle').onclick=()=>run(()=>{audioIO.setTalk(!audioIO.state.talking);});
window.addEventListener('keydown', event => {
  if (event.ctrlKey||event.metaKey||event.altKey||['INPUT', 'SELECT', 'TEXTAREA','AUDIO'].includes(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
  if (event.code === 'Space') { if(document.activeElement.matches('button,a'))return;event.preventDefault(); $(`.deck[data-deck="${event.shiftKey ? 1 : 0}"] .play`).click(); }
  else if(/^Digit[1-8]$/.test(event.code)&&!event.repeat){event.preventDefault();const number=Number(event.code.at(-1))-1,id=number<4?0:1,slot=number%4;if(event.shiftKey){engine.clearHotCue(id,slot);savePreparation(engine.decks[id].track);}else $(`.deck[data-deck="${id}"] .hot-cue[data-slot="${slot}"]`).click();}
  else if (event.key.toLowerCase() === 't') { event.preventDefault(); $('#transition-start').click(); }
  else if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); engine.setCrossfade(engine.crossfade + (event.key === 'ArrowRight' ? 0.05 : -0.05)); $('#crossfader').value = engine.crossfade; updateTransitionText(); }
});
document.body.dataset.view=preferences.view;$$('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===preferences.view)));
$$('.wave-zoom').forEach(select=>select.value=waveZoom);$('#set-profile').value=preferences.profile;$('#transition-intensity').value=preferences.intensity;$('#transition-style').value=preferences.style;$('#transition-beats').value=preferences.beats;$('#tempo-sync').checked=preferences.sync;$('#tempo-blend').checked=preferences.tempoBlend;$('#tempo-shape').value=preferences.tempoShape;$('#overlap-protect').checked=preferences.protectOverlap;$('#tempo-limit').value=preferences.maxTempoPercent;$('#align-arrival').checked=preferences.alignArrival;$('#quantize').checked=preferences.quantize;
engine.setMaster(preferences.master);$('#master').value=preferences.master;$('#master-value').textContent=Math.round(preferences.master*100)+'%';
renderLibrary(); update();updateRecordingUI();renderSetHistory();

engine.addEventListener('transitionend',renderSetHistory);

function updateLiveStrip(){
 const state=liveMixer.state;
 $('#mic-live-state').textContent=state.activeInputs>1?state.activeInputs+' entrées actives':state.starting?'Autorisation en cours…':!state.armed?'Entrée désactivée':!state.monitor?'Entrée active · diffusion désactivée':state.talking?'Entrée diffusée dans le master':'Entrée active · muette';
 $('#mic-talk-toggle').disabled=!state.armed||!state.monitor;$('#mic-talk-toggle').textContent=state.talking?'Couper':'Parler';$('#mic-talk-toggle').setAttribute('aria-pressed',String(state.talking));
 $('#duck-live-state').textContent=state.options.duckEnabled?(state.reductionDb>.1?'Musique −'+state.reductionDb.toFixed(1)+' dB':'Autoduck armé'):'Autoduck désactivé';$('#duck-live-state').dataset.active=String(state.reductionDb>.1);
 const output=state.devices.find(device=>device.kind==='audiooutput'&&device.deviceId===state.actualOutputId);$('#output-live-label').textContent=output?.label||(!state.actualOutputId?'Sortie Windows par défaut':'Sortie audio sélectionnée');
}
let previewOutputId=null;
async function applyPreviewOutput(){const preview=$('#record-preview'),id=audioIO.state.actualOutputId;if(typeof preview.setSinkId==='function'&&previewOutputId!==id){try{await preview.setSinkId(id||'');previewOutputId=id;}catch{toast('La préécoute enregistrée utilise la sortie audio Windows.');}}}
liveMixer.addEventListener('change',()=>{updateLiveStrip();applyPreviewOutput();});liveMixer.addEventListener('meter',updateLiveStrip);updateLiveStrip();

const remoteJobs=[],remoteFiles=new Map(),remotePeakCache=new WeakMap(),remoteHands=new Map();let remoteLibrarySignature='',remoteLibraryRevision=0,remoteQueueSignature='',remoteQueueRevision=0,remoteRecordResult=null,remoteRecordId=null,remoteRecordReady=false,remoteRecordError='';
const coverRemote=new WeakMap(),waveRemote=new WeakMap(),artworkQueue=[];let artworkBusy=false;
function remoteCoverId(track){
 if(!track?.cover||!window.sillageDesktop?.publishArtwork)return null;
 let entry=coverRemote.get(track);
 if(!entry||entry.cover!==track.cover){entry={cover:track.cover,id:crypto.randomUUID(),sent:0};coverRemote.set(track,entry);}
 if(Date.now()-entry.sent>30000){entry.sent=Date.now();window.sillageDesktop.publishArtwork({id:entry.id,data:entry.cover}).catch(()=>{entry.sent=0;});}
 return entry.id;
}
function remoteWaveBands(track){if(!track?.waveBands)return null;let result=waveRemote.get(track);if(!result){const n=Math.min(640,track.waveBands.low?.length||0);result=Object.fromEntries(['low','mid','high'].map(b=>[b,Array.from({length:n},(_,i)=>Math.round((track.waveBands[b]?.[Math.floor(i*track.waveBands.low.length/n)]||0)*1000)/1000)]));waveRemote.set(track,result);}return result;}
async function applyArtwork(track,cover){if(!track||!/^data:image\/(jpeg|png|webp);base64,/.test(cover||''))return;track.cover=cover;track.coverRevision=(track.coverRevision||0)+1;await writeCover(track.fileKey,cover);recommendationSignature='';remoteLibrarySignature='';renderLibrary();update();publishProgramMetadata(true);}
function scheduleArtwork(track){if(track.cover){writeCover(track.fileKey,track.cover);return;}if(!window.sillageDesktop?.lookupArtwork)return;artworkQueue.push(track);drainArtwork();}
async function drainArtwork(){if(artworkBusy)return;artworkBusy=true;try{while(artworkQueue.length){const t=artworkQueue.shift();if(t.cover)continue;try{const result=await window.sillageDesktop.lookupArtwork({title:t.title,artist:t.artist,album:t.album||''});if(result?.cover&&!t.cover)await applyArtwork(t,result.cover);}catch{}}}finally{artworkBusy=false;}}
let artworkPanel=null,artworkDialog=null;
function openArtwork(track){if(!artworkDialog){artworkDialog=document.createElement('dialog');artworkDialog.className='artwork-dialog';const close=document.createElement('button');close.className='dialog-close';close.textContent='Fermer';close.onclick=()=>artworkDialog.close();const root=document.createElement('div');artworkDialog.append(close,root);document.body.append(artworkDialog);artworkPanel=new ArtworkPanel(root,{onApply:(cover,{track})=>applyArtwork(track,cover)});artworkDialog.addEventListener('close',()=>artworkPanel.close());}artworkDialog.showModal();run(()=>artworkPanel.open(track));}
function remoteTrack(track){return track?{id:track.id,readiness:library.stateFor(track.id)||'ready',title:track.title,artist:track.artist,bpm:track.bpm||0,key:keyLabel(track),duration:track.buffer.duration,coverId:remoteCoverId(track),favorite:Boolean(track.favorite)}:null;}
function remoteJob(label,action,kind='task'){
 if(remoteJobs.filter(job=>job.state==='running').length>=4)throw new Error('Attendez la fin des tâches en cours.');
 const job={id:crypto.randomUUID(),label,kind,state:'running',detail:'En cours…'};remoteJobs.push(job);while(remoteJobs.length>8){const index=remoteJobs.findIndex(item=>item.state!=='running');if(index<0)break;remoteJobs.splice(index,1);}
 Promise.resolve().then(()=>action(job)).then(message=>{job.state='done';job.detail=message||'Terminé';},error=>{job.state='failed';job.detail=error.message||'La tâche a échoué.';toast(job.detail);}).finally(update);
 return {jobId:job.id,message:label};
}
function remotePeaks(track){if(!track)return [];let peaks=remotePeakCache.get(track);if(!peaks){const source=track.peaks||[],n=Math.min(640,source.length);peaks=Array.from({length:n},(_,i)=>{const begin=Math.floor(i*source.length/n),end=Math.max(begin+1,Math.floor((i+1)*source.length/n));let value=0;for(let j=begin;j<end;j++)value=Math.max(value,source[j]||0);return Math.round(value*1000)/1000;});remotePeakCache.set(track,peaks);}return peaks;}
function remoteSnapshot(){
 const active=engine.transition?.source??(engine.crossfade<.5?0:1),current=engine.decks[active].track,t=engine.transition,ranked=djSession.enabled?djSession.recommendations(selectionSource(active),{exclude:[...nextPreparation?.failed.keys()||[]],transition:transitionOptions()}).slice(0,8):[],io=audioIO.state;
 const signature=libraryRows().map(t=>[t.id,t.bpm,t.keyRoot,t.keyMode,t.favorite,t.coverRevision||0,library.stateFor(t.id)].join(':')).join('|');if(signature!==remoteLibrarySignature){remoteLibrarySignature=signature;remoteLibraryRevision++;}const q=queue.join('|');if(q!==remoteQueueSignature){remoteQueueSignature=q;remoteQueueRevision++;}
 const metrics=engine.readAudioMetrics(),masterDb=metrics.available?Math.max(metrics.master.left.rmsDb,metrics.master.right.rmsDb):-100,masterPeakDb=metrics.available?Math.max(metrics.master.left.peakDb,metrics.master.right.peakDb):-100;
 return{capturedAt:Date.now(),skin:appearance.settings.skin,masterPeakDb,meters:metrics,decks:engine.decks.map(d=>({id:d.id,loading:Boolean(pendingLibraryLoads[d.id]||d.playRequest),coverId:remoteCoverId(d.track),waveBands:remoteWaveBands(d.track),arrangement:d.track?.arrangement,phraseCues:readPhraseCues(d.track),grid:gridStatus(d.track),braking:Boolean(d.braking),trackId:d.track?.id,manualKey:d.track?.manualKey,title:d.track?.title||'',artist:d.track?.artist||'',bpm:d.track?(d.track.bpm||0)*engine.currentRate(d.id):0,nativeBpm:d.track?.bpm,rate:engine.currentRate(d.id),rateRamp:tempoRampSnapshot(d.rateRamp,engine.context?.currentTime||0),key:d.track?keyLabel(d.track):'',duration:d.track?.buffer.duration||0,position:engine.position(d.id),playing:d.playing,loaded:Boolean(d.track),volume:d.volume,scratching:d.scratching,eq:d.eq,filter:d.filter,echo:d.echo,loop:d.loop,cue:d.cue,hotCues:d.track?.hotCues,mixIn:d.track?.mixIn,mixOut:d.track?.mixOut,beatOffset:d.track?.downbeat??d.track?.beatOffset,peaks:remotePeaks(d.track),effect:{kind:d.fx?.kind,amount:d.fx?.amount},stems:{ready:Boolean(d.track?.stemBuffer),active:Boolean(d.stemGains)||!d.playing&&Boolean(d.track?.stemBuffer),preparing:d.track?.stemPreparing,status:d.track?.stemStatus,levels:d.track?.stemLevels,muted:d.track?.stemMuted,solo:d.track?.stemSolo}})),stemOptions:stemSettings.get(),stemPreparation:stemSettings.preparation(),crossfader:engine.crossfade,master:engine.masterVolume,keyLock:engine.keyLock,keyLockProfile:engine.keyLockProfile,keyLockProfileBusy:!engine.canChangeKeyLockProfile(),keyLockLatencyMs:engine.keyLockAvailable?engine.keyLockLatency*1000:null,masterDb,automix:{enabled:automix,mode:djSession.mode,scopeName:djSession.scope?.name||'',remaining:djSession.remaining(current,{exclude:[...nextPreparation?.failed.keys()||[]]}),phase:automixScheduler.state.phase,holdRemaining:automixScheduler.state.remaining||0,preparation:nextPreparation.state},transition:{active:Boolean(t),progress:t?clamp((engine.context.currentTime-t.start)/t.duration,0,1):0,label:t?transitionName(t.style):'Prêt',tempoBlend:Boolean(t?.tempoBlend),tempoShape:t?.tempoShape,overlap:t?.overlap??visualPlan?.overlap,fromBpm:t?.bpmA,toBpm:t?.bpmB,bpm:t?(engine.decks[t.source].track?.bpm||120)*engine.currentRate(t.source):0,reason:t?.reason||(automixScheduler.state.phase==='holding'?'Secours · prochain titre en préparation':$('#mix-advice').textContent),seconds:t?.duration,incomingLanding:t?.incomingLanding??(!t?visualPlan?.incomingLanding:null),stages:t?.stages},transitionSettings:transitionOptions(),catalog:transitionCatalog,library:[],libraryTotal:libraryRows().length,libraryRevision:remoteLibraryRevision,recommendations:ranked.map(r=>({...remoteTrack(r.track),reason:r.reason})),queue:queue.slice(0,20).map(id=>remoteTrack(tracks.find(t=>t.id===id))).filter(Boolean),queueTotal:queue.length,queueRevision:remoteQueueRevision,sampler:sampleBank.state,program:engine.programOptions,pumping:engine.pumping?.state||{available:null,reductionDb:0,kick:false},liveInputs:liveMixer.state.inputs,duckReductionDb:liveMixer.state.reductionDb,audio:{...io,inputId:io.options.inputDeviceId,outputId:io.actualOutputId,outputLabel:io.devices.find(device=>device.kind==='audiooutput'&&device.deviceId===io.actualOutputId)?.label||'Sortie Windows par défaut'},recording:{id:remoteRecordId,state:recorder.state,duration:recorder.duration,available:remoteRecordReady,bytes:recorder.result?.blob?.size||0,error:recorder.error?.message||remoteRecordError},jobs:remoteJobs,history:engine.performanceLog.slice(-20)};
}
async function publishRemoteRecording(){
 if(!recorder.result||recorder.result===remoteRecordResult||!window.sillageDesktop?.publishRecording)return;
 remoteRecordResult=recorder.result;remoteRecordId=crypto.randomUUID();remoteRecordReady=false;remoteRecordError='';
 try{if(recorder.result.blob.size>256*1024*1024)throw new Error('Mix supérieur à 256 Mo : téléchargez-le sur le PC.');await window.sillageDesktop.publishRecording({id:remoteRecordId,bytes:await recorder.result.blob.arrayBuffer(),mime:recorder.result.blob.type});remoteRecordReady=true;}catch(error){remoteRecordError=error.message||'Enregistrement disponible sur le PC uniquement.';}
}
recorder.addEventListener('change',()=>{if(recorder.state==='starting'){remoteRecordReady=false;remoteRecordId=null;remoteRecordError='';}publishRemoteRecording();});
async function remoteQuery(c){
 if(c.type==='query:library'){
  let items=libraryRows().filter(t=>(!c.favorites||t.favorite)&&(t.title+' '+t.artist+' '+keyLabel(t)).toLocaleLowerCase('fr').includes((c.query||'').toLocaleLowerCase('fr')));
  if(c.sort==='match')items=rankCandidates(selectionSource(),items,{transition:transitionOptions()}).map(r=>r.track);else if(c.sort!=='order')items=sortTracks(items,c.sort);
  return{items:items.slice(c.offset,c.offset+c.limit).map(remoteTrack),total:items.length,offset:c.offset};
 }
 if(c.type==='query:queue')return{items:queue.slice(c.offset,c.offset+c.limit).map((id,index)=>{const t=libraryTrack(id);return t?{...remoteTrack(t),index:index+c.offset}:null;}).filter(Boolean),total:queue.length,offset:c.offset};
 if(c.type==='query:folders'){if(!window.sillageDesktop?.folderRoots)throw new Error('Ouvrez la version Windows.');return{roots:(await window.sillageDesktop.folderRoots()).map(f=>({id:f.token,name:f.name}))};}
 if(c.type==='query:folder'){
  const folder=await window.sillageDesktop.folderList(c.folderId),files=folder.files.filter(f=>f.name.toLocaleLowerCase('fr').includes((c.query||'').toLocaleLowerCase('fr'))),page=files.slice(c.offset,c.offset+c.limit);
  for(const entry of page)remoteFiles.set(entry.token,{entry,folderId:folder.token,scope:{id:folder.token,path:folder.path,name:folder.crumbs.at(-1)?.name||'Dossier'}});while(remoteFiles.size>5000)remoteFiles.delete(remoteFiles.keys().next().value);
  return{id:folder.token,name:folder.crumbs.at(-1)?.name,crumbs:folder.crumbs.map(f=>({id:f.token,name:f.name})),directories:folder.directories.map(f=>({id:f.token,name:f.name})),files:page.map(f=>({id:f.token,name:f.name,size:f.size})),total:files.length,offset:c.offset,truncated:folder.truncated};
 }
 if(c.type==='query:audio'){await engine.init();await liveMixer.refreshDevices();const io=liveMixer.state;return{devices:io.devices.map(d=>({id:d.deviceId,label:d.label,kind:d.kind})),inputId:io.options.inputDeviceId,outputId:io.actualOutputId};}
}
async function remoteCommand(command){
 const c=command,{type,deck}=c,d=engine.decks[deck];
 if(c.trackId&&type!=='library:load'&&type!=='recommendation:load'&&deck!==undefined&&d?.track?.id!==c.trackId)throw new Error('Le titre de cette platine a changé. Actualisez la console.');
 if(type.startsWith('query:'))return remoteQuery(c);
 if(type==='stems:configure'){stemSettings.configure(c.value);return;}if(type==='stems:cancelActive'){for(const controller of stemControllers.values())controller.abort();await window.sillageDesktop?.cancelActiveStems?.();return;}
 if(['deck:play','deck:pause','deck:toggle','deck:cue'].includes(type)){
  if(!d?.track)throw new Error('Chargez un titre sur cette platine.');await prepareLocalPlayback();stopAutomix();
  if(type==='deck:pause')await engine.brake(deck);else if(type==='deck:cue'){engine.pause(deck);await engine.seek(deck,d.cue);}else if(type==='deck:play')await engine.play(deck);else if(d.playing)await engine.brake(deck);else await engine.play(deck);if(d.playing)sessionStart??=Date.now();
 }else if(type==='deck:volume'){engine.setVolume(deck,c.value);$('[data-volume="'+deck+'"]').value=c.value;
 }else if(type==='deck:seek'){stopAutomix();await engine.seek(deck,c.position);
 }else if(type==='deck:phraseCue'){const result=engine.editPhraseCue(deck,c.value,{expectedRevision:c.expectedRevision});savePreparation(d.track);update();await window.sillageDesktop?.publishRemoteState?.(remoteSnapshot());return {...result,duration:d.track.buffer.duration};
 }else if(type==='deck:rate'){stopAutomix();await engine.setRate(deck,c.value);
 }else if(type==='deck:bpm'){engine.setGrid(deck,{bpm:c.value/d.rate,downbeat:d.track.downbeat??d.track.beatOffset??0});savePreparation(d.track);renderLibrary();
 }else if(type==='deck:sync'){stopAutomix();await engine.sync(deck);
 }else if(type==='deck:loop'){stopAutomix();engine.loop(deck,c.beats);
 }else if(type==='deck:jump'){stopAutomix();await engine.beatJump(deck,c.beats);
 }else if(type==='deck:hotcue'){if(c.action==='clear')engine.clearHotCue(deck,c.slot);else if(c.action==='set')engine.setHotCue(deck,c.slot);else{await prepareLocalPlayback();stopAutomix();await engine.triggerHotCue(deck,c.slot);}savePreparation(d.track);
 }else if(type==='deck:eq')engine.setEQ(deck,c.band,c.value);
 else if(type==='deck:filter')engine.setFilter(deck,c.value);
 else if(type==='deck:echo')engine.setEcho(deck,c.enabled);
 else if(type==='deck:fx'){await engine.init();engine.setDeckEffect(deck,c.kind,c.amount);}
 else if(type==='deck:roll'){await prepareLocalPlayback();stopAutomix();await engine.roll(deck,c.beats);}
 else if(type==='deck:rollEnd')await engine.endRoll(deck);
 else if(type==='deck:marker'){
  if(c.marker==='downbeat')engine.setDownbeat(deck);else if(c.marker==='cue')d.cue=engine.position(deck);else if(c.marker==='auto'){d.track.manualRegions=false;d.track.mixIn=d.track.analysis?.mixIn||0;d.track.mixOut=d.track.analysis?.mixOut??d.track.buffer.duration;d.cue=d.track.mixIn;}else{const pos=engine.position(deck);if(c.marker==='in'){if(pos>=(d.track.mixOut??d.track.buffer.duration)-.1)throw new Error('IN doit précéder OUT.');d.track.mixIn=pos;d.cue=pos;}else{if(pos<=(d.track.mixIn||0)+.1)throw new Error('OUT doit suivre IN.');d.track.mixOut=pos;}d.track.manualRegions=true;}savePreparation(d.track);
 }else if(type==='deck:key'){
  const select=$('.deck[data-deck="'+deck+'"] .deck-key-select'),option=[...select.options].find(o=>c.value==='auto'?o.value==='auto':o.textContent.endsWith('· '+c.value));if(!option)throw new Error('Clé inconnue.');select.value=option.value;select.onchange({target:select});
  }else if(type==='deck:scratchStart'){const track=d.track;if(d.scratching||d.scratchRequest)throw new Error('Un geste est déjà en cours.');await prepareLocalPlayback();if(d.track!==track||d.scratching||d.scratchRequest)throw new Error('La platine a changé.');stopAutomix();if(!await engine.beginScratch(deck))throw new Error('Scratch indisponible.');remoteHands.set(deck,{at:Date.now(),session:d.scratchSession,gestureId:c.gestureId});
 }else if(type==='deck:scratchMove'||type==='deck:scratchTo'){const hand=remoteHands.get(deck);if(!hand||hand.session!==d.scratchSession||hand.gestureId!==c.gestureId||!d.scratching)throw new Error('Geste de scratch terminé.');hand.at=Date.now();engine.scratchBy(deck,type==='deck:scratchTo'?c.position-hand.session.target:c.delta,c.elapsedMs);
 }else if(type==='deck:scratchEnd'){const hand=remoteHands.get(deck);if(!hand||hand.gestureId!==c.gestureId||hand.session!==d.scratchSession)throw new Error('Geste de scratch terminé.');remoteHands.delete(deck);await engine.endScratch(deck);
 }else if(['stems:mute','stems:solo','stems:preset'].includes(type)){if(!d.track?.stemBuffer||d.playing&&!d.stemGains)throw new Error('Préparez et activez les stems avant le dosage.');if(type==='stems:preset')engine.setStemPreset(deck,c.preset);else if(type==='stems:mute')engine.setStemMute(deck,c.stem,c.enabled);else engine.setStemSolo(deck,c.stem,c.enabled);
 }else if(type==='stems:level'){if(!d.track?.stemBuffer||d.playing&&!d.stemGains)throw new Error('Préparez et activez les stems avant le dosage.');engine.setStemLevel(deck,c.stem,c.value);
 }else if(type==='stems:cancel'){stemControllers.get(d.track)?.abort();}
 else if(type==='stems:prepare'){
  const track=d.track;if(track.stemBuffer){await engine.activateStems(deck);update();return;}if(stemSettings.preparation().active)throw new Error('Préparation déjà en cours.');
  return remoteJob('Stems · '+track.title,async job=>{const controller=new AbortController();stemControllers.set(track,controller);track.stemPreparing=true;track.stemStatus='Préparation…';try{await engine.init();await prepareStems(track,engine.context,window.sillageDesktop,state=>{job.detail=track.stemStatus=stemProgressLabel(state);update();},controller.signal,stemSettings.get());track.stemStatus='Stems prêts';return 'Stems prêts ; activez-les sur la platine pour les doser.';}finally{track.stemPreparing=false;stemControllers.delete(track);scheduleLibraryBudget();stemSettings.refresh();update();}});
 }else if(type==='mixer:crossfader'){stopAutomix();engine.setCrossfade(c.value);$('#crossfader').value=engine.crossfade;
 }else if(type==='mixer:master'){engine.setMaster(c.value);$('#master').value=engine.masterVolume;$('#master-value').textContent=Math.round(engine.masterVolume*100)+'%';savePreferences();
 }else if(type==='mixer:keyLockProfile'){await engine.setKeyLockProfile(c.value);savePreferences();
 }else if(type==='mixer:keyLock'){engine.keyLock=c.enabled;for(const item of engine.decks)if(item.playing){engine.pause(item.id);await engine.play(item.id);}}
 else if(type==='automix:toggle')await toggleAutomix();
 else if(type==='automix:mode'){if(!selectionModes[c.mode])throw new Error('Mode inconnu.');$('#session-mode').value=c.mode;$('#session-mode').onchange();}
 else if(type==='automix:mixNext')await mixNext();
 else if(type==='automix:next'){if($('#session-next').disabled)throw new Error('Aucune autre proposition disponible.');$('#session-next').onclick();}
 else if(type==='transition:start')await launchTransition();
 else if(type==='transition:cancel'){engine.cancelTransition();}
 else if(type==='transition:audition'){await auditionTransition();}
 else if(type==='transition:configure'){for(const [key,value]of Object.entries(c.value)){const selectors={style:'#transition-style',profile:'#set-profile',beats:'#transition-beats',intensity:'#transition-intensity',sync:'#tempo-sync',quantize:'#quantize',tempoBlend:'#tempo-blend',tempoShape:'#tempo-shape',protectOverlap:'#overlap-protect',maxTempoPercent:'#tempo-limit',alignArrival:'#align-arrival'},control=$(selectors[key]);if(typeof value==='boolean')control.checked=value;else control.value=value;}savePreferences();}
 else if(type==='folder:import'){
  if(importing||remoteJobs.some(j=>j.kind==='import'&&j.state==='running'))throw new Error('Une importation est déjà en cours.');if(c.deck!==null&&engine.decks[c.deck].playing)throw new Error('Mettez la platine en pause avant de charger.');
  return remoteJob(c.automix?'Démarrage du dossier en Automix':'Importation du dossier',async job=>{
   const folder=await window.sillageDesktop.folderList(c.folderId),scope={id:folder.token,path:folder.path,name:folder.crumbs.at(-1)?.name||'Dossier'};
   const selected=c.fileId?remoteFiles.get(c.fileId):null;if(c.fileId&&(!selected||selected.folderId!==c.folderId))throw new Error('Ce fichier n’est plus dans la page consultée. Actualisez le dossier.');
   const entries=c.fileId?[selected.entry]:folder.files;if(!entries.length)throw new Error('Aucun fichier audio dans ce dossier.');job.detail=entries.length+' titre(s) à analyser';
   if(c.automix){await startFolderAutomix(entries,scope,c.mode);return 'Automix lancé dans '+scope.name;}
   const imported=await importDesktop(entries,null,{autoLoad:false})||[];attachFolder(imported,scope);if(!imported.length)throw new Error('Aucun titre n’a pu être importé.');
   if(c.deck!==null){if(engine.decks[c.deck].playing)throw new Error('Titres importés ; chargement annulé car la platine joue maintenant.');loadDeck(c.deck,imported[0]);}
   if(c.queue)replaceQueue([...queue,...imported.map(t=>t.id)]);renderLibrary();return imported.length+' titre(s) importé(s)';
  },'import');
 }else if(type==='library:load'||type==='recommendation:load'){
  if(engine.transition||d?.playing)throw new Error('Mettez cette platine en pause avant de charger un titre.');const track=libraryTrack(c.trackId);if(!track)throw new Error('Titre indisponible.');if(type==='library:load'&&!track.buffer?.getChannelData)return remoteJob('Chargement prioritaire',async()=>await requestLibraryLoad(c.trackId,deck)?'Titre chargé':'Chargement annulé.','import');
  if(type==='recommendation:load'){const active=engine.crossfade<.5?0:1;if(deck===active||!djSession.enabled||djSession.played.has(track.id)||!djSession.tracks.some(item=>item.id===track.id))throw new Error('Proposition indisponible sur cette platine.');loadDeck(deck,track);planSessionQueue(track);}else{stopAutomix();loadDeck(deck,track);}renderLibrary();
 }else if(type==='library:favorite'){const track=tracks.find(t=>t.id===c.trackId),record=library.get(c.trackId);if(!track&&!record)throw new Error('Titre indisponible.');if(track){track.favorite=c.enabled;savePreparation(track);}if(record){record.favorite=c.enabled;if(record.meta)record.meta.favorite=c.enabled;library.emit();}renderLibrary();}
 else if(type==='sampler:trigger'){await prepareLocalPlayback();await sampleBank.trigger(c.slot);}
 else if(type==='sampler:stop')sampleBank.stop(c.slot);
 else if(type==='sampler:stopAll')sampleBank.stopAll();
 else if(type==='sampler:capture')await sampleBank.capture(c.slot,c.deck,{seconds:c.seconds});
 else if(type==='sampler:gain')sampleBank.setGain(c.slot,c.value);
 else if(type==='sampler:loop')sampleBank.setLoop(c.slot,c.enabled);
 else if(type==='sampler:clear')await sampleBank.clear(c.slot);
 else if(type==='queue:add'){if(!tracks.some(t=>t.id===c.trackId))throw new Error('Titre indisponible.');replaceQueue([...queue,c.trackId]);}
 else if(type==='queue:remove'){if(c.index>=queue.length||c.trackId&&queue[c.index]!==c.trackId)throw new Error('La file a changé.');replaceQueue(queue.filter((_,i)=>i!==c.index));}
 else if(type==='queue:move'){if(c.from>=queue.length||c.to>=queue.length||c.trackId&&queue[c.from]!==c.trackId)throw new Error('La file a changé.');replaceQueue(moveQueueItem(queue,c.from,c.to));}
 else if(type==='queue:clear')replaceQueue([]);
 else if(type==='queue:undo')$('#queue-undo').onclick();
 else if(type==='queue:organize')$('#queue-organize').onclick();
 else if(type==='audio:output')await liveMixer.selectOutput(c.deviceId);
 else if(type==='audio:input')liveMixer.configure(c.channel??0,{inputDeviceId:c.deviceId});
 else if(type==='audio:configure')liveMixer.configure(c.channel??0,c.value);
 else if(type==='audio:talk')liveMixer.talk(c.channel??0,c.enabled,{remote:true});
 else if(type==='audio:stop')liveMixer.stop(c.channel??0);
 else if(type==='audio:muteAll')liveMixer.muteAll();
 else if(type==='audio:resetFeedback')liveMixer.resetFeedback(c.channel??0);
 else if(type==='program:configure')engine.setProgramOptions(c.value);
 else if(type==='program:panic')panicProgram();
 else if(type==='audio:start'){const input=liveMixer.input(c.channel??0);if(input.state.armed||input.state.starting)throw new Error('L’entrée est déjà active ou en cours d’activation.');return remoteJob('Activation de l’entrée du PC',async()=>{await liveMixer.start(c.channel??0);return 'Entrée active ; sa diffusion reste contrôlée par le bouton Parler.';});}
 else if(type==='record:start'){if(!engine.decks.some(item=>item.track)&&!liveMixer.state.inputs.some(input=>input.armed&&input.monitor&&input.talking))throw new Error('Chargez un morceau ou diffusez une entrée live.');await prepareLocalPlayback();await recorder.start(engine);}
 else if(type==='record:stop'){return remoteJob('Finalisation de l’enregistrement',async()=>{await recorder.stop();await publishRemoteRecording();return remoteRecordError||'Mix prêt à écouter et télécharger.';});}
 else if(type==='texture:play'){await prepareLocalPlayback();await engine.init();const active=engine.crossfade<.5?0:1,item=engine.decks[active],bpm=(item.track?.bpm||120)*engine.currentRate(active);await engine.playTexture(c.kind,{duration:c.beats*60/bpm,intensity:c.intensity});}
 else if(type==='texture:stop')engine.stopTextures();
 else throw new Error('Commande indisponible.');
 update();window.sillageDesktop?.publishRemoteState?.(remoteSnapshot());return{ok:true,...(type==='deck:scratchStart'?{position:engine.position(deck)}:{})};
}
let remoteUnsubscribe,remotePublishing=false;
if(window.sillageDesktop?.onRemoteCommand){
 remoteUnsubscribe=window.sillageDesktop.onRemoteCommand(remoteCommand);
 const publish=async()=>{if(remotePublishing)return;remotePublishing=true;try{await window.sillageDesktop.publishRemoteState(remoteSnapshot());}catch{}finally{remotePublishing=false;}};
 publish();const timer=setInterval(publish,100),handTimer=setInterval(()=>{for(const [deck,hand]of remoteHands)if(Date.now()-hand.at>1200){remoteHands.delete(deck);if(engine.decks[deck].scratchSession===hand.session)engine.endScratch(deck).catch(()=>{});}},250);
 window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(handTimer);remoteUnsubscribe?.();});
}

window.addEventListener('sillage:appearance',()=>{cueColors.splice(0,4,...appearance.colors.cues);$$ ('.deck .hot-cue').forEach(button=>button.style.setProperty('--cue-color',cueColors[Number(button.dataset.slot)]));updateSessionPanel();});

const arrangementRoot=document.createElement('section');$('#analysis-regions').after(arrangementRoot);
const gridEditorRoot=document.createElement('section');$('#analysis-map').before(gridEditorRoot);let disposeGridEditor=null,disposePhraseEditor=null;const phraseEditorRoot=document.createElement('section');arrangementRoot.before(phraseEditorRoot);
const gridStyle=document.createElement('link');gridStyle.rel='stylesheet';gridStyle.href='/grid-editor.css';document.head.append(gridStyle);
$('#analysis-dialog').addEventListener('close',()=>{if($('#analysis-dialog').open)return;disposeGridEditor?.();disposeGridEditor=null;disposePhraseEditor?.();disposePhraseEditor=null;});
function showAnalysis(id){
 const t=engine.decks[id].track;if(!t)return toast('Chargez un morceau sur cette platine.');engine.refreshArrangement(t);
 const ownTrack=()=>{if(engine.decks[id].track!==t){$('#analysis-dialog').close();throw Error('La piste a changé. Rouvrez son analyse.');}};
 renderArrangement(arrangementRoot,t,{seek:position=>run(async()=>{ownTrack();stopAutomix();await engine.seek(id,position);update();}),setRegion:(kind,position)=>{ownTrack();Object.assign(t,mixRegionPatch(t,kind,position));if(kind==='in')engine.decks[id].cue=position;savePreparation(t);update();showAnalysis(id);},onError:error=>toast(error.message)});
 disposePhraseEditor?.();disposePhraseEditor=mountPhraseEditor(phraseEditorRoot,{getTrack:()=>t,position:()=>engine.position(id),isCurrent:()=>engine.decks[id].track===t,edit:(op,expected)=>{ownTrack();const result=engine.editPhraseCue(id,op,{expectedTrack:t,expectedRevision:expected.expectedRevision});savePreparation(t);update();return result;},seek:position=>{ownTrack();stopAutomix();return engine.seek(id,position);},onError:error=>toast(error.message)});
 $('#analysis-title').textContent=t.title;$('#analysis-subtitle').textContent=t.source==='demo'?'Signal synthétique · grille connue':'Analyse locale du signal complet · version '+(t.analysisVersion||1)+(t.cacheHit?' · cache local':'');
 const metrics=[['TEMPO',t.bpm?Number(t.bpm).toFixed(2)+' BPM':'Indéterminé'],['CONFIANCE RYTHMIQUE',t.confidence==='generated'?'Grille connue':t.confidence==='manual'?'Corrigée manuellement':Math.round((t.tempoConfidence||0)*100)+' %'],['STABILITÉ',t.beatStability!==undefined?Math.round(t.beatStability*100)+' %':'—',gridDetail(gridStatus(t)),(t.manualGrid?'Mesures automatiques avant correction. ':'')+'Écart des attaques détectées : '+(Number.isFinite(t.beatJitterMs)?t.beatJitterMs+' ms':'indisponible')],['NIVEAU ESTIMÉ',Number.isFinite(t.loudnessLUFS)?t.loudnessLUFS.toFixed(1)+' LUFS':'—'],['TONALITÉ ESTIMÉE',t.key&&t.keyConfidence>.35?t.key:'Incertaine'],['AUTO-GAIN',(20*Math.log10(t.autoGain||1)).toFixed(1)+' dB']];
 $('#analysis-metrics').innerHTML=metrics.map(([name,value,detail,hint])=>'<div title="'+esc(hint||'')+'"><small>'+name+'</small><strong>'+esc(value)+'</strong>'+(detail?'<span class="analysis-metric-detail">'+esc(detail)+'</span>':'')+'</div>').join('');
 $('#analysis-regions').textContent='Entrée '+preciseTime(t.mixIn||0)+' → '+preciseTime(t.introEnd??t.mixIn??0)+' · Sortie '+preciseTime(t.mixOut||0)+' → '+preciseTime(t.audibleEnd??t.buffer.duration);
 $('#analysis-notes').textContent=t.confidence==='generated'?'Les démos utilisent une grille déterministe. Importez vos morceaux pour évaluer l’analyse musicale.':t.confidence==='low'?'La pulsation est incertaine. L’Automix privilégie un relais court au tempo naturel. Vérifiez la grille et corrigez les repères IN / OUT au besoin.':'L’Automix utilise ces mesures pour limiter l’étirement du tempo, choisir la durée du relais et équilibrer le niveau. Les repères et la tonalité restent des estimations ; aucune séparation de voix n’est appliquée.';
 disposeGridEditor?.();disposeGridEditor=mountGridEditor(gridEditorRoot,{track:t,overview:$('#analysis-map'),position:()=>engine.position(id),playing:()=>engine.decks[id].playing,isCurrent:()=>engine.decks[id].track===t,colors:()=>appearance.colors,seek:async position=>{ownTrack();stopAutomix();await engine.seek(id,position);update();},toggle:async()=>{ownTrack();if(engine.decks[id].playing)engine.pause(id);else{await prepareLocalPlayback();ownTrack();stopAutomix();await engine.play(id);sessionStart??=Date.now();}update();},apply:(grid,options)=>{ownTrack();stopAutomix();engine.setGrid(id,grid,{...options,expectedTrack:t});savePreparation(t);renderLibrary();update();showAnalysis(id);},onError:error=>toast(error.message)});
 if(!$('#analysis-dialog').open)$('#analysis-dialog').showModal();
}

// Shared desktop views keep a single audio engine in the main studio window.
brand=newBranding();
consoleLayout=mountConsoleLayout({openAudio:()=>run(openAudioSettings),openBrand:()=>brand.open(),openSources:()=>{consoleLayout.sourcesDialog.showModal();sourcesPanel?.open();},onSeek:(id,seconds)=>run(async()=>{stopAutomix();await engine.seek(id,seconds);}),waveScratch:{
 getContext:deck=>{const track=engine.decks[deck].track;return track?{deck,track,duration:track.buffer.duration}:null;},
 isCurrent:context=>engine.decks[context.deck].track===context.track,
 getPosition:context=>engine.position(context.deck),getDuration:context=>context.duration,
 startScratch:async context=>{const d=engine.decks[context.deck];if(d.track!==context.track||d.scratching||d.scratchRequest)return false;await prepareLocalPlayback();if(d.track!==context.track||d.scratching||d.scratchRequest)return false;stopAutomix();const ready=await engine.beginScratch(context.deck);if(!ready||d.track!==context.track)return false;context.owner=d.scratchSession;return{position:engine.position(context.deck)};},
 moveScratch:(position,elapsed,context)=>{const d=engine.decks[context.deck];if(d.track===context.track&&d.scratchSession===context.owner)engine.scratchBy(context.deck,position-context.owner.target,elapsed);},
 endScratch:context=>{if(engine.decks[context.deck].scratchSession===context.owner)return engine.endScratch(context.deck);},onError:error=>toast(error.message)
 },openSurface:mode=>run(async()=>{if(!window.sillageDesktop?.openSurface)throw new Error('Fenêtres disponibles dans l’application Windows.');await window.sillageDesktop.openSurface(mode);})});
audioSettings=new LiveSettings(liveMixer,consoleLayout.liveRoot);
meterViews=mountAudioMeters({deckRoots:$$('.deck'),canvas:$('#vu-meter'),onReset:()=>engine.resetAudioPeaks()});
keyLockSettings=new KeyLockSettings($('#keylock-settings'),{get:()=>({profile:engine.keyLockProfile,busy:!engine.canChangeKeyLockProfile(),changing:Boolean(engine.keyLockProfileChanging),latencyMs:engine.keyLockLatency*1000,available:engine.keyLockAvailable,enabled:engine.keyLock}),set:async value=>{await engine.setKeyLockProfile(value);savePreferences();},onError:error=>toast(error.message)});
programSettings=new ProgramSettings(consoleLayout.programRoot,{get:()=>engine.programOptions,set:patch=>engine.setProgramOptions(patch),panic:panicProgram,meter:()=>engine.pumping?.state,onError:error=>toast(error.message)});
consoleLayout.programRoot.prepend(document.querySelector('#keylock-settings'));
engine.addEventListener('change',()=>programSettings?.update());
const pumpControls=document.createElement('div');pumpControls.className='mixer-pumping';pumpControls.innerHTML='<button id="pump-quick" aria-pressed="false" title="Sidechain léger de la musique">PUMP</button><meter id="pump-quick-meter" min="0" max="6" value="0" aria-label="Réduction sidechain"></meter><button id="pump-open" aria-label="Réglages sidechain">⚙</button>';document.querySelector('.mixer').append(pumpControls);pumpQuick=document.querySelector('#pump-quick');
pumpQuick.onclick=()=>run(async()=>{await engine.init();if(engine.pumping.state.available===false&&!engine.programOptions.pumpEnabled)throw new Error('Le sidechain nécessite AudioWorklet.');engine.setProgramOptions({pumpEnabled:!engine.programOptions.pumpEnabled});});
document.querySelector('#pump-open').onclick=()=>{consoleLayout.openPane('program');consoleLayout.programRoot.querySelector('.program-pumping').scrollIntoView({block:'nearest',behavior:'smooth'});};

sourcesPanel=new DownloadPanel(consoleLayout.sourcesRoot,{onImport:entry=>importDesktop([entry],null,{autoLoad:false}),onLoad:(entry,deck)=>importDesktop([entry],deck),onQueue:async entry=>{const selected=await importDesktop([entry],null,{autoLoad:false});if(selected?.length)replaceQueue([...queue,...selected.map(t=>t.id)]);},onOpenFolder:async()=>{const root=await window.sillageDesktop.downloadFolder();consoleLayout.sourcesDialog.close();$('[data-source="folders"]').click();folderBrowser.roots=await window.sillageDesktop.folderRoots();folderBrowser.renderRoots();await folderBrowser.navigate(root.token);$('.library').scrollIntoView({behavior:'smooth'});}});
consoleLayout.sourcesDialog.addEventListener('close',()=>sourcesPanel.close());
const sampleRoot=document.createElement('section');sampleRoot.className='sample-bank';$('.pro-performance-tools').append(sampleRoot);new SampleBankPanel(sampleRoot,sampleBank,{onError:error=>toast(error.message)});
sampleBank.addEventListener('change',()=>window.sillageDesktop?.publishRemoteState?.(remoteSnapshot()));
$('#mix-next').onclick=$('#automix-mix-next').onclick=()=>run(mixNext);$('#automix-play').onclick=()=>run(async()=>{const id=engine.crossfade<.5?0:1;await prepareLocalPlayback();if(engine.decks[id].playing)await engine.brake(id);else await engine.play(id);});
function panicProgram(){sampleBank.stopAll();engine.stopTextures();stopAutomix();liveMixer.muteAll();engine.silence();engine.setProgramOptions({muted:true});$('#record-preview').pause();toast('Programme coupé · MUTE pour rétablir la sortie.');}
let programChannel=null,programMetadataSignature='',programLastMetadata=null,programLastFrame=0;
try{programChannel=new BroadcastChannel('sillage-program-v13');programChannel.onmessage=event=>{if(event.data?.type==='ready')publishProgramMetadata(true);};}catch{}
const programBands=new Uint8Array(128);
function programMetadata(){return{type:'metadata',decks:engine.decks.map(d=>({id:d.track?.id||'empty-'+d.id,title:d.track?.title||'',artist:d.track?.artist||'',album:d.track?.album||'',bpm:(d.track?.bpm||0)*engine.currentRate(d.id),key:d.track?keyLabel(d.track):'',cover:d.track?.cover||null})),skin:appearance.settings.skin,brand:brand?.state,visual:brand?.visualSettings()};}
function publishProgramMetadata(force=false){const data=programMetadata(),signature=JSON.stringify([data.skin,data.brand,data.visual]),sameDecks=programLastMetadata?.decks.every((deck,i)=>Object.keys(data.decks[i]).every(key=>data.decks[i][key]===deck[key]));if(force||!sameDecks||signature!==programMetadataSignature){programMetadataSignature=signature;programLastMetadata=data;programChannel?.postMessage(data);}return data;}
function publishProgramFrame(level){if(!consoleLayout)return;const now=performance.now();if(now-programLastFrame<40)return;programLastFrame=now;const metadata=publishProgramMetadata();if(engine.analyser)engine.analyser.getByteFrequencyData(programBands);else programBands.fill(0);const bands=Array.from({length:64},(_,i)=>Math.max(programBands[i*2],programBands[i*2+1])/255);const frame={type:'frame',decks:engine.decks.map(d=>({id:d.track?.id||'empty-'+d.id,position:engine.position(d.id),duration:d.track?.buffer.duration||0,playing:d.playing})),active:engine.transition?.source??(engine.crossfade<.5?0:1),crossfader:engine.crossfade,level,bands};programChannel?.postMessage(frame);const active=frame.active,next=nextTrack(active);consoleLayout.update({...frame,transitioning:Boolean(engine.transition&&engine.context.currentTime>=engine.transition.start),transition:{active:Boolean(engine.transition),tempoBlend:Boolean(engine.transition?.tempoBlend),fromBpm:engine.transition?.bpmA,toBpm:engine.transition?.bpmB,bpm:engine.transition?(engine.decks[engine.transition.source].track?.bpm||120)*engine.currentRate(engine.transition.source):0,progress:engine.transition?clamp((engine.context.currentTime-engine.transition.start)/engine.transition.duration,0,1):0,sync:engine.transition?.sync,style:engine.transition?.style},skin:appearance.settings.skin,masterPeakDb:lastMasterPeakDb,next:next?{...next,waveform:next,arrivalPoint:Boolean(visualPlan?.incomingLanding)&&next.id===visualPlan.incomingLanding.trackId?visualPlan.incomingLanding:null,key:keyLabel(next),duration:next.buffer.duration}:null,brand:metadata.brand,visual:metadata.visual,decks:frame.decks.map((d,i)=>({...metadata.decks[i],...d,loop:engine.decks[i].loop,rate:engine.currentRate(i),nativeBpm:engine.decks[i].track?.bpm,tempoRamp:Boolean(engine.decks[i].rateRamp),waveform:engine.decks[i].track,arrivalPoint:Boolean(visualPlan?.incomingLanding)&&engine.decks[i].track?.id===visualPlan.incomingLanding.trackId?visualPlan.incomingLanding:null}))});}
window.addEventListener('sillage:brand',()=>publishProgramMetadata(true));
window.addEventListener('pagehide',()=>programChannel?.close(),{once:true});

const libraryWork=document.createElement('section');libraryWork.setAttribute('aria-label','Travaux de bibliothèque');document.querySelector('.library-actions').before(libraryWork);
libraryJobsView=new LibraryJobsView(libraryWork,{pause:()=>{library.batch?.state==='paused'?library.resume():library.pause();},cancel:()=>{setLaunch++;library.cancel();},resume:()=>run(resumeLibraryImport),reanalyzePause:()=>{engine.analysisQueue.setBackgroundPaused(!engine.analysisQueue.backgroundPaused);updateLibraryJobs();},page:delta=>{libraryPage=Math.max(0,libraryPage+delta);renderLibrary();}});
engine.addEventListener('change',()=>{library.drainSoon();scheduleLibraryBudget();});
loadLibrary().then(snapshot=>{if(snapshot)library.restore(snapshot);renderLibrary();}).catch(()=>{});

window.addEventListener('pagehide',()=>{clearTimeout(librarySaveTimer);saveLibrary(library.snapshot()).catch(()=>{});},{once:true});

const workspace=new Workspace({layout:consoleLayout,getState:()=>({decks:engine.decks,live:liveMixer.state,recording:recorder.state}),analyse:id=>showAnalysis(id),onError:error=>toast(error.message)});
