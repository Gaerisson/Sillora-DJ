import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTransition,faderCurves,synthTexture,transitionCatalog} from '../public/transition-design.mjs';
const deck=(bpm,rms=0.12,duration=180)=>({rate:1,track:{bpm,rms,confidence:'estimated',buffer:{duration}}});
test('dynamic mixing relies on reliable measured rhythm and avoids arbitrary creative effects',()=>{
 const a=deck(120),b=deck(124,.2);a.track.tempoConfidence=b.track.tempoConfidence=.9;a.track.beatStability=b.track.beatStability=.9;
 assert.equal(resolveTransition(a,b,{style:'auto'}).style,'blend');assert.equal(resolveTransition(a,b,{style:'auto'}).sync,true);
 assert.equal(resolveTransition(a,b,{style:'auto',profile:'peak',history:['bass','bass']}).style,'bass');
 assert.equal(resolveTransition(a,deck(85),{style:'auto'}).sync,false);
 a.track.beatStability=.3;const low=resolveTransition(a,b,{style:'auto'});assert.equal(low.sync,false);assert.equal(low.style,'linear');assert.ok(low.seconds<=3);
 a.track.beatStability=.9;const distant=deck(132);distant.track.confidence='manual';assert.equal(resolveTransition(a,distant,{style:'auto'}).sync,false);
 a.track.structure=[{density:.5},{density:.5}];b.track.structure=[{density:.4}];assert.equal(resolveTransition(a,b,{style:'auto'}).style,'blend','Unlocated density values cannot describe the selected audio windows');
 for(const d of [a,b])d.track.structure=Array.from({length:Math.floor(180*d.track.bpm/240)},(_,i)=>({time:i*240/d.track.bpm,rms:.2,density:.7}));assert.equal(resolveTransition(a,b,{style:'auto'}).style,'bass');
 a.track.introEnd=1;b.track.introEnd=1;assert.ok(resolveTransition(a,b,{style:'auto'}).beats<=2);
});

test('all fade shapes preserve endpoints and power, and club cuts differ from a standard blend',()=>{
  for(const {id} of transitionCatalog.filter(item=>item.id!=='auto')){const [a,b]=faderCurves(0,1,id,8);assert.equal(a[0],1);assert.equal(b[0],0);assert.ok(Math.abs(a.at(-1))<1e-6);assert.equal(b.at(-1),1);for(let i=0;i<a.length;i++){assert.ok(a[i]>=0&&b[i]>=0);if(!['linear','bridge','landing'].includes(id))assert.ok(Math.abs(a[i]**2+b[i]**2-1)<1e-6);}}
  assert.ok(faderCurves(0,1,'cut',8)[0][700]>0.99);assert.ok(faderCurves(0,1,'blend',8)[0][700]<0.6);
});
test('synthesized textures are deterministic finite audio, click-ramped and intensity controlled',()=>{
  for(const kind of ['rise','fall','impact','laser','roll','air']){const a=synthTexture(kind,22050,0.5,0.5),b=synthTexture(kind,22050,0.5,0);assert.equal(a[0],0);assert.ok(Math.abs(a.at(-1))<0.001);assert.ok(a.some(v=>Math.abs(v)>0.01));assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<0.8));assert.ok(b.every(v=>v===0));assert.deepEqual(a,synthTexture(kind,22050,0.5,0.5));}
});

test('spatial and filter transition gain timing differs measurably from a generic blend',()=>{
 const reference=faderCurves(0,1,'blend',8)[0];
 for(const style of ['echo','dub','reverb','space','filter','lowpass','riser','downlift']){
  const out=faderCurves(0,1,style,8)[0],difference=out.reduce((sum,x,i)=>sum+(x-reference[i])**2,0)/out.length;
  assert.ok(difference>.001,`${style} still matches the generic fade: ${difference}`);
 }
});

