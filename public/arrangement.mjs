import {clamp} from './audio-math.mjs';

export const ARRANGEMENT_VERSION=1;
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const dbRatio=(a,b)=>20*Math.log10(Math.max(.00001,a)/Math.max(.00001,b));
const reliable=t=>t.confidence==='manual'||t.confidence==='generated'||t.tempoConfidence>=.65&&t.beatStability>=.65;
const gridConfidence=t=>reliable(t)?t.confidence==='manual'||t.confidence==='generated'?1:Math.min(t.tempoConfidence,t.beatStability):0;
const durationOf=t=>finite(t.buffer?.duration,finite(t.duration,finite(t.audibleEnd,(t.envelope?.length||0)/10)));
const gridOf=t=>({bpm:finite(t.bpm),downbeat:finite(t.downbeat,finite(t.beatOffset))});
function powerAt(values,start,end){
 if(!values?.length)return null;
 let sum=0,count=0;
 for(let i=Math.max(0,Math.floor(start*10));i<Math.min(values.length,Math.ceil(end*10));i++)if(Number.isFinite(values[i])){sum+=values[i]*values[i];count++;}
 return count?Math.sqrt(sum/count):null;
}
const averageRows=rows=>({rms:Math.sqrt(mean(rows.map(r=>r.rms*r.rms))),bass:mean(rows.map(r=>r.bass)),density:mean(rows.map(r=>r.density))});

// Changes in measured energy/bass/spectral occupancy, not semantic phrases.
// Two bars on each side reject isolated accents; no regular marker is invented.
export function analyzeArrangement(track){
 const {bpm,downbeat}=gridOf(track),result={version:ARRANGEMENT_VERSION,bpm,downbeat,gridConfidence:gridConfidence(track),landmarks:[]},duration=durationOf(track);
 if(bpm<30||bpm>300||!reliable(track)||!(duration>0)||!track.envelope?.length)return result;
 const bar=240/bpm,start=Math.max(0,finite(track.audibleStart)),end=Math.min(duration,finite(track.audibleEnd,duration));
 if(end-start<bar*8)return result;
 const windows=(track.structure||[]).filter(w=>Number.isFinite(w.time)&&Number.isFinite(w.density)).sort((a,b)=>a.time-b.time),rows=[];
 let cursor=0;
 const first=downbeat+Math.ceil((start-downbeat-1e-7)/bar)*bar;
 for(let at=Math.max(0,first);at+bar<=end+.00001&&rows.length<20000;at+=bar){
  const rms=powerAt(track.envelope,at,at+bar)??0,bass=powerAt(track.bassEnvelope,at,at+bar);let density=0,weight=0;
  while(cursor+1<windows.length&&windows[cursor+1].time<=at)cursor++;
  for(let i=cursor;i<windows.length&&windows[i].time<at+bar;i++){
   const hi=windows[i+1]?.time??windows[i].time+bar,overlap=Math.max(0,Math.min(at+bar,hi)-Math.max(at,windows[i].time));density+=clamp(windows[i].density,0,1)*overlap;weight+=overlap;
  }
  rows.push({time:at,rms,bass:bass===null?0:clamp(bass/Math.max(.00001,rms),0,1),density:weight?density/weight:0});
 }
 if(rows.length<8)return result;
 const body=rows.map(r=>r.rms).sort((a,b)=>a-b)[Math.floor(rows.length*.8)];if(body<.0001)return result;
 const confidence=gridConfidence(track),candidates=[];
 for(let i=2;i<rows.length-1;i++){
  const left=rows.slice(i-2,i),right=rows.slice(i,i+2);if(right.length<2)continue;
  const a=averageRows(left),b=averageRows(right);
  if(Math.max(a.rms,b.rms)<body*.15||Math.min(a.rms,b.rms)<.0001)continue;
  // A one-bar transient cannot qualify via its temporarily inflated average.
  if([left,right].some(g=>Math.abs(dbRatio(g[0].rms,g[1].rms))>7||Math.abs(g[0].density-g[1].density)>.18||Math.abs(g[0].bass-g[1].bass)>.25))continue;
  const energyDeltaDb=dbRatio(b.rms,a.rms),bassDelta=b.bass-a.bass,densityDelta=b.density-a.density;
  const score=clamp(clamp(Math.max(Math.abs(energyDeltaDb)/9*.95,Math.abs(densityDelta)/.22*.9,Math.abs(bassDelta)/.32*.85),0,1)*confidence,0,.99);
  if(score<.55)continue;
  candidates.push({time:rows[i].time,confidence:Math.round(score*1000)/1000,kind:energyDeltaDb>2?'lift':energyDeltaDb< -2?'release':'change',energyDeltaDb:Math.round(energyDeltaDb*100)/100,bassDelta:Math.round(bassDelta*1000)/1000});
 }
 const picked=[];
 for(const point of candidates.sort((a,b)=>b.confidence-a.confidence||a.time-b.time))if(picked.every(p=>Math.abs(p.time-point.time)>=bar*4-.001))picked.push(point);
 result.landmarks=picked.sort((a,b)=>a.time-b.time).slice(0,256);return result;
}

const cache=new WeakMap();
export function arrangementFor(track){
 const grid=gridOf(track),signature=[track.envelope,track.bassEnvelope,track.structure,grid.bpm,grid.downbeat,track.confidence,track.tempoConfidence,track.beatStability,track.audibleStart,track.audibleEnd,durationOf(track)],old=cache.get(track);
 if(old&&signature.every((value,i)=>value===old.signature[i]))return old.result;
 const saved=track.arrangement,bar=240/Math.max(30,grid.bpm),valid=!old&&reliable(track)&&saved?.version===ARRANGEMENT_VERSION&&saved.bpm===grid.bpm&&saved.downbeat===grid.downbeat&&saved.gridConfidence===gridConfidence(track)&&Array.isArray(saved.landmarks)&&saved.landmarks.length<=256&&saved.landmarks.every(p=>Number.isFinite(p.time)&&p.time>=0&&p.time<durationOf(track)&&Number.isFinite(p.confidence)&&p.confidence>=.55&&p.confidence<=1&&['lift','release','change'].includes(p.kind)&&Math.abs((p.time-grid.downbeat)/bar-Math.round((p.time-grid.downbeat)/bar))<1e-4);
 const result=valid?saved:analyzeArrangement(track);cache.set(track,{signature,result});return result;
}
