// Shared interpretation of measured grid evidence for desktop and Remote.
const bounded=(n,lo=0,hi=1)=>Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):null;
export function gridStatus(track){
 if(!track)return null;
 const manual=track.manualGrid||track.confidence==='manual',known=track.confidence==='generated',confidence=Math.min(bounded(track.tempoConfidence)??0,bounded(track.beatStability)??0);
 const mode=manual?'manual':known?'known':['queued','analyzing','cancelled'].includes(track.analysisStatus)?'pending':track.bpm>0&&confidence>=.65?'auto':'uncertain';
 return {mode,confidence:manual||known?1:confidence,coverage:bounded(track.beatCoverage),observations:Number.isFinite(track.beatObservationCount)&&track.beatObservationCount>=0?Math.min(1000000,Math.floor(track.beatObservationCount)):null,jitterMs:bounded(track.beatJitterMs,0,1000)};
}
export function gridLabel(status){return !status?'':status.mode==='manual'?'Grille manuelle':status.mode==='known'?'Grille connue':status.mode==='pending'?'Analyse en cours':status.mode==='auto'?'Grille '+Math.round(status.confidence*100)+' %':'Grille à vérifier';}
export function gridDetail(status){if(!status||status.observations===null)return 'Mesure indisponible';return status.observations+' attaque'+(status.observations>1?'s':'')+(status.coverage===null?'':' · '+Math.round(status.coverage*100)+' % des temps');}
