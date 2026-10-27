import test from 'node:test';
import assert from 'node:assert/strict';
import {tempoAt,tempoBeats,tempoTime,tempoFraction,tempoDelay,warpTempoCurve} from '../public/tempo-automation.mjs';
import {resolveTransition} from '../public/transition-design.mjs';
import {remotePosition} from '../public/remote-clock.mjs';

test('accelerating and decelerating clocks, effect divisions and beat landmarks use one invertible integral',()=>{
 for(const [a,b]of [[110,98],[98,110],[124,124]]){
  const duration=16*120/(a+b);
  assert.ok(Math.abs(tempoBeats(duration,a,b,duration)-16)<1e-10);
  for(let i=0;i<=32;i++){
   const time=duration*i/32,count=tempoBeats(time,a,b,duration);
   assert.ok(Math.abs(tempoTime(count,a,b,duration)-time)<1e-9);
   assert.ok(tempoAt(time,a,b,duration)>=Math.min(a,b));
   for(const division of [.5,.75,1]){
    const past=time-tempoDelay(time,division,a,b,duration);
    const previous=past<0?past*a/60:tempoBeats(past,a,b,duration);
    assert.ok(Math.abs(count-previous-division)<1e-9,'Delay returns a musical division, including the start boundary');
   }
  }
  assert.ok(Math.abs(tempoBeats(tempoFraction(.78,a,b,duration),a,b,duration)-16*.78)<1e-9);
  const curve=warpTempoCurve(Float32Array.from({length:1024},(_,i)=>i/1023),a,b,duration);
  assert.ok(Math.abs(curve[512]-tempoBeats(duration*512/1023,a,b,duration)/16)<1e-6);
 }
});

test('Whoosh adapts the supplied 110/98 BPM pair in both directions while explicit Sync off and excessive gaps remain natural',()=>{
 const t=bpm=>({bpm,buffer:{duration:240},tempoConfidence:.7,beatStability:.3,regionAnalysisVersion:2});
 for(const [a,b]of [[110,98],[98,110]]){
  const plan=resolveTransition({track:t(a)},{track:t(b)},{style:'riser',sync:true,tempoBlend:true,beats:16});
  assert.equal(plan.sync,true);assert.equal(plan.tempoBlend,true);assert.equal(plan.style,'riser');assert.equal(plan.rate,a/b);assert.equal(plan.preserveInPoint,false);
  assert.ok(Math.abs(plan.seconds*(a+b)/120-16)<1e-9);
  assert.equal(resolveTransition({track:t(a)},{track:t(b)},{style:'riser',sync:false,tempoBlend:true}).tempoBlend,false);
 }
 const gap=resolveTransition({track:t(140)},{track:t(80)},{style:'riser',sync:true,tempoBlend:true});
 assert.equal(gap.sync,false);assert.equal(gap.rate,1);
 const auto=resolveTransition({track:t(110)},{track:t(98)},{style:'auto',profile:'musical',sync:true,tempoBlend:true});
 assert.equal(auto.sync,true);assert.equal(auto.style,'riser');assert.equal(auto.trustworthy,false);assert.match(auto.reason,/Grille estimée/);
 const uncertain=resolveTransition({track:{...t(110),tempoConfidence:.4}},{track:t(98)},{style:'auto',profile:'musical',sync:true,tempoBlend:true});
 assert.equal(uncertain.sync,false,'An unreliable tempo never triggers an automatic morph');
});

test('Remote integrates a pending ramp, its active section and native-speed landing',()=>{
 const d={playing:true,position:10,rate:1.1,duration:200,rateRamp:{to:1,remaining:.3,wait:.1}};
 assert.ok(Math.abs(remotePosition(d,.05)-10.055)<1e-9);
 assert.ok(Math.abs(remotePosition(d,.25)-(10+.11+.165-.00375))<1e-9);
 assert.ok(Math.abs(remotePosition(d,.5)-(10+.11+.315+.1))<1e-9);
});
