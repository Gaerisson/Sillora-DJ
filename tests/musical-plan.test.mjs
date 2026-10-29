import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTransition,faderCurves,transitionProgress} from '../public/transition-design.mjs';import {musicalEntry,musicalExit,cleanTiming} from '../public/musical-plan.mjs';
const track=(bpm,root,mode)=>({bpm,confidence:'generated',keyRoot:root,keyMode:mode,keyConfidence:1,buffer:{duration:180},mixOut:160,mixIn:0,audibleEnd:179});

function arranged(bpm=120,bars=100,change=92){const bar=240/bpm,duration=bar*bars;return {...track(bpm,0,'major'),downbeat:0,buffer:{duration},audibleEnd:duration,envelope:Array.from({length:Math.ceil(duration*10)},()=>.2),bassEnvelope:Array.from({length:Math.ceil(duration*10)},()=>.06),structure:Array.from({length:bars},(_,i)=>({time:i*bar,rms:.2,density:i<change?.08:.5}))};}

test('an incoming bass entrance close to the energy region refines automatic IN',()=>{
 const t=arranged(120,50,49);t.structure.forEach(w=>w.density=.2);t.bassEnvelope=t.bassEnvelope.map((_,i)=>i<80?.01:.12);
 assert.equal(musicalEntry(t),8);assert.equal(musicalEntry({...t,manualRegions:true,mixIn:1.23}),1.23);
});

test('the score bass handoff lands on the measured outgoing arrangement boundary',()=>{
 const a=arranged(),b=arranged(120,100,99),plan=resolveTransition({track:a},{track:b},{style:'riser',beats:16,sync:true});
 assert.equal(plan.handoffPosition,184);assert.equal(plan.outPoint,178);assert.equal(plan.outPoint+plan.sourceSpanSeconds*plan.score.handoffFraction,184);
 assert.equal(resolveTransition({track:a},{track:b},{style:'riser',beats:16,sync:true,position:180}).outPoint,plan.outPoint,'Preview stays stable');
});

test('arrangement handoff uses native beats in both directions of a tempo morph',()=>{
 for(const [a,b]of [[110,98],[98,110]]){const source=arranged(a,112,104),target=arranged(b,112,111),plan=resolveTransition({track:source},{track:target},{style:'riser',beats:16,sync:true,tempoBlend:true});
  assert.equal(plan.tempoBlend,true);assert.ok(Math.abs(plan.handoffPosition-104*240/a)<1e-5);assert.ok(plan.outPoint+plan.sourceSpanSeconds<source.buffer.duration);
 }
});

test('automatic score timing leaves audio after its handoff before EOF',()=>{
 const source={...arranged(120,100,99),structure:[]},target=arranged();
 for(const style of ['riser','filter','echo','bass','phrase']){const plan=resolveTransition({track:source},{track:target},{style,beats:16,sync:true});assert.ok(plan.outPoint+plan.sourceSpanSeconds<=source.buffer.duration-.02,style);}
});
test('a reliable relative major/minor pair uses a measured harmonic phrase relay',()=>{
 const a=track(120,0,'major'),b=track(124,9,'minor');const plan=resolveTransition({track:a},{track:b},{style:'auto',profile:'musical',beats:32,sync:true});
 assert.equal(plan.keyRelation,'Tonalité relative');assert.equal(plan.harmonic,true);assert.equal(plan.style,'phrase');assert.equal(plan.sync,true);assert.ok(Math.abs(plan.rate-120/124)<1e-9);assert.equal(plan.seconds,16);
 const clash=resolveTransition({track:a},{track:track(120,1,'major')},{style:'auto',profile:'musical',beats:32});assert.equal(clash.style,'echo');assert.equal(clash.beats,16);assert.equal(clash.sync,true);assert.equal(clash.score.harmonicGuard,true);
});
test('half/double pulse matching keeps actual audio at its natural speed',()=>{
 for(const [a,b,quantum] of [[80,160,8],[160,80,2]]){const plan=resolveTransition({track:track(a,0,'major')},{track:track(b,0,'major')},{style:'auto',profile:'musical',sync:true});assert.equal(plan.sync,true);assert.equal(plan.rate,1);assert.equal(plan.incomingQuantizeBeats,quantum);assert.equal(plan.bpmB,a);}
});
test('entry detects a sparse intro lifting into a groove while respecting a manual IN',()=>{
 const t={audibleEnd:150,structure:[{time:0,rms:.04,density:.1},{time:2,rms:.04,density:.11},{time:4,rms:.05,density:.1},{time:8,rms:.2,density:.4},{time:10,rms:.21,density:.4}]};assert.equal(musicalEntry(t),8);assert.equal(musicalEntry({...t,manualRegions:true,mixIn:2.5}),2.5);
});
test('distant tempos keep the outgoing groove until a fast, level-preserving handoff',()=>{
 const plan=resolveTransition({track:track(120,0,'major')},{track:track(100,1,'major')},{style:'auto',profile:'musical'});
 assert.equal(plan.style,'clean');assert.equal(plan.sync,false);assert.equal(plan.rate,1);assert.equal(plan.beats,16);
 const [out,incoming]=faderCurves(0,1,plan.style,plan.seconds,8192);
 let firstIncoming=null,lastOutgoing=null;
 for(let i=0;i<out.length;i++){
  const seconds=i/(out.length-1)*plan.seconds;
  assert.ok(Math.abs(out[i]**2+incoming[i]**2-1)<1e-6,'No former .45–.5 dead zone or gradual level loss');
  if(seconds<plan.seconds*.75){assert.equal(out[i],1);assert.equal(incoming[i],0);}
  if(incoming[i]>.001&&firstIncoming===null)firstIncoming=seconds;
  if(out[i]>.001)lastOutgoing=seconds;
 }
 assert.ok(firstIncoming>=plan.seconds*plan.incomingStartFraction);
 assert.ok(lastOutgoing-firstIncoming<.081,'The simultaneous dry mixes last less than 80ms');
 assert.ok(incoming[Math.ceil((plan.seconds*.75+.08)/plan.seconds*(incoming.length-1))]>.999);
 assert.equal(plan.handoffPosition,plan.outPoint+plan.seconds*.75);
 assert.equal(plan.fadeSeconds,.06);
 assert.equal(transitionProgress('clean',.7,plan.seconds),0);assert.equal(transitionProgress('clean',.8,plan.seconds),1);
});

test('dense aligned tracks can retain their bass exchange when the overlap protection is deliberately off',()=>{
 const a=track(120,0,'major'),b=track(122,0,'major');for(const [t,density]of [[a,.7],[b,.6]])t.structure=Array.from({length:Math.floor(180*t.bpm/240)},(_,i)=>({time:i*240/t.bpm,density,rms:.2}));
 const plan=resolveTransition({track:a},{track:b},{style:'auto',profile:'musical',beats:32,protectOverlap:false});
 assert.equal(plan.style,'bass');assert.equal(plan.sync,true);assert.equal(plan.beats,8);assert.equal(plan.incomingStartFraction,0);
});

test('manual IN and OUT survive phrase scheduling without a second target ceil',()=>{
 const a={...track(120,0,'major'),manualRegions:true,mixOut:130.37};
 const b={...track(100,0,'major'),manualRegions:true,mixIn:3.41};
 const plan=resolveTransition({track:a},{track:b},{style:'auto',profile:'musical'});
 assert.equal(plan.outPoint,130.37);assert.equal(plan.inPoint,3.41);assert.equal(plan.preserveInPoint,true);assert.equal(plan.quantizeHandoff,false);
});

test('a sustained body replaces a silent intro and a quiet outro in the automatic regions',()=>{
 const envelope=Float32Array.from({length:2000},(_,i)=>i<80?.001:i<1500?.15:.007);
 const t={...track(120,0,'major'),buffer:{duration:200},audibleStart:0,audibleEnd:200,envelope,structure:Array.from({length:100},(_,i)=>({time:i*2,rms:i<4?.001:i<75?.15:.007,density:.3}))};
 assert.equal(musicalEntry(t),8);
 const outPoint=musicalExit(t,8,0,{handoffFraction:.75}),handoff=outPoint+6;
 assert.ok(handoff>=148&&handoff<=152,`Relays before quiet outro at ${handoff}`);
 assert.equal(handoff%2,0,'A reliable outgoing downbeat is used');
 assert.equal(musicalExit(t,8,outPoint+1,{handoffFraction:.75}),outPoint,'Preview does not chase the current transport');
});

test('one isolated intro transient is not treated as a sustained incoming groove',()=>{
 const envelope=Float32Array.from({length:1000},(_,i)=>i===10?.8:i>=120?.2:.001);
 const t={...track(120,0,'major'),buffer:{duration:100},audibleEnd:100,envelope,structure:Array.from({length:50},(_,i)=>({time:i*2,rms:i===0?.2:i>=6?.2:.001}))};
 assert.equal(musicalEntry(t),12);
});

test('uncertain tonalities do not request a long harmonic phrase and short windows retain finite timing',()=>{
 const a={...track(120,0,'major'),keyConfidence:.1},b={...track(123,0,'major'),keyConfidence:.1};
 const plan=resolveTransition({track:a},{track:b},{style:'auto',profile:'musical',beats:32});
 assert.equal(plan.style,'bass');assert.equal(plan.beats,16);
 for(const seconds of [.05,.2,1,8,12]){const timing=cleanTiming(seconds);assert.ok(timing.sourceStopFraction<1);assert.ok(timing.fadeSeconds>0);}
});

test('an altered outgoing pitch keeps handoff positions in native source seconds',()=>{
 const a=track(120,0,'major'),b=track(100,0,'major');
 const natural=resolveTransition({track:a,rate:1},{track:b},{style:'auto',profile:'musical'});
 const pitched=resolveTransition({track:a,rate:1.08},{track:b},{style:'auto',profile:'musical'});
 assert.equal(pitched.handoffPosition,natural.handoffPosition);
 assert.ok(Math.abs(pitched.outPoint-natural.outPoint)<1e-9);
 assert.ok(Math.abs(pitched.seconds-natural.seconds/1.08)<1e-9);
});

test('manual effects retain the requested style and use measured regions with uncertain grids',()=>{
 const envelope=Float32Array.from({length:1800},(_,i)=>i<160?.001:i<1500?.15:.002),t={...track(120,0,'major'),confidence:'low',buffer:{duration:180},audibleEnd:180,envelope,mixIn:0,mixOut:172};
 for(const style of ['bass','filter','echo','dub','reverb','space','lowpass','stutter']){
  const plan=resolveTransition({track:t},{track:t},{style,beats:16,sync:false});assert.equal(plan.style,style);assert.equal(plan.sync,false);assert.ok(plan.inPoint>=14&&plan.inPoint<=17);assert.ok(plan.outPoint>=140&&plan.outPoint<=144);
 }
});
