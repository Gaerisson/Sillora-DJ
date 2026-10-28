import test from 'node:test';
import assert from 'node:assert/strict';
import {AutomixScheduler} from '../public/automix-scheduler.mjs';

function setup({position=5,playing=true,ended=false,prepared=true,manual=true}={}){
 const source={id:0,track:{id:'a',title:'A',bpm:120,manualRegions:manual,mixOut:20,buffer:{duration:40}},playing,endedNaturally:ended,rate:1};
 const target={id:1,track:{id:'b',title:'B',bpm:120,mixIn:0,buffer:{duration:40}},rate:1};
 const calls=[],engine={decks:[source,target],crossfade:0,context:{currentTime:0},currentRate:()=>1,position:()=>position,startTransition:async options=>{calls.push(options);engine.transition={start:4,titleB:'B',style:'bass'};}};
 let enabled=true,exhausted=0;
 const scheduler=new AutomixScheduler(engine,{enabled:()=>enabled,prepare:()=>prepared,options:()=>({style:'bass',beats:8}),onExhausted:()=>exhausted++});
 return{source,target,engine,scheduler,calls,disable:()=>{enabled=false;},get exhausted(){return exhausted;}};
}

test('Automix prepares ahead and arms OUT before the timer reaches it',async()=>{
 const s=setup({position:15});await s.scheduler.tick();assert.equal(s.calls.length,1);assert.equal(s.calls[0].plannedPoint,20);assert.equal(s.calls[0].automix,true);assert.equal(s.scheduler.state.phase,'scheduled');
 s.engine.context.currentTime=2;await s.scheduler.tick();assert.equal(s.scheduler.state.countdown,2);assert.equal(s.calls.length,1);
});
test('Automix does not arm far-away OUT or restart a paused deck',async()=>{
 for(const config of [{position:1},{position:20,playing:false}]){const s=setup(config);await s.scheduler.tick();assert.equal(s.calls.length,0);}
});
test('natural EOF recovers but a deliberate pause never uses that path',async()=>{
 const s=setup({position:40,playing:false,ended:true});await s.scheduler.tick();assert.equal(s.calls.length,1);assert.equal(s.scheduler.metrics.recovered,1);
 const end=setup({position:40,playing:false,ended:true,prepared:false});await end.scheduler.tick();assert.equal(end.exhausted,1);
});
test('stopping or replacing a track during preparation cannot resurrect the set',async()=>{
 for(const change of [s=>s.disable(),s=>{s.source.track={...s.source.track,id:'new'};}]){
  const s=setup({position:20});let release;s.scheduler.prepare=()=>new Promise(resolve=>{release=resolve;});const waiting=s.scheduler.tick();change(s);release(true);await waiting;assert.equal(s.calls.length,0);
 }
});
test('an intentional loop suspends OUT planning and preparation is never re-entered',async()=>{
 const s=setup({position:20});s.source.loop={start:19,end:21};await s.scheduler.tick();assert.equal(s.calls.length,0);assert.equal(s.scheduler.state.phase,'loop');
 s.source.loop=null;let release;s.scheduler.prepare=()=>new Promise(resolve=>{release=resolve;});const first=s.scheduler.tick();await s.scheduler.tick();release(true);await first;assert.equal(s.calls.length,1);
});

function holdable(s){s.engine.holdForNext=id=>{const d=s.engine.decks[id];if(d.loop&&!d.continuity)return false;d.loop={start:34,end:39,kind:'continuity'};d.continuity={armedAt:s.engine.context.currentTime,window:d.loop};return true;};s.engine.releaseContinuity=id=>{const d=s.engine.decks[id];if(d.continuity){if(d.loop===d.continuity.window)d.loop=null;d.continuity=null;}};return s;}
test('only actual pending preparation arms the emergency hold; an exhausted set finishes normally',async()=>{
 const s=holdable(setup({position:36,prepared:false}));s.scheduler.pending=()=>true;await s.scheduler.tick();assert.equal(s.scheduler.state.phase,'holding');assert.equal(s.scheduler.metrics.holds,1);
 s.scheduler.prepare=()=>true;await s.scheduler.tick();assert.equal(s.calls[0].startNow,true);assert.equal(s.calls[0].style,'bass');assert.equal(s.calls[0].tempoBlend,false);
 const empty=holdable(setup({position:36,prepared:false}));await empty.scheduler.tick();assert.equal(empty.source.continuity,undefined);assert.equal(empty.scheduler.state.phase,'waiting');
});
test('pending asynchronous preparation is protected while busy, and disabling releases it without reentry',async()=>{
 const s=holdable(setup({position:36}));let release,calls=0;s.scheduler.prepare=()=>{calls++;return new Promise(resolve=>release=resolve);};const first=s.scheduler.tick();await s.scheduler.tick();assert.equal(s.scheduler.state.phase,'holding');assert.equal(calls,1);s.disable();await s.scheduler.tick();assert.equal(s.source.continuity,null);release(true);await first;assert.equal(s.calls.length,0);
});
test('emergency hold expires once on the audio clock and cannot rearm forever',async()=>{
 const s=holdable(setup({position:36,prepared:false}));s.scheduler.pending=()=>true;await s.scheduler.tick();s.engine.context.currentTime=31;await s.scheduler.tick();assert.equal(s.source.continuity,null);assert.equal(s.scheduler.metrics.holdTimeouts,1);await s.scheduler.tick();assert.equal(s.source.continuity,null);assert.equal(s.scheduler.metrics.holds,1);
});
