import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAutomaticFx,selectMusicalFx,AUTOMATIC_FX_HISTORY} from '../public/automatic-fx.mjs';
import {resolveTransition} from '../public/transition-design.mjs';
const source={id:'a',title:'A',bpm:120,confidence:'manual',buffer:{duration:180}};
const target={id:'b',title:'B',bpm:124,confidence:'manual',buffer:{duration:180}};

test('a varied set keeps its preview stable and rotates eligible effects across completed passages',()=>{
 const history=[],seen=new Set();
 for(let i=0;i<40;i++){
 const input={source,target,sync:true,history,intensity:.45},first=selectAutomaticFx(input);
  assert.deepEqual(first,selectAutomaticFx(input));assert.ok(!history.slice(-AUTOMATIC_FX_HISTORY).includes(first.style));
  assert.ok(first.candidates.includes(first.style));seen.add(first.style);history.push(first.style);
 }
 assert.ok(seen.size>=3);
});

test('weighted eligibility uses a strict 120 BPM threshold and exactly two recent passages',()=>{
 const pick=bpm=>selectAutomaticFx({source:{...source,bpm},target,sync:true,intensity:1,history:['dissolve','bass']});
 const slow=pick(120),fast=pick(121);
 assert.equal(AUTOMATIC_FX_HISTORY,2);
 assert.deepEqual(slow.weights,{dissolve:3,lowpass:1,stutter:1,bass:2});
 assert.ok(!slow.candidates.includes('riser'));assert.ok(fast.candidates.includes('riser'));
 assert.ok(!['dissolve','bass'].includes(fast.style));
 const old=selectAutomaticFx({source,target,sync:true,intensity:1,history:['blend','filter','echo']});
 assert.ok(!old.excluded.includes('blend'));
});

test('stem transitions are available only when both prepared playback graphs can supply them',()=>{
 const no=selectAutomaticFx({source,target,sync:true}),yes=selectAutomaticFx({source,target,sync:true,stemsAvailable:true});
 assert.ok(!no.candidates.includes('stemfade'));assert.equal(yes.weights.stemfade,2);assert.equal(yes.weights.stemecho,2);
 const plan=resolveTransition({track:source},{track:target},{style:'stemecho',stemsAvailable:false});assert.equal(plan.style,'bass');assert.match(plan.reason,/Stems indisponibles/);
});

test('unknown grids and dense arrangements cannot select rhythmic cuts or synthetic risers',()=>{
 for(let i=0;i<100;i++){
  const a={...source,id:String(i)};
  assert.ok(['linear','reverb','lowpass'].includes(selectAutomaticFx({source:a,target,sync:false,intensity:1}).style));
  assert.ok(['bass','filter','echo'].includes(selectAutomaticFx({source:a,target,sync:true,dense:true,intensity:.45}).style));
 }
});

test('the varied profile preserves timing and never forces a distant or unreliable beat grid',()=>{
 const a={track:source,rate:1},b={track:target,rate:1};
 const near=resolveTransition(a,b,{style:'auto',profile:'varied',history:['blend','filter']});assert.equal(near.sync,true);assert.ok(near.effectSelection);assert.ok(near.seconds>0);
 const far=resolveTransition(a,{track:{...target,bpm:85},rate:1},{style:'auto',profile:'varied',beats:32});assert.equal(far.sync,false);assert.equal(far.rate,1);assert.ok(far.seconds<=3);
 const uncertain=resolveTransition({track:{...source,confidence:'estimated',tempoConfidence:.1,beatStability:.1},rate:1},b,{style:'auto',profile:'varied'});assert.equal(uncertain.sync,false);
});

test('musical selection is stable, arrangement-driven and avoids the last two effects',()=>{
 const input={source,target,sync:true,trustworthy:true,keyKnown:true,harmonic:true,intensity:.45,beats:32},history=[];
 const first=selectMusicalFx(input);assert.equal(first.style,'phrase');assert.equal(first.beats,32);
 for(let i=0;i<12;i++){
  const choice=selectMusicalFx({...input,history});assert.deepEqual(choice,selectMusicalFx({...input,history}));
  assert.ok(!history.slice(-2).includes(choice.style));assert.ok(choice.candidates.includes(choice.style));
  history.push(choice.style);
 }
 assert.ok(new Set(history).size>=3);
 const dense=selectMusicalFx({...input,dense:true});assert.equal(dense.style,'bass');assert.equal(dense.beats,8);
 const quiet=selectMusicalFx({...input,intensity:.1});assert.ok(!quiet.candidates.some(id=>['hydrant','riser','lunarecho','tremolo'].includes(id)));
});

test('automatic tempo morphs use measured BPM without claiming a precise grid or repeating Whoosh forever',()=>{
 const input={source:{...source,bpm:110,confidence:'estimated',tempoConfidence:.72,beatStability:.43},target:{...target,bpm:98,confidence:'estimated',tempoConfidence:.66,beatStability:.30},sync:true,trustworthy:false,tempoBlend:true,beats:32,intensity:.65},history=[];
 for(let i=0;i<8;i++){
  const choice=selectMusicalFx({...input,history});assert.ok(['riser','filter','sweep','echo'].includes(choice.style));assert.ok(choice.beats<=16);assert.match(choice.reason,/Grille estimée/);
  assert.ok(!choice.candidates.some(id=>['stutter','hydrant','tremolo','stemsustain','phrase'].includes(id)));assert.ok(!history.slice(-2).includes(choice.style));history.push(choice.style);
 }
 assert.equal(history[0],'riser');assert.ok(history.includes('sweep'));
 const unmeasured=selectMusicalFx({...input,source:{...input.source,tempoConfidence:.3}});assert.equal(unmeasured.style,'clean');
 const noMorph=selectMusicalFx({...input,tempoBlend:false});assert.equal(noMorph.style,'clean');
});

test('harmonic clashes and an unsynchronized clock retain a short natural relay at every dosage',()=>{
 const input={source,target,sync:true,trustworthy:true,keyKnown:true,harmonic:true,stemsAvailable:true,beats:32};
 for(const intensity of [0,.15,.45,1]){
  for(const patch of [{sync:false},{harmonic:false}]){
   const result=selectMusicalFx({...input,...patch,intensity});assert.equal(result.style,'clean');assert.ok(result.beats<=16);assert.deepEqual(result.candidates,['clean']);
  }
 }
});

test('stem sustain needs prepared stems and harmonic knowledge; strong textures need deliberate intensity',()=>{
 const musical={source:{...source,bpm:126,rms:.11},target:{...target,bpm:128,rms:.2},sync:true,trustworthy:true,keyKnown:true,harmonic:true,intensity:.8,beats:16};
 const no=selectMusicalFx(musical),yes=selectMusicalFx({...musical,stemsAvailable:true});
 assert.ok(!no.candidates.some(id=>id.startsWith('stem')));assert.ok(yes.candidates.includes('stemsustain'));assert.equal(no.style,'hydrant');assert.equal(no.beats,8);
 const unknown=selectMusicalFx({...musical,keyKnown:false,stemsAvailable:true});assert.ok(!unknown.candidates.includes('stemsustain'));
 const gentle=selectMusicalFx({...musical,intensity:.45});assert.ok(!gentle.candidates.includes('hydrant'));assert.ok(!gentle.candidates.includes('tremolo'));
 const rich=selectAutomaticFx({...musical,source:{...musical.source,keyConfidence:.8},target:{...musical.target,keyConfidence:.8},stemsAvailable:true});assert.ok(rich.candidates.includes('stemsustain'));assert.ok(rich.candidates.includes('sweep'));assert.ok(rich.candidates.includes('lunarecho'));
});

test('deterministic previews never mutate track analysis or completed history',()=>{
 const a=Object.freeze({...source}),b=Object.freeze({...target}),history=Object.freeze(['phrase','bass']);
 const before=JSON.stringify({a,b,history});selectMusicalFx({source:a,target:b,sync:true,history,keyKnown:true});
 assert.equal(JSON.stringify({a,b,history}),before);
});
