import test from 'node:test';import assert from 'node:assert/strict';
import * as analysis from '../public/audio-analysis.mjs';
const evaluate=options=>{assert.equal(typeof analysis.rhythmEvidence,'function');return analysis.rhythmEvidence(options);};
function evidence({duration=120,step=2,jitter=.004}={}){const period=.5,phase=.23,peaks=[];for(let time=phase;time<duration;time+=step)peaks.push({t:time,w:1});return {period,phase,duration,peaks,matched:peaks,jitter,periodic:1,drift:0};}

test('consistent sparse attacks retain timing confidence while coverage stays low',()=>{
 const r=evaluate(evidence());assert.ok(r.beatStability>.9);assert.ok(r.tempoConfidence>.9);assert.ok(r.beatCoverage<.3);assert.equal(r.beatObservationCount,60);assert.ok(r.beatPhaseContrast>.9);
});
test('equally accented subdivisions remain ambiguous even with a precise clock',()=>{
 const e=evidence({step:.125}),matched=e.peaks.filter((_,i)=>i%4===0),r=evaluate({...e,matched,jitter:.002});assert.ok(r.tempoConfidence<.6);assert.ok(r.beatPhaseContrast<.1);
});
test('a few concentrated accents cannot certify a long recording',()=>{
 const e=evidence(),peaks=e.peaks.slice(0,4),r=evaluate({...e,peaks,matched:peaks,jitter:0});assert.ok(r.tempoConfidence<.3);assert.ok(r.beatStability<.3);
});

test('a dense short intro does not certify the unobserved remainder while its local clock stays precise',()=>{
 const e=evidence({step:.5}),peaks=e.peaks.slice(0,40),r=evaluate({...e,peaks,matched:peaks});assert.ok(r.beatStability>.9);assert.ok(r.tempoConfidence<.65);
});
test('unstructured onset noise does not acquire a reliable grid from a high correlation baseline',()=>{
 let seed=19;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296),period=.5,phase=.23,duration=120,peaks=Array.from({length:1200},()=>({t:rand()*duration,w:.5+rand()})).sort((a,b)=>a.t-b.t),byBeat=new Map();
 for(const p of peaks){const k=Math.round((p.t-phase)/period);if(Math.abs(p.t-phase-k*period)<.065&&(!byBeat.has(k)||byBeat.get(k).w<p.w))byBeat.set(k,p);}
 const matched=[...byBeat.values()],jitter=Math.sqrt(matched.reduce((s,p)=>s+(p.t-phase-Math.round((p.t-phase)/period)*period)**2,0)/matched.length),r=evaluate({period,phase,duration,peaks,matched,jitter,periodic:1,drift:0});assert.ok(r.tempoConfidence<.65||r.beatStability<.65);
});
test('tempo variation still invalidates a constant grid and gain scaling preserves evidence',()=>{
 const e=evidence({step:.5}),a=evaluate(e),b=evaluate({...e,peaks:e.peaks.map(p=>({...p,w:p.w*.2}))});assert.ok(Math.abs(a.tempoConfidence-b.tempoConfidence)<1e-10);assert.ok(evaluate({...e,drift:.04}).beatStability<.3);
});
test('empty or invalid evidence yields finite unavailable measurements',()=>{
 for(const e of [{},{...evidence(),peaks:[],matched:[]},{...evidence(),period:NaN},{...evidence(),duration:0}]){const r=evaluate(e);assert.equal(r.tempoConfidence,0);assert.equal(r.beatStability,0);assert.equal(r.beatCoverage,0);}
});
