import {phraseAnchor} from './phrase-cues.mjs';
import {clamp} from './audio-math.mjs';
import {arrangementFor} from './arrangement.mjs';

const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const average=values=>values.length?values.reduce((sum,value)=>sum+finite(value),0)/values.length:0;
export const gridReliable=track=>track.confidence==='manual'||track.confidence==='generated'||(track.tempoConfidence>=.65&&track.beatStability>=.65);
const trackDuration=track=>Math.max(.1,finite(track.buffer?.duration,finite(track.audibleEnd,180)));
const barLength=track=>240/Math.max(30,finite(track.bpm,120));
const bounds=track=>{const duration=trackDuration(track);return {start:clamp(finite(track.audibleStart),0,duration),end:clamp(finite(track.audibleEnd,duration),0,duration)};};
function levelAt(envelope,time,span=1){
 if(!envelope?.length)return null;
 const lo=Math.max(0,Math.floor((time-span/2)*10)),hi=Math.min(envelope.length,Math.ceil((time+span/2)*10));
 return hi>lo?average(envelope.slice(lo,hi)):null;
}
function snap(track,time,direction='ceil'){
 if(!gridReliable(track))return time;
 const bar=barLength(track),offset=finite(track.downbeat,finite(track.beatOffset));
 return offset+Math[direction]((time-offset)/bar+(direction==='ceil'?-1e-7:1e-7))*bar;
}
const energyCache=new WeakMap();
function bodyLevel(track){
 const envelope=track.envelope,structure=track.structure;
 const cached=energyCache.get(track);if(cached&&cached.envelope===envelope&&cached.structure===structure)return cached.value;
 const values=(structure?.length?structure.map(w=>w.rms):envelope?Array.from(envelope):[]).filter(v=>Number.isFinite(v)&&v>.0001).sort((a,b)=>a-b);
 const value=values.length?values[Math.floor((values.length-1)*.8)]:finite(track.rms,.1);
 energyCache.set(track,{envelope,structure,value});return value;
}

// These are measured energy regions. A bar grid is used only when its timing is
// trusted; no vocal, chorus, drop or phrase label is inferred from energy alone.
export function musicalEntry(track){
 const {start,end}=bounds(track),duration=trackDuration(track);
 if(track.manualRegions)return clamp(finite(track.mixIn),0,Math.max(0,duration-.05));
 const bar=barLength(track),limit=Math.min(end-Math.min(2,bar),start+Math.min(64,duration*.4));
 const windows=(track.structure||[]).filter(w=>Number.isFinite(w.time)&&Number.isFinite(w.rms)&&w.time>=start-.05&&w.time<=limit);
 const threshold=Math.max(.0001,bodyLevel(track)*.5);
 let chosen=null;
 for(const window of windows){
  const at=clamp(snap(track,window.time),start,end-.05);
  const first=levelAt(track.envelope,at+bar/2,bar)??window.rms;
  const second=levelAt(track.envelope,at+bar*1.5,bar)??window.rms;
  if(first>=threshold&&second>=threshold*.7){chosen=at;break;}
 }
 let entry=chosen??Math.max(start,finite(track.mixIn,start));
 // A failed/sparse analysis must not place IN inside a silent lead-in.
 if(track.envelope?.length&&chosen===null){
  for(let at=start;at<=Math.max(start,limit);at+=.1){if((levelAt(track.envelope,at+bar/2,bar)??0)>=threshold&&(levelAt(track.envelope,at+bar*1.5,bar)??0)>=threshold*.7){entry=snap(track,at);break;}}
 }
 const landmark=arrangementFor(track).landmarks.find(p=>p.time>=entry-.05&&p.time<=Math.min(limit,entry+bar*4)+.001&&(p.kind==='lift'||p.bassDelta>.1)&&(levelAt(track.envelope,p.time+bar,bar*2)??0)>=threshold);
 return clamp(landmark?.time??entry,start,Math.max(start,end-.05));
}

export function cleanTiming(duration){
 const seconds=Math.max(.05,finite(duration,8)),fadeSeconds=Math.min(.06,seconds*.08),handoffFraction=.75;
 return {handoffFraction,incomingStartFraction:handoffFraction,fadeSeconds,incomingFullFraction:handoffFraction+fadeSeconds/seconds,sourceStopFraction:handoffFraction+fadeSeconds/seconds};
}

export function musicalExit(track,duration,position=0,{handoffFraction=1,preparedPhrases=false,quantize=true}={}){
 const {start,end}=bounds(track),bar=barLength(track);
 if(track.manualRegions)return clamp(finite(track.mixOut,end-duration*handoffFraction),start,Math.max(start,end-.05));
 const threshold=Math.max(.0001,bodyLevel(track)*.5),tailStart=Math.max(start,end-Math.max(60,bar*32,trackDuration(track)*.35));
 // Locate the last sustained body before a quiet outro, rather than an arbitrary
// isolated minimum near the final frame. The fade finishes before this boundary.
 let activeEnd=end;
 if(track.envelope?.length){
  for(let at=end;at>=tailStart;at-=Math.min(.5,bar/4)){
   if((levelAt(track.envelope,at-bar/2,bar)??0)>=threshold){activeEnd=at;break;}
  }
 }else{
  const windows=(track.structure||[]).filter(w=>w.time>=tailStart&&w.time<end&&w.rms>=threshold);
  if(windows.length)activeEnd=Math.min(end,windows.at(-1).time+bar);
 }
 const fraction=clamp(finite(handoffFraction,1),0,1),latest=Math.min(activeEnd-.08,end-Math.max(0,duration)*(1-fraction)-.04);
 const prepared=phraseAnchor(track,'exit',{enabled:preparedPhrases,quantize});
 if(prepared&&prepared.time>=position+duration*fraction+.12&&prepared.time<=latest+.001)return prepared.time-duration*fraction;
 let handoff=snap(track,Math.max(start,latest),'floor');
 const landmark=arrangementFor(track).landmarks.filter(p=>p.time<=handoff+.001&&p.time>=handoff-bar*8&&p.time>=start).at(-1);
 if(landmark)handoff=landmark.time;
 const planned=Math.max(start,handoff-duration*fraction);
 // Keep the plan stable while approaching it. If already past it, the engine
// schedules the next safe boundary; do not move every preview by its lookahead.
 return clamp(planned,start,Math.max(start,end-.1));
}

export function composedPlan({source,target,sync,harmonic,keyKnown=false,dense,stems,beats=16,position=0,bpmA=source.bpm||120}){
 const clean=!sync||keyKnown&&!harmonic,sourceRate=bpmA/Math.max(30,finite(source.bpm,bpmA));
 if(clean){
  const length=16,seconds=length*60/Math.max(30,bpmA),timing=cleanTiming(seconds);
  const outPoint=musicalExit(source,seconds*sourceRate,position,timing),inPoint=musicalEntry(target);
  return {style:'clean',beats:length,seconds,inPoint,outPoint,...timing,handoffPosition:outPoint+seconds*sourceRate*timing.handoffFraction,preserveInPoint:Boolean(target.manualRegions),quantizeHandoff:gridReliable(source)&&!source.manualRegions,stages:[{at:0,label:'Garder le groove sortant'},{at:.5,label:'Préparer le relais des graves'},{at:.6875,label:'Dernière pulsation, écho discret'},{at:.75,label:'Poser le nouveau titre'}],reason:(keyKnown&&!harmonic?'Tonalités éloignées : pas de long chevauchement mélodique. ':!sync?'Tempos éloignés ou grille incertaine : chaque titre garde sa vitesse. ':'')+'Relais court au niveau plein, entrée sur une zone d’énergie mesurée et écho discret de la dernière pulsation. Le titre sortant reste présent jusqu’au relais.'};
 }
 const style=stems?'stemfade':keyKnown&&harmonic&&!dense?'phrase':'bass';
 const length=dense||!keyKnown?16:beats>=32?32:16,seconds=length*60/Math.max(30,bpmA);
 return {style,beats:length,seconds,inPoint:musicalEntry(target),outPoint:musicalExit(source,seconds*sourceRate,position),preserveInPoint:Boolean(target.manualRegions),quantizeHandoff:false,handoffFraction:.5,incomingStartFraction:0,stages:[{at:0,label:'Installer la nouvelle mesure'},{at:.4,label:stems?'Relayer les voix et les graves':'Échanger les lignes de basse'},{at:.75,label:'Laisser place au titre entrant'}],reason:stems?'Voix relayées et graves échangés sur les mesures alignées.':style==='phrase'?'Tempo stable et tonalités compatibles : entrée sur 4 à 8 mesures, graves relayés et niveau conservé.':'Tempo stable : relais des graves sur 4 mesures ; chevauchement limité quand l’arrangement est dense ou la tonalité incertaine.'};
}
