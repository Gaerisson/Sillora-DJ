import test from 'node:test';
import assert from 'node:assert/strict';
import {tempoAt,tempoMean,rampDistance,scheduleTempo,tempoShapes,tempoBeats,tempoTime,tempoFraction,tempoDelay,warpTempoCurve} from '../public/tempo-automation.mjs';
import {resolveTransition} from '../public/transition-design.mjs';
import {remotePosition,tempoRampSnapshot} from '../public/remote-clock.mjs';

test('all tempo profiles integrate the actual scheduled audio knots, invert beats and retain echo divisions',()=>{
 for(const shape of Object.keys(tempoShapes))for(const [a,b]of [[110,98],[98,110],[124,124]]){
  const duration=16*60/tempoMean(a,b,shape),events=[[0,a]],param={linearRampToValueAtTime:(v,t)=>events.push([t,v])};scheduleTempo(param,a,b,0,duration,shape);
  let area=0;for(let i=1;i<events.length;i++){const [t,v]=events[i],[last,u]=events[i-1];area+=(u+v)*(t-last)/2;assert.ok(Math.abs(rampDistance(t,a,b,duration,shape)-area)<1e-8);}
  assert.ok(Math.abs(area/60-16)<1e-9);
  for(let i=0;i<=40;i++){const time=duration*i/40,count=tempoBeats(time,a,b,duration,shape);assert.ok(Math.abs(tempoTime(count,a,b,duration,shape)-time)<1e-9);for(const division of [.5,.75,1]){const past=time-tempoDelay(time,division,a,b,duration,shape),previous=past<0?past*a/60:tempoBeats(past,a,b,duration,shape);assert.ok(Math.abs(count-previous-division)<1e-9);}}
  assert.ok(Math.abs(tempoBeats(tempoFraction(.75,a,b,duration,shape),a,b,duration,shape)-12)<1e-9);
 }
});
test('tempo profile choices have distinct paths and preserve native source span and scored beat count',()=>{
 const make=bpm=>({bpm,confidence:'generated',buffer:{duration:240}}),plans=Object.keys(tempoShapes).map(tempoShape=>resolveTransition({track:make(110)},{track:make(98)},{style:'riser',sync:true,tempoBlend:true,beats:16,tempoShape}));
 for(const p of plans){assert.equal(p.score.beats,16);assert.ok(Math.abs(p.sourceSpanSeconds-16*60/110)<1e-9);assert.equal(p.tempoBlend,true);}
 assert.ok(plans[2].seconds>plans[0].seconds&&plans[0].seconds>plans[3].seconds);
 assert.ok(tempoAt(1,0,1,4,'smooth')<tempoAt(1,0,1,4,'linear'));assert.ok(tempoAt(1,0,1,4,'early')>tempoAt(1,0,1,4,'linear'));
 assert.equal(resolveTransition({track:make(110)},{track:make(98)},{tempoShape:'invalid'}).tempoShape,'linear');
});
test('Remote snapshots retain the nonlinear phase across future start, mid-ramp, end and a loop wrap',()=>{
 for(const shape of Object.keys(tempoShapes))for(const elapsed of [-.2,0,.1,1.2,1.9,2.2]){
  const ramp={from:1.12,to:1,start:10,duration:2,shape},now=10+elapsed,position=20+rampDistance(Math.max(0,elapsed),ramp.from,ramp.to,2,shape),deck={playing:true,position,rate:tempoAt(elapsed,1.12,1,2,shape),duration:200,rateRamp:tempoRampSnapshot(ramp,now)};
  const delta=elapsed<0?1.12*Math.min(.5,-elapsed)+rampDistance(Math.max(0,elapsed+.5),1.12,1,2,shape):rampDistance(elapsed+.5,1.12,1,2,shape)-rampDistance(elapsed,1.12,1,2,shape);
  assert.ok(Math.abs(remotePosition(deck,.5)-position-delta)<1e-9);
  deck.loop={start:position-.1,end:position+.1};assert.ok(Math.abs(remotePosition(deck,.5)-(deck.loop.start+(delta+.1)%.2))<1e-8);
 }
});

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
