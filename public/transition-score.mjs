import {clamp} from './audio-math.mjs';
import {tempoBeats} from './tempo-automation.mjs';

const supported=new Set(['bass','phrase','filter','riser','echo']);
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
// A score is plain data in beat fractions. Preview, faders and parameter
// scheduling share the same handoff; elapsed seconds are never a second grid.
export function makeTransitionScore(plan,{seconds=plan.seconds,intensity=.45}={}){
 if(!supported.has(plan.style))return null;
 const bpm=plan.tempoBlend?(plan.bpmA+plan.bpmB)/2:plan.bpmA;
 const rawBeats=Math.max(.1,seconds*Math.max(30,bpm||120)/60),beats=Math.abs(rawBeats-Math.round(rawBeats))<1e-6?Math.round(rawBeats):rawBeats,bass=['bass','phrase'].includes(plan.style);
 const handoffBeat=bass?(beats>=8?Math.floor(beats/8)*4:beats*.5):(beats>=8?Math.max(4,Math.floor((beats-4)/4)*4):beats*.75);
 const edge=clamp(handoffBeat/beats,.1,.9),half=Math.min(.5/beats,edge*.45,(1-edge)*.45),amount=clamp(Number(intensity)||0,0,1);
 const guard=Boolean(plan.harmonicGuard),filter=plan.style==='filter'||plan.style==='riser';
 const overlapBeats=guard?Math.min(2,beats*.25):plan.style==='echo'?Math.min(2,beats*.25):Math.min(4,beats*.375);
 const begin=Math.max(0,edge-overlapBeats/beats),end=plan.style==='echo'?Math.min(1,edge+.5/beats):edge;
 const score={version:1,style:plan.style,beats,handoffBeat:edge*beats,handoffFraction:edge,harmonicGuard:guard,crossfade:bass?{begin:0,end:1}:{begin,end},parameters:{},stages:[]};
 const parameters=score.parameters;
 if(bass){
  const bassCurve=incoming=>Array.from({length:33},(_,i)=>{const p=i/32,amplitude=incoming?Math.sin(p*Math.PI/2):Math.cos(p*Math.PI/2);return[edge-half+2*half*p,Math.max(-24,20*Math.log10(Math.max(.00001,amplitude)))];});
  parameters.outLow=[[0,0],...bassCurve(false),[1,-24]];
  parameters.inLow=[[0,-24],...bassCurve(true),[1,0]];
  parameters.outMid=[[0,0],[edge,0],[1,-6]];parameters.inMid=[[0,-6],[edge,0],[1,0]];
  parameters.outHigh=[[0,0],[1,-9]];parameters.inHigh=[[0,-6],[edge,0],[1,0]];
 }else{
  parameters.outLow=[[0,0],[Math.max(0,begin-half),0],[edge,-18],[1,-18]];
  parameters.inLow=[[0,filter?-9:-18],[Math.max(0,edge-half),filter?-9:-18],[Math.min(1,edge+half),0],[1,0]];
 }
 if(filter){
  parameters.outHighpass=[[0,18],[begin*.5,45],[begin,220+amount*280],[edge,3500+amount*2500],[1,9000]];
  parameters.echoSend=[[0,0],[Math.max(0,begin-1/beats),0],[begin,.14+amount*.12],[edge,0],[1,0]];
 }else if(plan.style==='echo'){
  parameters.outHighpass=[[0,18],[begin,18],[edge,420+amount*380],[1,1400]];
  parameters.echoSend=[[0,0],[Math.max(0,edge-2/beats),0],[Math.max(0,edge-1/beats),.4+amount*.2],[edge,.4+amount*.2],[Math.min(1,edge+.15/beats),0],[1,0]];
 }
 if(plan.style==='phrase')parameters.echoSend=[[0,0],[.67,0],[.75,.08+amount*.12],[1,0]];
 score.echo=filter?{division:.5,feedback:.27,wet:.48}:plan.style==='echo'?{division:1,feedback:.36+amount*.08,wet:.66}:plan.style==='phrase'?{division:1,feedback:.32,wet:.4}:null;
 score.texture=plan.style==='riser'?{begin:Math.max(0,begin-2/beats),end:edge,releaseEnd:Math.min(1,edge+Math.min(4,beats*.25)/beats),amount:amount*.58}:null;
 score.stages=[{at:0,label:plan.tempoBlend?'Caler et faire évoluer le tempo':'Installer le groove'},{at:Math.max(0,begin),label:bass?'Ouvrir le titre entrant':filter?'Monter le filtre':'Capturer la dernière pulsation'},{at:edge,label:bass?'Relayer kick et basse':'Poser le nouveau groove'},{at:1,label:'Laisser jouer le titre entrant'}];
 return score;
}
export function scoreProgress(score,fraction){const {begin,end}=score.crossfade;return smooth((fraction-begin)/Math.max(.00001,end-begin));}
export function transitionSourceOffset(plan,fraction){
 const seconds=plan.seconds??plan.duration,span=plan.sourceSpanSeconds??seconds,p=clamp(fraction,0,1);
 return span*(plan.tempoBlend?tempoBeats(p*seconds,plan.bpmA,plan.bpmB,seconds)/tempoBeats(seconds,plan.bpmA,plan.bpmB,seconds):p);
}

// Consecutive equal positions are consolidated before scheduling, including
// passages shortened near EOF. Web Audio receives strictly ordered points.
export function scorePoints(points){const values=new Map();for(const [at,value]of points)values.set(clamp(at,0,1),value);return [...values].sort((a,b)=>a[0]-b[0]);}
export function scheduleTransitionScore(context,{score,a,b,t,start,duration,at}={}){
 if(!score)return;
 const now=context.currentTime;
 const params={outLow:a.transitionLow.gain,inLow:b.transitionLow.gain,outMid:a.transitionMid.gain,inMid:b.transitionMid.gain,outHigh:a.transitionHigh.gain,inHigh:b.transitionHigh.gain,outHighpass:a.transitionHighpass.frequency,echoSend:a.echoSend.gain};
 for(const [name,raw]of Object.entries(score.parameters)){
  const param=params[name],points=scorePoints(raw),exponential=name==='outHighpass';
  param.cancelScheduledValues(now);param.setValueAtTime(points[0][1],now);param.setValueAtTime(points[0][1],start);
  for(const [fraction,value]of points.slice(1)){if(exponential)param.exponentialRampToValueAtTime(value,at(fraction));else param.linearRampToValueAtTime(value,at(fraction));}
 }
 if(score.echo){t.echoUsed=true;for(const [param,value]of [[a.delay.delayTime,score.echo.division*60/t.bpmA],[a.feedback.gain,score.echo.feedback],[a.wet.gain,score.echo.wet]]){param.cancelScheduledValues(now);param.setValueAtTime(value,now);}}
 t.filterSource=Boolean(score.parameters.outHighpass);
}
