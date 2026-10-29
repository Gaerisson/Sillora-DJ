import {tempoMean} from './tempo-automation.mjs';
import {makeTransitionScore} from './transition-score.mjs';

// Spectral occupancy is measured per bar. It does not identify voices or phrases.
export function densityWindow(track,start,span){
 const duration=track?.buffer?.duration??track?.duration??Infinity,from=Math.max(0,Number.isFinite(start)?start:0),length=Number.isFinite(span)?Math.max(0,span):0,to=Math.min(duration,from+length),bar=240/(track?.bpm||120);
 let covered=0,total=0,lastEnd=-Infinity,lastTime=-Infinity;
 for(const row of track?.structure||[]){
  if(!Number.isFinite(row?.time)||row.time<lastTime||!Number.isFinite(row.density)||row.density<0||row.density>1)continue;
  lastTime=row.time;const lo=Math.max(from,row.time,lastEnd),hi=Math.min(to,row.time+bar);if(hi<=lo)continue;
  const weight=hi-lo;total+=row.density*weight;covered+=weight;lastEnd=hi;
 }
 const coverage=length>0?Math.min(1,covered/length):0,known=length>.01&&coverage>=.75;
 return {start:from,end:Math.max(from,to),coverage,known,value:known?total/covered:null};
}
export function assessOverlap(source,target,plan){
 const seconds=plan.seconds??plan.duration??0,spanA=plan.sourceSpanSeconds??seconds*(plan.sourceRate||1),rate=plan.rate??1,spanB=seconds*(plan.tempoBlend?tempoMean(rate,1,plan.tempoShape):rate);
 const a=densityWindow(source,plan.outPoint??0,spanA),b=densityWindow(target,plan.inPoint??0,spanB),known=a.known&&b.known,busy=known&&a.value>=.5&&b.value>=.5&&a.value+b.value>=1.1;
 return {version:1,known,busy,source:a,target:b};
}
export function dryOverlapBeats(plan){
 const s=plan.score;if(!s)return null;return Math.max(0,(s.crossfade.end-s.crossfade.begin)*s.beats);
}
export function protectOverlapScore(source,target,plan,{enabled=true,intensity=.45}={}){
 const measurement=assessOverlap(source,target,plan),before=dryOverlapBeats(plan),eligible=Boolean(plan.automatic&&plan.profile==='musical'&&plan.sync&&plan.trustworthy&&plan.score&&!plan.style.startsWith('stem')),alreadyShort=Boolean(plan.score?.harmonicGuard||before!==null&&before<=2.5);
 const applied=eligible&&enabled&&measurement.busy&&!alreadyShort,score=applied?makeTransitionScore({...plan,harmonicGuard:true,densityGuard:true},{seconds:plan.seconds??plan.duration,intensity}):plan.score;
 return {score,info:{...measurement,applied,alreadyShort:eligible&&alreadyShort,eligible,uncertain:!plan.trustworthy,natural:!plan.sync,separated:plan.style.startsWith('stem'),previousDryBeats:before,dryBeats:dryOverlapBeats({score})}};
}
export function overlapSummary(info){
 if(!info)return '';
 const label=info.natural?'Tempo naturel':info.separated?'Stems séparés':info.uncertain?'Grille à vérifier':info.applied?'Chevauchement raccourci':info.alreadyShort?'Relais déjà court':!info.known?'Densité non mesurée':info.busy?'Deux zones chargées':'Zones peu chargées';
 return label+(info.known?' · A '+Math.round(info.source.value*100)+' % / B '+Math.round(info.target.value*100)+' %':'');
}
