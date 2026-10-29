import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioEngine, createDemo } from '../public/engine.js';
import {transitionProgress} from '../public/transition-design.mjs';
import {makeTransitionPlan} from '../public/analysis.mjs';
import {readGrid,gridRevision} from '../public/grid-editor.mjs';

test('scheduled and Next arrivals put both measured downbeats at the real score handoff through tempo morphs',async()=>{
 for(const [a,b]of [[120,120],[110,98],[98,110],[80,160],[160,80]])for(const startNow of [false,true]){
  const e=new StudioEngine();await e.init();const make=(id,bpm)=>{const bar=240/bpm,at=.25+8*bar;return{id,bpm,confidence:'generated',downbeat:.25,beatOffset:.25,keyRoot:0,keyMode:'major',keyConfidence:1,buffer:{duration:180},audibleEnd:180,mixIn:0,mixOut:160,envelope:Array.from({length:1800},(_,i)=>i/10<at?.06:.2),bassEnvelope:Array.from({length:1800},(_,i)=>i/10<at?.01:.1),structure:Array.from({length:Math.floor(180/bar)},(_,i)=>({time:.25+i*bar,rms:i<8?.06:.2,density:.2}))};};
  e.load(0,make('a',a));e.load(1,make('b',b));await e.play(0);await e.startTransition({style:'auto',profile:'musical',automix:true,sync:true,tempoBlend:true,quantize:true,beats:16,startNow,skipBeats:4});const t=e.transition;assert.ok(t.incomingLanding,JSON.stringify({a,b,startNow,t}));e.context.currentTime=t.handoffAt;assert.ok(Math.abs(e.position(1)-t.incomingLanding.time)<1e-7);const sourceBar=(e.position(0)-.25)*a/240;assert.ok(Math.abs(sourceBar-Math.round(sourceBar))<1e-7);assert.equal(t.handoffAt,t.incomingLandingAt);
 }
});
test('late bounded arrivals fall back safely instead of claiming a target landmark at the wrong source bar',async()=>{
 const e=new StudioEngine();await e.init();const t=track('late');Object.assign(t,{confidence:'generated',keyRoot:0,keyMode:'major',keyConfidence:1,downbeat:0,beatOffset:0,envelope:Array.from({length:600},(_,i)=>i<160?.06:.2),bassEnvelope:Array.from({length:600},(_,i)=>i<160?.01:.1),structure:Array.from({length:30},(_,i)=>({time:i*2,rms:i<8?.06:.2,density:.2}))});e.load(0,{...t,id:'a'});e.load(1,{...t,id:'b'});e.decks[0].offset=59.6;await e.play(0);await e.startTransition({style:'auto',profile:'musical',automix:true,sync:true,tempoBlend:true,quantize:true,beats:16,startNow:true});assert.equal(e.transition.incomingLanding,null);assert.ok(e.transition.duration<.5);assert.ok(Number.isFinite(e.transition.inPoint));assert.ok(e.transition.reason.includes('écarté'));
});

test('grid preparation preserves the playing source, measured baseline and explicit regions',async()=>{
 const e=new StudioEngine();await e.init();const t=track('prepare');Object.assign(t,{manualRegions:true,mixIn:3.125,mixOut:48.875,hotCues:[7],analysis:{bpm:123.456,downbeat:.234567,beatOffset:.234567,confidence:'low'}});e.load(0,t);e.decks[0].rate=1.12;await e.play(0);const source=e.decks[0].source,baseline=structuredClone(t.analysis),rev=gridRevision(t);
 e.setGrid(0,{bpm:126.789,downbeat:10.123456},{expectedTrack:t,expectedRevision:rev});assert.equal(e.decks[0].source,source);assert.equal(e.decks[0].rate,1.12);assert.equal(t.mixIn,3.125);assert.equal(t.mixOut,48.875);assert.deepEqual(t.hotCues,[7]);assert.deepEqual(t.analysis,baseline);assert.equal(t.manualGrid,true);assert.equal(t.arrangement.downbeat,10.123456);
 e.setGrid(0,null,{automatic:true});assert.deepEqual(readGrid(t),{bpm:123.456,downbeat:.234567,beatOffset:.234567});assert.equal(t.manualGrid,false);assert.equal(t.confidence,'low');assert.equal(e.decks[0].source,source);assert.equal(t.mixIn,3.125);
});
test('invalid, stale or replaced grid preparations do not cancel the current transition or mutate a track',async()=>{
 const e=new StudioEngine();await e.init();const t=track('old');e.load(0,t);const rev=gridRevision(t);e.setGrid(0,{bpm:130,downbeat:.2});const current=JSON.stringify(t);let cancelled=0;e.cancelTransition=()=>cancelled++;
 assert.throws(()=>e.setGrid(0,{bpm:131,downbeat:0},{expectedRevision:rev}),/changé/);assert.throws(()=>e.setGrid(0,{bpm:NaN,downbeat:0}));assert.throws(()=>e.setGrid(0,null,{automatic:true}),/indisponible/);assert.equal(JSON.stringify(t),current);assert.equal(cancelled,0);
 e.load(0,track('replacement'));cancelled=0;assert.throws(()=>e.setGrid(0,{bpm:131,downbeat:0},{expectedTrack:t}),/changé/);assert.equal(cancelled,0);assert.equal(JSON.stringify(t),current);
});
test('applying a corrected grid recomputes automatic IN and OUT without changing a separately set cue',async()=>{
 const e=new StudioEngine();await e.init();const t=track('regions');Object.assign(t,{downbeat:0,beatOffset:0,manualGrid:false,regionAnalysisVersion:2,envelope:Array(600).fill(.2),bassEnvelope:Array(600).fill(.1),audibleEnd:60,manualRegions:false});e.load(0,t);t.mixIn=1.123;t.mixOut=58.789;e.decks[0].cue=1.123;e.load(1,t);e.decks[1].cue=7.654;e.setGrid(0,{bpm:100,downbeat:.25});assert.notEqual(t.mixIn,1.123);assert.notEqual(t.mixOut,58.789);assert.equal(e.decks[0].cue,t.mixIn);assert.equal(e.decks[1].cue,7.654);assert.equal(t.manualRegions,false);
});

test('loading and correcting a measured arrangement keeps manual regions and the active voice',async()=>{
 const engine=new StudioEngine();await engine.init();const t=createDemo(engine.context,0);
 Object.assign(t,{bpm:120,confidence:'generated',manualRegions:true,mixIn:3.41,mixOut:80.23,downbeat:0,audibleEnd:96,envelope:Array.from({length:960},(_,i)=>i<320?.05:.2),bassEnvelope:Array.from({length:960},(_,i)=>i<320?.01:.08),structure:Array.from({length:48},(_,i)=>({time:i*2,rms:i<16?.05:.2,density:.2}))});
 t.buffer={duration:96};engine.load(0,t);assert.ok(t.arrangement?.landmarks.some(p=>p.time===32));assert.equal(t.mixIn,3.41);assert.equal(t.mixOut,80.23);
 await engine.play(0);const source=engine.decks[0].source;engine.context.currentTime=10.5;engine.setDownbeat(0);assert.equal(engine.decks[0].source,source);assert.equal(t.arrangement.downbeat,t.downbeat);assert.ok(t.arrangement.landmarks.every(p=>Math.abs((p.time-t.downbeat)/2-Math.round((p.time-t.downbeat)/2))<1e-5));
});

test('scheduled arrangement relays survive short-score quantization and fractional-tempo grid precision',async()=>{
 const make=(id,bpm,change=92)=>{const bar=240/bpm,duration=100*bar;return{id,bpm,confidence:'generated',downbeat:0,beatOffset:0,mixIn:0,mixOut:duration-20,audibleEnd:duration,buffer:{duration},envelope:Array(Math.ceil(duration*10)).fill(.2),bassEnvelope:Array(Math.ceil(duration*10)).fill(.06),structure:Array.from({length:100},(_,i)=>({time:i*bar,rms:.2,density:i<change?.08:.5}))};};
 for(const [a,b,beats]of [[120,120,4],[110,98,16],[98,110,16]]){
  const e=new StudioEngine();await e.init();e.load(0,make('a',a));e.load(1,make('b',b,99));await e.play(0);await e.startTransition({style:'riser',beats,sync:true,quantize:true,automix:true,tempoBlend:a!==b});
  assert.ok(Math.abs(e.transition.handoffPosition-92*240/a)<1e-5,JSON.stringify({a,b,beats,actual:e.transition.handoffPosition,expected:92*240/a}));
 }
});

class Param {
  value = 0; events = [];
  cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
  setValueAtTime(value, time) { this.value = value; this.events.push({ type: 'value', value, time }); }
  setTargetAtTime(value, time) { this.value = value; this.events.push({ type: 'target', value, time }); }
  exponentialRampToValueAtTime(value,time){this.value=value;this.events.push({type:"exponential",value,time});}
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push({ type: 'ramp', value, time }); }
  setValueCurveAtTime(curve, time, duration) { this.events.push({ type: 'curve', curve, time, duration }); }
}
class AudioNode {
  gain = new Param(); frequency = new Param(); Q = new Param(); delayTime = new Param(); playbackRate = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  connect(target) { return target; } disconnect() {} start(time, offset) { this.startTime = time; this.startOffset = offset; } stop() { this.stopped = true; }
}
class Context {
  currentTime = 0; sampleRate = 22050; destination = new AudioNode();
  createConvolver(){return new AudioNode();} createOscillator(){return new AudioNode();}
  createChannelSplitter(){return new AudioNode();}createChannelMerger(){return new AudioNode();}
  createGain() { return new AudioNode(); } createBiquadFilter() { return new AudioNode(); }
  createDynamicsCompressor() { return new AudioNode(); } createAnalyser() { return new AudioNode(); }
  createBufferSource() { return new AudioNode(); } createDelay() { return new AudioNode(); }
  createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / sampleRate, sampleRate, getChannelData: i => data[i] }; }
  async resume() {}
}
globalThis.AudioContext = Context;
const track = (id, bpm = 120, duration = 60) => ({ id, bpm, beatOffset: 0, buffer: { duration }, peaks: [] });

test('scheduled automatic morph retains the energy handoff when the outgoing grid is uncertain',async()=>{for(const [a,b]of [[116.07,123.42],[123.42,116.07]]){const e=new StudioEngine();await e.init();const source={...track('uncertain',a,240),tempoConfidence:.69,beatStability:.58,downbeat:.371,audibleEnd:240,envelope:new Float32Array(2400).fill(.2)},target={...track('reliable',b,240),tempoConfidence:.86,beatStability:.80,downbeat:.217,audibleEnd:240,envelope:new Float32Array(2400).fill(.2)};e.load(0,source);e.load(1,target);await e.play(0);const options={style:'auto',profile:'musical',sync:true,quantize:true,tempoBlend:true,automix:true,beats:16},plan=makeTransitionPlan(e.decks[0],e.decks[1],options);assert.equal(plan.trustworthy,false);assert.equal(plan.tempoBlend,true);await e.startTransition(options);assert.ok(Math.abs(e.transition.handoffPosition-plan.handoffPosition)<1e-5,JSON.stringify({a,b,planned:plan.handoffPosition,actual:e.transition.handoffPosition}));}});

test('key-lock profile changes reject active playback without changing the running voice',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('active'));await e.play(0);const source=e.decks[0].source;
 await assert.rejects(e.setKeyLockProfile('rhythm'),/arrêt|pause/);assert.equal(e.keyLockProfile,'standard');assert.equal(e.decks[0].source,source);assert.equal(e.decks[0].playing,true);
});

test('playback waits for profile calibration and a pause still cancels the queued launch',async()=>{
 for(const cancel of [false,true]){const e=new StudioEngine();await e.init();e.load(0,track('pending'));let release;e.calibrateKeyLock=()=>new Promise(resolve=>release=resolve);const change=e.setKeyLockProfile('rhythm');await new Promise(r=>setImmediate(r));const play=e.play(0);await new Promise(r=>setImmediate(r));assert.equal(e.decks[0].source,null);if(cancel)e.pause(0);release(.06);await change;await play;assert.equal(e.keyLockProfile,'rhythm');assert.equal(e.keyLockLatency,.06);assert.equal(e.decks[0].playing,!cancel);assert.equal(e.keyLockProfileChanging,null);}
});

test('failed profile calibration preserves the old profile and does not strand a queued play',async()=>{
 const e=new StudioEngine();await e.init();e.keyLockLatency=.13;e.load(0,track('recovery'));let reject;e.calibrateKeyLock=()=>new Promise((_resolve,no)=>reject=no);const change=e.setKeyLockProfile('rhythm');await new Promise(r=>setImmediate(r));const play=e.play(0);reject(Error('calibration failed'));await assert.rejects(change,/calibration failed/);await play;assert.equal(e.keyLockProfile,'standard');assert.equal(e.keyLockLatency,.13);assert.equal(e.decks[0].playing,true);
});

test('cancelling a transition during profile calibration never starts either deck afterwards',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a'));e.load(1,track('b'));let release;e.calibrateKeyLock=()=>new Promise(resolve=>release=resolve);const change=e.setKeyLockProfile('rhythm');await new Promise(r=>setImmediate(r));const start=e.startTransition({style:'bass',quantize:false});await new Promise(r=>setImmediate(r));e.cancelTransition();e.pause(0);e.pause(1);release(.06);await change;await start;assert.equal(e.transition,null);assert.deepEqual(e.decks.map(d=>d.playing),[false,false]);assert.deepEqual(e.decks.map(d=>d.source),[null,null]);
});

test('cancellation after an incoming play only stops the source owned by that preparation',async()=>{
 for(const replace of [false,true]){const e=new StudioEngine();await e.init();e.load(0,track('a'));e.load(1,track('b'));await e.play(0);const play=e.play.bind(e);let release,held=false;e.play=(id,when)=>{const p=play(id,when);if(id===1&&!held){held=true;return p.then(()=>new Promise(resolve=>release=resolve));}return p;};const pending=e.startTransition({style:'bass',quantize:false});while(!release)await new Promise(r=>setImmediate(r));e.cancelTransition();let newer;if(replace){e.load(1,track('new'));await e.play(1);newer=e.decks[1].source;}release();await pending;assert.equal(e.transition,null);assert.equal(e.decks[0].playing,true);assert.equal(e.decks[1].playing,replace);if(replace)assert.equal(e.decks[1].source,newer);}
});

test('pausing or replacing a deck during buffer reacquisition cannot start obsolete playback',async()=>{
 for(const change of ['pause','load']){const e=new StudioEngine();await e.init();let release;const t=track('evicted');t.ensureAudio=()=>new Promise(resolve=>release=()=>{t.buffer={duration:60,getChannelData:()=>new Float32Array(1)};resolve(t);});e.load(0,t);const pending=e.play(0);await new Promise(r=>setImmediate(r));if(change==='pause')e.pause(0);else e.load(0,track('replacement'));release();await pending;assert.equal(e.decks[0].playing,false);assert.equal(e.decks[0].source,null);assert.equal(e.decks[0].playRequest,null);}
});
test('a cancelled transition waiting for an evicted target never schedules sources after the data arrives',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a'));const b=track('b');let release;b.ensureAudio=()=>new Promise(resolve=>release=()=>{b.buffer={duration:60,getChannelData:()=>new Float32Array(1)};resolve(b);});e.load(1,b);await e.play(0);const source=e.decks[0].source,pending=e.startTransition({style:'bass',quantize:false});await new Promise(r=>setImmediate(r));e.cancelTransition();release();await pending;assert.equal(e.transition,null);assert.equal(e.decks[0].source,source);assert.equal(e.decks[1].playing,false);
});
test('manual reanalysis keeps playing transport and user grid, regions, key, cues and favorite',async()=>{
 const e=new StudioEngine();await e.init();const samples=new Float32Array(11025*12);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i*.04)*.1;const buffer={duration:12,length:samples.length,sampleRate:11025,numberOfChannels:1,getChannelData:()=>samples},t={...track('reanalyze'),buffer,analysis:{rms:.2},manualGrid:true,bpm:127,downbeat:.23,beatOffset:.23,manualRegions:true,mixIn:1,mixOut:10,manualKey:true,keyRoot:0,keyMode:'minor',key:'Cm',keyConfidence:1,hotCues:[2,3,null,null],favorite:true};e.load(0,t);await e.play(0);const source=e.decks[0].source,old=t.analysis;await e.analyzeTrack(t,{force:true});assert.notEqual(t.analysis,old);assert.equal(t.bpm,127);assert.equal(t.downbeat,.23);assert.equal(t.mixIn,1);assert.equal(t.mixOut,10);assert.equal(t.key,'Cm');assert.deepEqual(t.hotCues,[2,3,null,null]);assert.equal(t.favorite,true);assert.equal(e.decks[0].source,source);assert.equal(e.decks[0].playing,true);
});
test('failed reanalysis retains the previous result and leaves playback usable',async()=>{
 const e=new StudioEngine();await e.init();const t={...track('failed'),buffer:{duration:1,length:8,numberOfChannels:1,sampleRate:8,getChannelData:()=>new Float32Array(8)},analysis:{rms:.123},analysisStatus:'ready'},old=t.analysis;e.load(0,t);await e.play(0);const Worker=globalThis.Worker;globalThis.Worker=class{constructor(){throw Error('Worker indisponible');}};try{await assert.rejects(e.analyzeTrack(t,{force:true}),/Worker indisponible/);}finally{globalThis.Worker=Worker;}assert.equal(t.analysis,old);assert.equal(t.analysisStatus,'ready');assert.equal(t.analysisReanalyzing,false);assert.equal(e.decks[0].playing,true);
});

test('emergency hold is armed before EOF, follows the audible cursor and releases without a position jump',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a',120,20));await e.play(0);e.context.currentTime=17;
 assert.equal(e.holdForNext(0),true);const d=e.decks[0],source=d.source,window=d.loop;assert.equal(window.kind,'continuity');assert.ok(window.end>17&&window.end<20);assert.equal(source.loop,true);
 const edge=d.continuity.fade.firstEdge;assert.ok(d.voiceGain.gain.events.some(event=>event.type==='ramp'&&event.time===edge&&event.value===0));assert.ok(d.voiceGain.gain.events.some(event=>event.type==='ramp'&&Math.abs(event.time-edge-.004)<1e-9&&event.value===1));
 e.context.currentTime=21;const cursor=e.position(0);assert.ok(cursor>=window.start&&cursor<window.end);e.releaseContinuity(0);assert.equal(d.loop,null);assert.equal(source.loop,false);assert.equal(e.position(0),cursor);e.context.currentTime+=.5;assert.equal(e.position(0),cursor+.5);
});
test('emergency hold never owns a manual loop and cannot survive pause, seek, unload or replacement',async()=>{
 for(const action of ['pause','seek','unload','load','loop']){
  const e=new StudioEngine();await e.init();e.load(0,track('a',120,20));await e.play(0);e.context.currentTime=17;assert.equal(e.holdForNext(0),true);
  if(action==='seek')await e.seek(0,3);else if(action==='load')e.load(0,track('new'));else if(action==='loop')e.loop(0,4);else e[action](0);
  assert.equal(e.decks[0].continuity,null,action);assert.notEqual(e.decks[0].loop?.kind,'continuity',action);
 }
 const e=new StudioEngine();await e.init();e.load(0,track('a'));await e.play(0);e.loop(0,4);const manual=e.decks[0].loop;assert.equal(e.holdForNext(0),false);e.releaseContinuity(0);assert.equal(e.decks[0].loop,manual);
});
test('a ready successor leaves emergency hold through a bounded scheduled transition',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a',120,20));e.load(1,track('b'));await e.play(0);e.context.currentTime=17;e.holdForNext(0);e.context.currentTime=21;
 await e.startTransition({style:'bass',beats:4,sync:false,quantize:false,tempoBlend:false,startNow:true,automix:true});
 assert.equal(e.decks[0].continuity,null);assert.equal(e.decks[0].loop,null);assert.ok(e.transition.duration<=2.01);assert.ok(e.transition.incomingStart<e.context.currentTime+.25);assert.equal(e.decks[1].playing,true);
});

test('a future scheduled passage can be cancelled for every family without ghost playback',async()=>{
 for(const style of ['bass','riser','echo','clean']){
  const e=new StudioEngine();await e.init();e.load(0,{...track('a'),manualRegions:true,mixOut:20});e.load(1,track('b'));
  await e.play(0);e.context.currentTime=16;await e.startTransition({style,automix:true,quantize:false,beats:4});
  const pending=e.decks[1].source;assert.ok(e.transition.incomingStart>16);e.cancelTransition();assert.equal(e.decks[1].playing,false);assert.equal(pending.stopped,true);assert.equal(e.crossfade,0);
 }
});

test('Automix recovers natural EOF without restarting the outgoing song',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a',120,5));e.load(1,track('b'));
 await e.play(0);const outgoing=e.decks[0].source;e.context.currentTime=5;outgoing.onended();
 assert.equal(e.decks[0].endedNaturally,true);await e.startTransition({style:'auto',profile:'musical',automix:true});
 assert.equal(e.decks[0].source,null);assert.equal(e.transition.style,'linear');assert.ok(e.transition.duration<=.2);assert.ok(e.decks[1].source.startTime<5.2);
});

test('a sub-beat loop contains the current cursor and loop release settles a tempo ramp',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a'));await e.play(0);e.context.currentTime=1.37;e.loop(0,.25);
 assert.ok(e.decks[0].loop.start<=1.37&&e.decks[0].loop.end>1.37);
 e.scheduleRate(0,1.2,e.context.currentTime,2);e.context.currentTime+=3;const before=e.position(0);e.loop(0,.25);const rate=e.decks[0].rate;
 assert.ok(Math.abs(e.position(0)-before)<1e-9);assert.equal(e.decks[0].rateRamp,null);e.context.currentTime+=.5;assert.ok(Math.abs(e.position(0)-before-.5*rate)<1e-9);
});

test('quantized loops start at the next grid point while immediate loops keep the exact cursor',async()=>{
 for(const quantize of [false,true]){
  const e=new StudioEngine();await e.init();e.load(0,{...track('a'),downbeat:.1});await e.play(0);e.context.currentTime=1.37;
  e.loop(0,.25,{quantize});assert.ok(Math.abs(e.decks[0].loop.start-(quantize?1.475:1.37))<1e-9);assert.ok(Math.abs(e.decks[0].loop.end-e.decks[0].loop.start-.125)<1e-9);
 }
});

test('musical clean handoff keeps the groove, starts the next track at its gain edge and cancels future transport',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,track('a',120));engine.load(1,track('b',142));
 await engine.startTransition({style:'auto',profile:'musical',sync:true,quantize:false,beats:32});const t=engine.transition,a=engine.decks[0],b=engine.decks[1];
 assert.equal(t.style,'clean');assert.equal(t.duration,8);assert.equal(b.source.startTime,t.incomingStart);assert.equal(t.incomingStart,t.start+6);assert.ok(a.echoSend.gain.events.some(e=>e.type==='ramp'&&e.value>0&&e.value<.3));assert.equal(a.delay.delayTime.value,.5);
 const out=a.fader.gain.events.findLast(e=>e.type==='curve'),incoming=b.fader.gain.events.findLast(e=>e.type==='curve');
 assert.ok(out.curve[Math.floor(out.curve.length*.7)]>.99);assert.equal(incoming.curve[Math.floor(incoming.curve.length*.7)],0);
 engine.context.currentTime=t.start+t.duration*.7;const future=b.source;engine.cancelTransition();assert.equal(b.playing,false);assert.equal(future.stopped,true);assert.equal(engine.crossfade,0);assert.equal(a.fader.gain.value,1);assert.equal(b.fader.gain.value,0);
});

test('cancelling after a clean handoff does not bring back an already silent outgoing track',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,track('a',120));engine.load(1,track('b',142));await engine.startTransition({style:'auto',profile:'musical',sync:true,quantize:false});const t=engine.transition;
 engine.context.currentTime=t.incomingStart+.1;engine.cancelTransition();assert.equal(engine.crossfade,1);assert.equal(engine.decks[0].fader.gain.value,Math.cos(Math.PI/2));assert.equal(engine.decks[1].fader.gain.value,1);assert.equal(engine.decks[1].playing,true);
});

test('automatic transport preserves explicit off-grid IN and OUT markers',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,{...track('a',120),confidence:'manual',manualRegions:true,mixOut:10.3});engine.load(1,{...track('b',124),confidence:'manual',manualRegions:true,mixIn:1.123});
 await engine.startTransition({style:'auto',profile:'musical',sync:true,quantize:true,automix:true,tempoBlend:false});assert.equal(engine.transition.inPoint,1.123);assert.equal(engine.transition.outPoint,10.3);
});

test('transport position, seek, rate changes and loops preserve the audio clock', async () => {
  const engine = new StudioEngine(); await engine.init(); engine.load(0, track('a'));
  await engine.play(0); engine.context.currentTime = 3;
  assert.equal(engine.position(0), 3);
  await engine.setRate(0, 1.5); engine.context.currentTime = 5;
  assert.equal(engine.position(0), 6);
  engine.pause(0); engine.context.currentTime = 8;
  assert.equal(engine.position(0), 6);
  await engine.seek(0, 10); engine.loop(0, 4); await engine.play(0);
  engine.context.currentTime = 10;
  assert.ok(engine.position(0) >= 10 && engine.position(0) < 12);
  assert.equal(engine.decks[0].source.loop, true);
  engine.loop(0, 4); assert.equal(engine.decks[0].source.loop, false);
});
test('audio transitions schedule both curves on the same clock, match BPM and finish on target', async () => {
  const engine = new StudioEngine(); await engine.init(); engine.load(0, track('a')); engine.load(1, track('b', 128));
  await engine.play(0); engine.context.currentTime = 1.13;
  await engine.startTransition({ beats: 16, tempoBlend:false });
  const transition = engine.transition;
  assert.ok(Math.abs(transition.start - 2) < 1e-6);
  assert.equal(transition.duration, 8);
  assert.equal(engine.decks[1].rate, 120 / 128);
  const curveA = engine.decks[0].fader.gain.events.findLast(e => e.type === 'curve');
  const curveB = engine.decks[1].fader.gain.events.findLast(e => e.type === 'curve');
  assert.equal(curveA.time, curveB.time); assert.equal(curveA.duration, curveB.duration);
  for (let i = 0; i < curveA.curve.length; i++) assert.ok(Math.abs(curveA.curve[i] ** 2 + curveB.curve[i] ** 2 - 1) < 1e-6);
  engine.context.currentTime = transition.start + 4; assert.equal(engine.tick(), 0.5);
  engine.context.currentTime = transition.start + 8; engine.tick();
  assert.equal(engine.crossfade, 1); assert.equal(engine.decks[0].playing, false); assert.equal(engine.decks[1].playing, true);
});
test('Tempo Blend integrates both playback clocks and finishes at the native target tempo',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a',120));engine.load(1,track('b',128));
  await engine.startTransition({beats:16,tempoBlend:true,style:'bass'});
  const t=engine.transition;engine.context.currentTime=t.start+t.duration/2;
  assert.ok(Math.abs(engine.currentRate(0)*120-engine.currentRate(1)*128)<1e-9);
  const a=engine.position(0),b=engine.position(1);
  assert.ok(a>0&&b>0);
  engine.context.currentTime=t.start+t.duration;engine.tick();
  assert.equal(engine.decks[1].rate,1);assert.equal(engine.decks[1].rateRamp,null);
  assert.ok(Math.abs(engine.position(1)-7.5)<1e-8);
});
test('Whoosh holds both beat clocks through a 110/98 tempo morph, lands naturally and cancels continuously',async()=>{
 for(const [a,b]of [[110,98],[98,110]]){
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a',a,240));engine.load(1,track('b',b,240));
  await engine.startTransition({style:'riser',sync:true,tempoBlend:true,quantize:false,beats:16});const t=engine.transition;
  assert.equal(t.sync,true);assert.equal(t.tempoBlend,true);assert.equal(t.voices.length,2);
  for(const p of [0,.25,.5,.75,1]){
   engine.context.currentTime=t.start+t.duration*p;
   assert.ok(Math.abs(engine.currentRate(0)*a-engine.currentRate(1)*b)<1e-9);
   assert.ok(Math.abs((engine.position(0)-t.outPoint)*a/60-(engine.position(1)-t.inPoint)*b/60)<1e-8,'Transport phase does not drift during the shared ramp');
  }
  engine.tick();assert.equal(engine.decks[1].rate,1);assert.equal(engine.decks[0].playing,false);
  assert.ok(Math.abs((engine.position(1)-t.inPoint)*b/60-16)<1e-8);
  const other=new StudioEngine();await other.init();other.load(0,track('a',a,240));other.load(1,track('b',b,240));await other.startTransition({style:'riser',sync:true,tempoBlend:true,quantize:false});const u=other.transition;
  other.context.currentTime=u.start+u.duration*.45;const before=other.decks.map((_,id)=>other.position(id));other.tick();const crossfade=other.crossfade;other.cancelTransition();
  assert.equal(other.crossfade,crossfade);other.decks.forEach((_,id)=>assert.ok(Math.abs(other.position(id)-before[id])<1e-9));
 }
});

test('automatic tempo morph uses the measured clock and Next aligns the incoming bar phase without shortening its 16 beats',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,{...track('a',110,240),tempoConfidence:.72,beatStability:.43});engine.load(1,{...track('b',98,240),tempoConfidence:.66,beatStability:.30});await engine.play(0);
 engine.context.currentTime=.7;await engine.startTransition({style:'auto',profile:'musical',sync:true,tempoBlend:true,quantize:true,startNow:true,skipBeats:16,beats:32});
 const t=engine.transition;assert.equal(t.style,'riser');assert.equal(t.tempoBlend,true);assert.match(t.reason,/Grille estimée/);assert.ok(Math.abs(t.duration*104/60-16)<1e-9);
 assert.ok(Math.abs(t.outPoint*110/60-t.inPoint*98/60)<1e-8,'Both tracks start on the same beat inside their bar');
 engine.context.currentTime=t.start+t.duration;engine.tick();assert.equal(engine.decks[1].rate,1);
});

test('echo tail survives loading the next track onto the released deck',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));engine.load(1,track('b'));
  await engine.startTransition({beats:4,style:'echo',tempoBlend:false});const t=engine.transition;
  assert.equal(engine.decks[0].delay.delayTime.value,.5);
  engine.context.currentTime=t.start+t.duration;engine.tick();
  const wet=engine.decks[0].wet.gain.events.length;
  engine.load(0,track('c'));
  assert.equal(engine.decks[0].wet.gain.events.length,wet);
  assert.ok(engine.decks[0].echoTailUntil>engine.context.currentTime);
});
test('cancelling a transition holds its current position and restores effect parameters', async () => {
  const engine = new StudioEngine(); await engine.init(); engine.load(0, track('a')); engine.load(1, track('b'));
  await engine.startTransition({ style: 'echo', beats: 8, quantize: false });
  const {start,score} = engine.transition; engine.context.currentTime = start + 1.6;
  engine.cancelTransition();
  const progress=transitionProgress('echo',.4,4,score);
  assert.equal(engine.transition, null); assert.ok(Math.abs(engine.crossfade-progress)<1e-9); assert.equal(engine.decks[0].echo, false);
  assert.ok(Math.abs(engine.decks[0].fader.gain.value - Math.cos(progress*Math.PI/2)) < 1e-9);
});

test('normal loop release continues from the heard position after many wraps and a rate change',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,track('loop'));await engine.seek(0,10.25);await engine.play(0);engine.loop(0,4);
 engine.context.currentTime=7.4;const wrapped=engine.position(0);assert.ok(wrapped>=10&&wrapped<12);
 engine.loop(0,4);assert.equal(engine.position(0),wrapped);assert.equal(engine.decks[0].source.loop,false);
 engine.context.currentTime=7.9;assert.ok(Math.abs(engine.position(0)-wrapped-.5)<1e-9);
 engine.loop(0,2);await engine.setRate(0,1.5);engine.context.currentTime=13;
 const pitched=engine.position(0);engine.loop(0,2);assert.equal(engine.position(0),pitched);
 engine.context.currentTime=14;assert.ok(Math.abs(engine.position(0)-pitched-1.5)<1e-9);
});

test('deck brake descends in native pitch, integrates its clock and resumes at the stopped position with key lock restored',async()=>{
 const engine=new StudioEngine();await engine.init();engine.keyLockAvailable=true;
 engine.SoundTouchNode=class extends AudioNode{pitch=new Param();port={close(){}};};
 engine.load(0,track('brake'));await engine.seek(0,10);await engine.play(0);assert.ok(engine.decks[0].pitchNode);
 const stopped=engine.brake(0,.4);await new Promise(resolve=>setImmediate(resolve));const d=engine.decks[0];
 assert.equal(engine.keyLock,true);assert.equal(d.pitchNode,null);assert.ok(d.braking);assert.ok(d.source.playbackRate.events.some(e=>e.type==='ramp'&&e.value===.005));
 engine.context.currentTime=.2;assert.ok(Math.abs(engine.position(0)-(10+.2-.995*.2*.2/.8))<1e-9);assert.ok(engine.currentRate(0)<.51);
 engine.context.currentTime=.405;d.source.onended();await stopped;const position=10+.4*(1+.005)/2;
 assert.ok(Math.abs(engine.position(0)-position)<1e-9);assert.equal(d.playing,false);assert.equal(d.rate,1);assert.equal(d.braking,null);
 await engine.play(0);assert.ok(d.pitchNode);assert.equal(d.source.startOffset,position);
});

test('an interrupted brake freezes its integrated position and a new transition restarts a running source',async()=>{
 const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));engine.load(1,track('b'));await engine.play(0);
 const stopped=engine.brake(0,.4);await new Promise(resolve=>setImmediate(resolve));engine.context.currentTime=.1;const position=engine.position(0);engine.pause(0);await stopped;
 assert.equal(engine.position(0),position);assert.equal(engine.decks[0].rate,1);assert.equal(engine.decks[0].braking,null);
 await engine.play(0);const next=engine.brake(0,.4);await new Promise(resolve=>setImmediate(resolve));engine.context.currentTime=.15;await engine.startTransition({style:'filter',quantize:false});await next;
 assert.equal(engine.decks[0].braking,null);assert.equal(engine.decks[0].playing,true);assert.equal(engine.transition.style,'filter');
});

test('Mix now skips a distant OUT marker and hands over on the next beats using the selected style',async()=>{
 for(const style of ['clean','echo','bass']){
  const engine=new StudioEngine();await engine.init();engine.load(0,{...track('a',120,180),confidence:'manual',manualRegions:true,mixOut:160});engine.load(1,{...track('b',120,180),confidence:'manual',manualRegions:true,mixIn:3.123});
  await engine.play(0);engine.context.currentTime=12.13;await engine.startTransition({style,automix:true,startNow:true,quantize:true,beats:32});
  const t=engine.transition;assert.equal(t.style,style);assert.ok(t.start>=12.25&&t.start<=12.75,`${style}: ${t.start}`);assert.ok(t.duration<=2);assert.ok(t.incomingStart<15);assert.equal(t.inPoint,3.123);assert.ok(t.outPoint<14);
 }
});

test('musical automatic accents follow dosage while retaining a conservative unsynced handoff',async()=>{
 for(const intensity of [0,.6]){const engine=new StudioEngine();await engine.init();engine.load(0,track('a',120));engine.load(1,track('b',142));await engine.startTransition({style:'auto',profile:'musical',intensity,quantize:false});const t=engine.transition;assert.equal(t.style,'clean');assert.equal(t.sync,false);assert.equal(t.accent,intensity?'filtered-rise':undefined);assert.equal(t.voices.length,intensity?1:0);}
});

test('measured loaded analysis shares canonical IN and OUT with the marker reset data',async()=>{
 const engine=new StudioEngine();await engine.init();const envelope=Array.from({length:1800},(_,i)=>i<160?.001:i<1500?.15:.001),t={...track('regions',120,180),confidence:'generated',envelope,audibleEnd:180,mixIn:0,mixOut:172,analysis:{mixIn:0,mixOut:172}};
 engine.load(0,t);assert.equal(t.mixIn,16);assert.ok(t.mixOut>=140&&t.mixOut<=144);assert.equal(t.analysis.mixIn,t.mixIn);assert.equal(t.analysis.mixOut,t.mixOut);
});
test('bass exchange is automated, short endings are bounded and future starts never show negative positions', async () => {
  const engine = new StudioEngine(); await engine.init(); engine.load(0, track('a', 120, 3)); engine.load(1, track('b'));
  await engine.play(0); engine.context.currentTime = 2;
  await engine.startTransition({ style: 'bass', beats: 32, quantize: false });
  assert.ok(engine.transition.duration <= 1);
  assert.equal(engine.position(1), 0);
  assert.ok(engine.decks[1].transitionLow.gain.events.some(e => e.type === 'value' && e.value === -24));
});
test('demo generator produces finite stereo audio with bounded peaks', () => {
  const track = createDemo(new Context(), { title: 'Test', bpm: 120, root: 55, color: 190, variant: 0 });
  assert.equal(track.buffer.duration, 32);
  let peak = 0, energy = 0;
  for (const value of track.buffer.getChannelData(0)) { assert.ok(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); energy += value ** 2; }
  assert.ok(peak < 1); assert.ok(energy > 100);
});

test('a late Automix handover does not wait for a measure beyond the outgoing ending',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a',120,3.2));engine.load(1,track('b'));
  await engine.play(0);engine.context.currentTime=2.7;
  await engine.startTransition({beats:16,quantize:true,tempoBlend:false});
  assert.ok(engine.transition.start<3);
  assert.ok(engine.transition.start+engine.transition.duration<=3.2);
});

test('hot cues can store zero, trigger playback, be cleared and remain bounded',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));
  engine.setHotCue(0,0,0);engine.setHotCue(0,1,3.5);engine.setHotCue(0,2,200);
  assert.equal(engine.decks[0].track.hotCues[0],0);assert.equal(engine.decks[0].track.hotCues[2],59.98);
  await engine.triggerHotCue(0,1);assert.equal(engine.position(0),3.5);assert.equal(engine.decks[0].playing,true);
  engine.clearHotCue(0,1);assert.equal(engine.decks[0].track.hotCues[1],null);
});
test('beat jumps retain transport state and count beats in source audio coordinates',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));await engine.seek(0,10);await engine.setRate(0,1.5);
  await engine.beatJump(0,4);assert.equal(engine.position(0),12);assert.equal(engine.decks[0].playing,false);
  await engine.play(0);await engine.beatJump(0,-8);assert.equal(engine.position(0),8);assert.equal(engine.decks[0].playing,true);
});
test('grid correction and unloading keep preparation and transport consistent',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));await engine.seek(0,1.25);engine.setDownbeat(0);
  assert.equal(engine.decks[0].track.downbeat,1.25);assert.equal(engine.decks[0].track.confidence,'manual');
  await engine.play(0);const source=engine.decks[0].source;engine.unload(0);assert.equal(source.stopped,true);assert.equal(engine.decks[0].track,null);assert.equal(engine.position(0),0);
});

test('quantized mixing honors a corrected incoming measure without moving an unquantized cue',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));engine.load(1,{...track('b'),mixIn:0.5,downbeat:1.25});
  await engine.startTransition({quantize:true,tempoBlend:false});assert.equal(engine.decks[1].source.startOffset,1.25);
  engine.cancelTransition();engine.pause(0);engine.pause(1);engine.setCrossfade(0);
  await engine.startTransition({quantize:false,tempoBlend:false});assert.equal(engine.decks[1].source.startOffset,0.5);
});

test('all transition styles schedule finite bounded curves and cancel without residual gates',async()=>{
  const {transitionCatalog}=await import('../public/transition-design.mjs');
  for(const {id} of transitionCatalog.filter(item=>item.id!=='auto')){
    const engine=new StudioEngine();await engine.init();engine.load(0,{...track('a'),title:'A'});engine.load(1,{...track('b'),title:'B'});
    if(id.startsWith('stem'))for(const d of engine.decks)d.track.stemBuffer=id==='stemsustain'?engine.context.createBuffer(8,engine.context.sampleRate*60,engine.context.sampleRate):{duration:60,numberOfChannels:8};
    await engine.startTransition({style:id,beats:4,quantize:false,intensity:0.7});const t=engine.transition;
    assert.equal(t.style,id);engine.context.currentTime=t.start+t.duration*0.65;engine.tick();const position=engine.crossfade;engine.cancelTransition();
    assert.equal(engine.transition,null);assert.ok(position>=0&&position<=1);
    for(const d of engine.decks){assert.equal(d.transitionGate.gain.value,1);assert.ok(d.fader.gain.events.filter(event=>event.type==='curve').every(event=>[...event.curve].every(Number.isFinite)));}
  }
});

test('stem playback uses one source clock and vocal-only echo leaves manual stem levels intact',async()=>{
 const engine=new StudioEngine();await engine.init();
 for(let id=0;id<2;id++)engine.load(id,{...track(String(id)),stemBuffer:{duration:60,numberOfChannels:8},stemLevels:{drums:1,bass:.7,other:1,vocals:.8}});
 await engine.startTransition({style:'stemecho',beats:8});const t=engine.transition,a=engine.decks[0],b=engine.decks[1];
 assert.equal(t.style,'stemecho');assert.equal(a.source.buffer.numberOfChannels,8);assert.equal(a.stemGains.vocals.gain.value,.8);assert.equal(a.stemGains.bass.gain.value,.7);
 assert.ok(a.stemEchoSend.gain.events.some(e=>e.type==='ramp'&&e.value>0));assert.ok(!a.echoSend.gain.events.some(e=>e.type==='ramp'&&e.value>0));
 const out=a.stemTransitionGains.vocals.gain.events.find(e=>e.type==='curve'),incoming=b.stemTransitionGains.vocals.gain.events.find(e=>e.type==='curve');
 assert.equal(out.time,incoming.time);assert.equal(out.curve.at(-1),0);assert.equal(incoming.curve[0],0);
 engine.setStemLevel(0,'vocals',.3);engine.context.currentTime=t.start+t.duration*.5;engine.cancelTransition();
 assert.equal(a.stemGains.vocals.gain.value,.3);assert.equal(a.stemTransitionGains.vocals.gain.value,1);assert.equal(a.stemEchoSend.gain.value,0);
});
test('slip roll releases at the continuing song clock and transitions leave roll mode',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));engine.load(1,track('b'));await engine.seek(0,10);await engine.play(0);await engine.roll(0,0.5);engine.context.currentTime=3;
  assert.ok(engine.position(0)<10.25);await engine.endRoll(0);assert.equal(engine.position(0),13);assert.equal(engine.decks[0].loop,null);assert.equal(engine.decks[0].roll,null);
  await engine.roll(0,1);engine.context.currentTime=4;await engine.startTransition({style:'bass',beats:4});assert.equal(engine.decks[0].roll,null);assert.equal(engine.decks[0].loop,null);
});
test('dynamic history advances after completed passages and retains a readable set log',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,{...track('a'),title:'One'});engine.load(1,{...track('b'),title:'Two'});
  await engine.startTransition({style:'auto',profile:'peak',beats:4});let t=engine.transition;engine.context.currentTime=t.start+t.duration;engine.tick();
  assert.deepEqual(engine.transitionHistory,['linear']);assert.equal(engine.performanceLog[0].to,'Two');
  engine.load(0,{...track('c'),title:'Three'});await engine.startTransition({style:'auto',profile:'peak'});assert.equal(engine.transition.style,'linear');
});

test('manual rack dosage is independent of transition gates and online handover clears effect returns',async()=>{
  const engine=new StudioEngine();await engine.init();engine.load(0,track('a'));engine.load(1,track('b'));engine.setDeckEffect(0,'flanger',0.6);assert.equal(engine.decks[0].fx.amount,0.6);assert.equal(engine.decks[0].fx.flangerWet.gain.value,0.3);
  await engine.startTransition({style:'space',beats:4});engine.context.currentTime=engine.transition.start+1;engine.silence();
  assert.equal(engine.transition,null);assert.ok(engine.decks.every(deck=>!deck.playing&&deck.fx.amount===0&&deck.echo===false&&deck.wet.gain.value===0&&deck.verbWet.gain.value===0));
});

test('filter sweeps keep both filter types fixed and echo manual send follows the channel fader',async()=>{const e=new StudioEngine();await e.init();e.load(0,track('a'));e.setFilter(0,1);e.setFilter(0,-1);assert.equal(e.decks[0].highpass.type,'highpass');assert.equal(e.decks[0].sweep.type,'lowpass');e.setEcho(0,true);assert.ok(e.decks[0].manualEchoSend.gain.value>0);assert.equal(e.decks[0].echoSend.gain.value,0);e.setEcho(0,false);assert.equal(e.decks[0].manualEchoSend.gain.value,0);});

test('manual EQ and filter edits survive cancellation and completion of transition automation',async()=>{
 for(const finish of [false,true])for(const style of ['bass','filter','lowpass','downlift']){
  const e=new StudioEngine();await e.init();e.load(0,track('a'));e.load(1,track('b'));
  e.setEQ(0,0,-4);e.setEQ(1,0,3);e.setFilter(0,.2);
  await e.startTransition({style,beats:4,quantize:false});const t=e.transition;
  e.context.currentTime=t.start+t.duration*.4;e.setEQ(0,0,-7);e.setEQ(1,0,-2);e.setFilter(0,-.3);
  if(finish){e.context.currentTime=t.start+t.duration;e.tick();}else e.cancelTransition();
  assert.equal(e.decks[0].low.gain.value,-7);assert.equal(e.decks[1].low.gain.value,-2);assert.equal(e.decks[0].filter,-.3);
  for(const d of e.decks){assert.equal(d.transitionLow.gain.value,0);assert.equal(d.transitionHighpass.frequency.value,0);assert.equal(d.transitionLowpass.frequency.value,e.context.sampleRate/2);}
 }
});

test('cancelling a dub transition restores the pre-existing manual echo timing and feedback',async()=>{
 const e=new StudioEngine();await e.init();e.load(0,track('a'));e.load(1,track('b'));e.setEcho(0,true);
 e.decks[0].delay.delayTime.value=.37;e.decks[0].feedback.gain.value=.19;
 await e.startTransition({style:'dub',beats:4,quantize:false});const t=e.transition;e.context.currentTime=t.start+t.duration*.6;e.cancelTransition();
 assert.equal(e.decks[0].echo,true);assert.equal(e.decks[0].delay.delayTime.value,.37);assert.equal(e.decks[0].feedback.gain.value,.19);
});
