import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTransition} from '../public/transition-design.mjs';
import {runtimeIncomingLanding} from '../public/incoming-landing.mjs';
import {makeTransitionScore} from '../public/transition-score.mjs';
function source(bpm=120){return {id:'source',bpm,downbeat:.25,beatOffset:.25,confidence:'generated',keyRoot:0,keyMode:'major',keyConfidence:1,buffer:{duration:180},audibleEnd:180,mixIn:.25,mixOut:160,envelope:Array(1800).fill(.2)};}
function target(bpm=120){const bar=240/bpm,at=.25+bar*8;return {...source(bpm),id:'target',envelope:Array.from({length:1800},(_,i)=>i/10<at?.06:.2),bassEnvelope:Array.from({length:1800},(_,i)=>i/10<at?.01:.1),structure:Array.from({length:Math.floor(180/bar)},(_,i)=>({time:.25+i*bar,rms:i<8?.06:.2,density:.2}))};}
const plan=(a=source(),b=target(),extra={})=>resolveTransition({track:a,rate:1},{track:b,rate:1},{style:'auto',profile:'musical',sync:true,tempoBlend:true,beats:16,...extra});
test('an automatic incoming lift reaches the score handoff instead of passing under the closed fader',()=>{
 const p=plan();assert.ok(p.incomingLanding,'Expected a measured incoming lift');assert.equal(p.incomingLanding.time,16.25);assert.equal(p.inPoint+p.incomingLanding.leadSeconds,16.25);assert.equal(p.preserveInPoint,true);assert.ok(p.inPoint<p.baseInPoint);assert.ok(p.reason.includes('R1'));
});
test('the same target landmark follows both directions of the common tempo morph',()=>{
 for(const [a,b]of [[110,98],[98,110],[131,112],[112,131]]){const p=plan(source(a),target(b));assert.equal(p.tempoBlend,true);assert.ok(p.incomingLanding);assert.ok(Math.abs(p.inPoint+p.seconds*(p.rate+1)/2*p.score.handoffFraction-p.incomingLanding.time)<1e-9);}
});
test('a shortened Next score rebases its cue to retain the selected target arrival',()=>{
 const b=target(),p=plan(source(),b),seconds=2,score=makeTransitionScore(p,{seconds}),r=runtimeIncomingLanding(b,p,score,seconds);assert.ok(r);assert.equal(r.time,p.incomingLanding.time);assert.ok(r.cue>p.inPoint);assert.ok(Math.abs(r.cue+seconds*score.handoffFraction-r.time)<1e-9);
});
test('manual markers, uncertain grids, disabled arrival and non-musical modes retain the original entry',()=>{
 for(const [a,b,extra]of [[{...source(),manualRegions:true,mixOut:130.37},target(),{}],[source(),{...target(),id:undefined},{}],[source(),{...target(),manualRegions:true,mixIn:3.41},{}],[source(),{...target(),confidence:'low',tempoConfidence:.9,beatStability:.3},{}],[source(),target(),{alignArrival:false}],[source(),target(),{style:'riser'}],[source(),target(),{profile:'varied'}],[source(160),target(80),{sync:false}]]){const p=plan(a,b,extra);assert.equal(p.incomingLanding,null);assert.equal(p.inPoint,p.baseInPoint);}
});
test('silent lead-ins, quiet arrivals and insufficient tail reserve never qualify',()=>{
 for(const patch of [{envelope:Array(1800).fill(0)},{envelope:Array.from({length:1800},(_,i)=>i<163?0:.2)},{audibleEnd:20}]){const p=plan(source(),Object.assign(target(),patch));assert.equal(p.incomingLanding,null);}
});
test('landing data cannot seek a replaced track or override a newly manual IN',()=>{
 const b=target(),p=plan(source(),b);assert.equal(runtimeIncomingLanding({...b,id:'replacement'},p,p.score,p.seconds),null);assert.equal(runtimeIncomingLanding({...b,manualRegions:true},p,p.score,p.seconds),null);
});
