import test from 'node:test';import assert from 'node:assert/strict';
import {makeTransitionScore,scorePoints,scoreProgress,scheduleTransitionScore,transitionSourceOffset} from '../public/transition-score.mjs';
import {resolveTransition,faderCurves,transitionProgress} from '../public/transition-design.mjs';
import {tempoFraction,tempoBeats} from '../public/tempo-automation.mjs';
const track=bpm=>({bpm,confidence:'manual',buffer:{duration:240},audibleEnd:240,downbeat:0});

test('sweeps preserve the outgoing groove, reach full incoming level on a bar and remain equal power in both directions',()=>{
 for(const style of ['filter','riser','echo','bass','phrase'])for(const beats of [4,8,16,32]){
  const score=makeTransitionScore({style,bpmA:120,seconds:beats/2});
  if(beats>=8)assert.equal(score.handoffBeat%4,0);
  for(const to of [0,1]){const curves=faderCurves(1-to,to,style,beats/2,4096,score);for(let i=0;i<curves[0].length;i++)assert.ok(Math.abs(curves[0][i]**2+curves[1][i]**2-1)<1e-6);assert.ok(curves[to].at(-1)>.999);}
  if(['filter','riser'].includes(style)){assert.equal(scoreProgress(score,score.crossfade.begin),0);assert.equal(scoreProgress(score,score.handoffFraction),1);assert.equal(transitionProgress(style,score.handoffFraction,beats/2,score),1);}
 }
});

test('a tempo morph reserves the native span of its beat count and keeps automatic OUT on the source bar',()=>{
 for(const [a,b]of [[110,98],[98,110],[128,122]]){
  const A=track(a),B=track(b),plan=resolveTransition({track:A,rate:1},{track:B},{style:'riser',beats:16,tempoBlend:true,sync:true});
  assert.ok(Math.abs(plan.sourceSpanSeconds-16*60/a)<1e-9);
  assert.ok(Math.abs(plan.outPoint*a/240-Math.round(plan.outPoint*a/240))<1e-8);
  const handoff=tempoFraction(plan.score.handoffFraction,a,b,plan.seconds);
  assert.ok(Math.abs(tempoBeats(handoff,a,b,plan.seconds)-12)<1e-8);
 }
 const a={...track(110),manualRegions:true,mixOut:212.37},b={...track(98),manualRegions:true,mixIn:3.19};
 const plan=resolveTransition({track:a},{track:b},{style:'riser',tempoBlend:true});assert.equal(plan.outPoint,212.37);assert.equal(plan.inPoint,3.19);
});

test('harmonic clashes retain a measured tempo morph with limited dry overlap; uncertain tempo still rejects it',()=>{
 const a={...track(110),keyRoot:0,keyMode:'major',keyConfidence:1},b={...track(98),keyRoot:1,keyMode:'major',keyConfidence:1};
 const plan=resolveTransition({track:a},{track:b},{style:'auto',profile:'musical',tempoBlend:true,sync:true,beats:16});
 assert.equal(plan.style,'filter');assert.equal(plan.sync,true);assert.equal(plan.tempoBlend,true);assert.equal(plan.score.harmonicGuard,true);assert.ok((plan.score.crossfade.end-plan.score.crossfade.begin)*plan.score.beats<=2.001);
 const unknown=resolveTransition({track:{...a,confidence:'low',tempoConfidence:.2}},{track:b},{style:'auto',profile:'musical',tempoBlend:true});assert.equal(unknown.sync,false);assert.equal(unknown.tempoBlend,false);
});

test('score automation uses the same musical instant for the filter, bass landing and faders after a tempo ramp',()=>{
 const plan={style:'riser',bpmA:98,bpmB:110,seconds:16*120/208,tempoBlend:true},score=makeTransitionScore(plan);
 const nodes=()=>Object.fromEntries(['transitionLow','transitionMid','transitionHigh','transitionHighpass','echoSend','delay','feedback','wet'].map(key=>{const param={events:[],cancelScheduledValues(){},setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){this.events.push([v,t]);}};return[key,{gain:param,frequency:param,delayTime:param}];}));
 const a=nodes(),b=nodes(),start=4,at=p=>start+tempoFraction(p,98,110,plan.seconds),t={bpmA:98};
 scheduleTransitionScore({currentTime:0},{score,a,b,t,start,duration:plan.seconds,at});
 assert.ok(a.transitionHighpass.frequency.events.some(([v,time])=>v>3500&&Math.abs(time-at(score.handoffFraction))<1e-8));
 assert.equal(t.echoUsed,true);assert.ok(a.feedback.gain.events.every(([v])=>v<.5));
 assert.ok(b.transitionLow.gain.events.some(([v,time])=>v===0&&time>at(score.handoffFraction)));
 for(const style of ['filter','riser','echo','bass','phrase']){const shortened=makeTransitionScore({...plan,style},{seconds:.05});for(const points of Object.values(shortened.parameters)){const sorted=scorePoints(points);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i][0]>sorted[i-1][0]);}}
});

test('bass exchange follows complementary amplitude curves without simultaneous deep cuts at the relay',()=>{
 const score=makeTransitionScore({style:'bass',bpmA:120,seconds:8}),out=score.parameters.outLow,incoming=score.parameters.inLow;
 const a=out.find(([p])=>Math.abs(p-score.handoffFraction)<1e-9)[1],b=incoming.find(([p])=>Math.abs(p-score.handoffFraction)<1e-9)[1];
 assert.ok(Math.abs(a+3.0103)<.001);assert.ok(Math.abs(b+3.0103)<.001);assert.ok(Math.abs(10**(a/10)+10**(b/10)-1)<1e-8);
});

test('waveform stage markers use native source time rather than elapsed seconds through a tempo morph',()=>{
 const seconds=16*120/208,span=16*60/110,plan={seconds,sourceSpanSeconds:span,tempoBlend:true,bpmA:110,bpmB:98};
 const handoff=tempoFraction(.75,110,98,seconds)/seconds;
 assert.ok(Math.abs(transitionSourceOffset(plan,handoff)-12*60/110)<1e-9);assert.ok(Math.abs(transitionSourceOffset(plan,1)-span)<1e-9);
 assert.equal(transitionSourceOffset({duration:8,sourceSpanSeconds:9.6},.5),4.8);
});

test('the harmonic phrase retains its discrete one-beat echo as part of the shared score',()=>{
 const score=makeTransitionScore({style:'phrase',bpmA:120,seconds:16},{intensity:.5});
 assert.equal(score.echo?.division,1);assert.ok(score.echo.feedback<=.4);assert.ok(score.parameters.echoSend.some(([at,value])=>at>=.65&&at<=.8&&value>0));assert.equal(score.parameters.echoSend.at(-1)[1],0);
});
