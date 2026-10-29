import {phraseAnchor} from './phrase-cues.mjs';
import {tempoMean} from './tempo-automation.mjs';
import {arrangementFor} from './arrangement.mjs';

const mean=values=>values.reduce((sum,v)=>sum+v,0)/Math.max(1,values.length);
const levels=new WeakMap();
function bodyLevel(track){const env=track.envelope,old=levels.get(track);if(old?.env===env)return old.value;const values=Array.from(env).filter(v=>Number.isFinite(v)&&v>.0001).sort((a,b)=>a-b),value=values[Math.floor((values.length-1)*.8)]||0;levels.set(track,{env,value});return value;}
function usableLead(track,cue,point,span){
 const end=Math.min(track.buffer?.duration??0,track.audibleEnd??Infinity),start=Math.max(0,track.audibleStart||0),env=track.envelope;
 if(!env?.length||!Number.isFinite(cue)||cue<start||point<=cue||point+span+1>end)return false;
 const level=bodyLevel(track);if(!level)return false;
 const lead=Array.from(env.slice(Math.floor(cue*10),Math.ceil(point*10))),after=Array.from(env.slice(Math.floor(point*10),Math.ceil((point+240/track.bpm)*10)));
 if(!lead.length||lead.some(v=>!Number.isFinite(v)||v<0)||after.some(v=>!Number.isFinite(v)||v<0))return false;
 return mean(lead.slice(0,Math.max(1,Math.min(lead.length,Math.ceil(600/track.bpm)))))>=level*.12&&lead.filter(v=>v>=level*.1).length/lead.length>=.8&&mean(after)>=level*.45;
}
function cueAt(track,plan,point,score,seconds){
 if(!score||!(seconds>0)||!Number.isFinite(plan.rate)||plan.rate<=0)return null;
 const span=seconds*(plan.tempoBlend?tempoMean(plan.rate,1,plan.tempoShape):plan.rate),lead=span*score.handoffFraction,cue=point.time-lead;
 const usable=point.origin==='manual'?cue>=Math.max(0,track.audibleStart||0)&&cue+span<Math.min(track.buffer?.duration??0,track.audibleEnd??Infinity)-.02:usableLead(track,cue,point.time,span);
 if(lead<.1||!usable)return null;
 return {...point,cue,leadSeconds:lead,spanSeconds:span,handoffFraction:score.handoffFraction};
}
// This is a measured energy/bass change, not a semantic phrase or drop label.
export function selectIncomingLanding(track,plan,{enabled=true,quantize=true}={}){
 if(!enabled||typeof track.id!=='string'||!track.id||!plan.automatic||plan.profile!=='musical'||!plan.sync||!plan.trustworthy||!plan.score||track.manualRegions)return null;
 const manual=phraseAnchor(track,'entry',{quantize});if(manual){const chosen=cueAt(track,plan,{...manual,version:1,trackId:track.id},plan.score,plan.seconds);if(chosen)return chosen;}
 const base=plan.inPoint||0,bar=240/track.bpm,start=track.audibleStart||0,limit=Math.min(start+64,(track.buffer?.duration||0)*.4,base+bar*8),choices=[];
 for(const [index,point]of arrangementFor(track).landmarks.entries()){
  if(point.time<base-bar-.001||point.time>limit||!(point.kind==='lift'||point.kind==='change'&&point.bassDelta>.1))continue;
  const landing=cueAt(track,plan,{version:1,trackId:track.id,time:point.time,index,label:'R'+(index+1),kind:point.kind,confidence:point.confidence},plan.score,plan.seconds);
  if(landing)choices.push(landing);
 }
 choices.sort((a,b)=>Math.abs(a.cue-base)-Math.abs(b.cue-base)||b.confidence-a.confidence||a.time-b.time);
 return choices[0]||null;
}
export function runtimeIncomingLanding(track,plan,score,seconds){
 const point=plan.incomingLanding;
 return point&&point.trackId===track.id&&!track.manualRegions?cueAt(track,plan,point,score,seconds):null;
}
