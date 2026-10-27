import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAudio,nextMusicalTime,makeTransitionPlan} from '../public/analysis.mjs';
test('musical quantization accounts for lookahead without moving the selected downbeat',()=>{
  assert.equal(nextMusicalTime(1.21,120,0,4),2);
  assert.equal(nextMusicalTime(2,120,0,4),2);
  assert.equal(nextMusicalTime(2.01,120,0.25,4),2.25);
});
test('analysis trims digital silence, bounds gain and creates non-overlapping mix regions',()=>{
  const sr=11025,samples=new Float32Array(sr*12);
  for(let i=sr*2;i<sr*10;i++)samples[i]=Math.sin(i*2*Math.PI*110/sr)*0.3;
  const result=analyzeAudio(samples,sr);
  assert.ok(result.audibleStart>=1.9&&result.audibleStart<=2.1);assert.ok(result.audibleEnd<=10.1);
  assert.ok(result.mixIn<=result.mixOut);assert.ok(result.autoGain>0&&result.autoGain<=1.8);
  const silent=analyzeAudio(new Float32Array(1000),sr);assert.equal(silent.bpm,null);assert.ok(Number.isFinite(silent.autoGain));
});
test('adaptive transition syncs nearby tempos and uses an unforced fallback for distant tempos',()=>{
  const a={rate:1,track:{bpm:120,confidence:'manual'}},b={rate:1,track:{bpm:124,confidence:'manual'}},c={rate:1,track:{bpm:85}};
  const near=makeTransitionPlan(a,b,{style:'auto',tempoBlend:true});assert.equal(near.style,'blend');assert.equal(near.tempoBlend,true);
  const far=makeTransitionPlan(a,c,{style:'auto',tempoBlend:true});assert.equal(far.style,'linear');assert.equal(far.sync,false);assert.equal(far.rate,1);
  assert.equal(makeTransitionPlan(a,c,{style:'auto',beats:32}).beats,4);
  assert.equal(makeTransitionPlan(a,c,{style:'echo',beats:32}).beats,32);
});
