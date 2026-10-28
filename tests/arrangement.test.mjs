import test from 'node:test';import assert from 'node:assert/strict';
import * as analysis from '../public/analysis.mjs';

function fixture({bars=48,offset=0,level=()=>.2,bass=()=>.08,density=()=>.2}={}){
 const duration=bars*2+offset,envelope=Array.from({length:Math.ceil(duration*10)},(_,i)=>level(Math.max(0,Math.floor((i/10-offset)/2)))),bassEnvelope=Array.from({length:envelope.length},(_,i)=>bass(Math.max(0,Math.floor((i/10-offset)/2))));
 return {bpm:120,downbeat:offset,beatOffset:offset,confidence:'generated',audibleStart:offset,audibleEnd:duration,buffer:{duration},envelope,bassEnvelope,structure:Array.from({length:bars},(_,i)=>({time:offset+i*2,rms:level(i),density:density(i)}))};
}
const detect=t=>{assert.equal(typeof analysis.analyzeArrangement,'function','Arrangement analysis must be available');return analysis.analyzeArrangement(t);};

test('sustained energy changes become measured landmarks on the actual bar grid',()=>{
 const r=detect(fixture({offset:.3,level:b=>b<8?.05:b<24?.2:.07,bass:b=>b<8?.01:b<24?.1:.015}));
 assert.equal(r.version,1);assert.ok(r.landmarks.some(p=>Math.abs(p.time-16.3)<.001&&p.kind==='lift'&&p.confidence>=.55));assert.ok(r.landmarks.some(p=>Math.abs(p.time-48.3)<.001&&p.kind==='release'));
 assert.ok(r.landmarks.every(p=>p.time>0&&p.time<96.3&&Number.isFinite(p.energyDeltaDb)));
});
test('a spectral texture change is visible even at constant overall loudness',()=>{
 const r=detect(fixture({density:b=>b<12?.08:.55,bass:b=>b<12?.02:.12}));
 assert.ok(r.landmarks.some(p=>p.time===24&&p.kind==='change'&&p.confidence>=.55));
});
test('an isolated loud bar and a steady groove do not fabricate arrangement sections',()=>{
 assert.deepEqual(detect(fixture({level:b=>b===12?.8:.15,bass:b=>b===12?.3:.06})).landmarks,[]);
 assert.deepEqual(detect(fixture()).landmarks,[]);
});
test('gain scaling does not change the detected structural times',()=>{
 const t=fixture({level:b=>b<16?.07:.2,bass:b=>b<16?.02:.1}),a=detect(t),b=detect({...t,envelope:t.envelope.map(x=>x*.3),bassEnvelope:t.bassEnvelope.map(x=>x*.3),structure:t.structure.map(w=>({...w,rms:w.rms*.3}))});
 assert.deepEqual(a.landmarks.map(p=>p.time),b.landmarks.map(p=>p.time));assert.ok(a.landmarks.length>0);
});
test('silence, short or unreliable grids and corrupt values retain a safe empty map',()=>{
 for(const t of [fixture({level:()=>0,bass:()=>0}),fixture({bars:5}),{...fixture(),confidence:'low',tempoConfidence:.2,beatStability:.1},{...fixture(),bpm:NaN},{buffer:{duration:NaN},envelope:[NaN,Infinity]}]){
  const r=detect(t);assert.deepEqual(r.landmarks,[]);assert.ok(Number.isFinite(r.bpm));
 }
});
test('changing the downbeat invalidates persisted and in-memory landmark times',()=>{
 const t=fixture({level:b=>b<16?.05:.2,bass:b=>b<16?.01:.08});t.arrangement=detect(t);
 assert.equal(typeof analysis.arrangementFor,'function');const before=analysis.arrangementFor(t);t.downbeat=.5;const after=analysis.arrangementFor(t);
 assert.notEqual(after,before);assert.equal(after.downbeat,.5);assert.ok(after.landmarks.length>0);assert.ok(after.landmarks.every(p=>Math.abs((p.time-.5)/2-Math.round((p.time-.5)/2))<1e-7));
});
test('region preparation includes the map while preserving manual IN and OUT',()=>{
 const t={...fixture({level:b=>b<16?.05:.2}),manualRegions:true,mixIn:3.41,mixOut:81.23},r=analysis.prepareAnalysisRegions(t,96);
 assert.equal(r.mixIn,3.41);assert.equal(r.mixOut,81.23);assert.ok(r.arrangement?.landmarks.length>0);
});

test('a corrected grid cannot reuse an empty map persisted with low rhythmic confidence',()=>{
 const t={...fixture({level:b=>b<16?.05:.2}),confidence:'low',tempoConfidence:.72,beatStability:.4},saved=detect(t);assert.deepEqual(saved.landmarks,[]);
 const corrected={...t,confidence:'manual',manualGrid:true,arrangement:saved};assert.ok(analysis.arrangementFor(corrected).landmarks.length>0);
});
