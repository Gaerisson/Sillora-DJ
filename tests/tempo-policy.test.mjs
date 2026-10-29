import test from 'node:test';import assert from 'node:assert/strict';
import {tempoLimit,tempoLimits,transitionTempo} from '../public/tempo-policy.mjs';
import {resolveTransition} from '../public/transition-design.mjs';
import {rankCandidates,selectNextTrack} from '../public/dj-library.mjs';
import {DJSession} from '../public/dj-session.mjs';
const song=(id,bpm,root=0)=>({id,title:id,bpm,confidence:'manual',manualGrid:true,keyRoot:root,keyMode:'major',keyConfidence:1,rms:.15,buffer:{duration:180}});
const settings={style:'auto',profile:'musical',tempoBlend:true,sync:true,maxTempoPercent:5};

test('user tempo ceilings have reciprocal boundaries and agree with the actual transition plan',()=>{
 for(const maxTempoPercent of tempoLimits)for(const direction of [false,true])for(const excess of [-1e-6,0,1e-6]){
  const a=song('a',100),b=song('b',100*(1+maxTempoPercent/100+excess)),[source,target]=direction?[b,a]:[a,b],options={...settings,maxTempoPercent};
  const p=transitionTempo(source,target,options),plan=resolveTransition({track:source},{track:target},options);assert.equal(p.sync,excess<=0);assert.equal(plan.sync,p.sync);assert.equal(plan.tempoBlend,p.sync);if(!p.sync)assert.match(plan.reason,/limite/);
 }
 for(const value of [undefined,null,{},'5',0,NaN,Infinity,40])assert.equal(tempoLimit(value),20);
});
test('fixed Sync retains its conservative cap and no preference can force a poor automatic grid',()=>{
 const a=song('a',100),b=song('b',110);assert.equal(transitionTempo(a,b,{...settings,tempoBlend:false,maxTempoPercent:20}).sync,false);assert.equal(transitionTempo(a,b,{...settings,style:'bass',tempoBlend:false,maxTempoPercent:20}).sync,false);
 assert.equal(transitionTempo(a,{...b,confidence:'low',tempoConfidence:.4},{...settings,maxTempoPercent:20}).sync,false);assert.equal(transitionTempo(a,b,{...settings,sync:false,maxTempoPercent:20}).sync,false);
 assert.equal(transitionTempo(a,{...b,confidence:'low',tempoConfidence:.7,beatStability:.3},{...settings,maxTempoPercent:20}).sync,true);
});
test('Auto folds half and double grids inside the selected ceiling while deliberate styles keep the native grid',()=>{
 for(const [a,b]of [[150,80],[80,150]]){const source=song('a',a),target=song('b',b),p=transitionTempo(source,target,{...settings,maxTempoPercent:8});assert.equal(p.sync,true);assert.notEqual(p.octave,1);assert.equal(transitionTempo(source,target,settings).sync,false);assert.equal(transitionTempo(source,target,{...settings,style:'riser',maxTempoPercent:20}).sync,false);}
});
test('compatible selection gives feasible beatmatches priority over a better key outside the user ceiling',()=>{
 const a=song('a',100),outside=song('outside',112),inside=song('inside',104,1),ranked=rankCandidates(a,[outside,inside],{transition:settings});assert.equal(ranked[0].track,inside);assert.equal(ranked[0].tempo.sync,true);assert.match(ranked[1].reason,/limite/);
 assert.equal(selectNextTrack(a,[outside,inside],{transition:settings}),inside);assert.equal(selectNextTrack(a,[outside,inside],{transition:{...settings,maxTempoPercent:20}}),outside);
});
test('live source tempo changes update selection without modifying catalogue BPM or reserving a song',()=>{
 const a=song('a',100),b=song('b',104,1),c=song('c',112),session=new DJSession().start({tracks:[a,b,c],current:a});assert.equal(session.next(a,{transition:settings}),b);assert.equal(session.next({...a,bpm:110},{transition:settings}),c);assert.equal(a.bpm,100);assert.deepEqual([...session.played],['a']);
});
test('explicit order and shuffle retain their selected mode; exhausted folders and uncertainty are still honest',()=>{
 const a=song('a',100),outside=song('outside',130),inside=song('inside',104),tracks=[outside,inside];assert.equal(selectNextTrack(a,tracks,{mode:'order',transition:settings}),outside);assert.equal(selectNextTrack(a,tracks,{mode:'shuffle',random:()=>0,transition:settings}),outside);assert.equal(selectNextTrack(a,tracks,{played:tracks,transition:settings}),null);
 const unknown={...inside,confidence:'low',tempoConfidence:0,beatStability:0};assert.match(rankCandidates(a,[unknown],{transition:settings})[0].reason,/Grille incertaine/);assert.equal(transitionTempo(a,unknown,settings).sync,false);
});
