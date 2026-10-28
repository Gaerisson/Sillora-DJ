import {clamp} from './audio-math.mjs';

// Timing quality and observed coverage are different measurements. A rest does
// not contradict a clock; a dense ambiguous texture does not establish one.
export function rhythmEvidence({peaks=[],matched=[],period,phase,duration,jitter,periodic,drift=0,tempoWindowCount=0}={}){
 const unavailable={tempoConfidence:0,beatStability:0,beatCoverage:0,beatObservationCount:0,beatPhaseContrast:0,beatSupportSpanSeconds:0,tempoVariationPercent:null};
 if(!Number.isFinite(period)||period<=0||!Number.isFinite(phase)||!Number.isFinite(duration)||duration<=0||!Number.isFinite(jitter)||jitter<0)return unavailable;
 const valid=p=>Number.isFinite(p?.t)&&p.t>=0&&p.t<=duration&&Number.isFinite(p.w)&&p.w>0;
 const attacks=peaks.filter(valid),unique=new Map();
 for(const p of matched.filter(valid)){const beat=Math.round((p.t-phase)/period);if(!unique.has(beat)||unique.get(beat).w<p.w)unique.set(beat,p);}
 const observations=[...unique.values()].sort((a,b)=>a.t-b.t),count=observations.length;
 if(!attacks.length||!count)return unavailable;
 const at=offset=>attacks.reduce((sum,p)=>{const delta=p.t-phase-offset,distance=delta-Math.round(delta/period)*period;return sum+p.w*Math.exp(-.5*(distance/.035)**2);},0);
 const pulse=at(0)+at(period/2),control=at(period/4)+at(period*3/4),contrast=clamp((pulse-control)/Math.max(1e-12,pulse+control),0,1);
 const span=Math.max(0,observations.at(-1).t-observations[0].t),support=clamp(count/16,0,1)*clamp(span/Math.max(.1,Math.min(12,duration*.75)),0,1),timing=clamp(1-jitter/.075,0,1);
 const variation=Number.isFinite(drift)&&drift>=0?drift:1,globalSupport=clamp(span/Math.max(.1,duration*.5),0,1);
 return {tempoConfidence:clamp((clamp(Number.isFinite(periodic)?periodic:0,0,1)+timing)/2*(.5+.5*contrast)*support*globalSupport,0,1),beatStability:timing*clamp(1-variation*20,0,1)*support,beatCoverage:clamp(count/(duration/period),0,1),beatObservationCount:count,beatPhaseContrast:contrast,beatSupportSpanSeconds:span,tempoVariationPercent:tempoWindowCount>=2?variation*100:null};
}
