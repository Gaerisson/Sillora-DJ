export const tempoLimits=Object.freeze([3,5,8,12,16,20]);
export const tempoLimit=value=>tempoLimits.includes(value)?value:20;
const valid=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
export const reliableTempo=track=>track?.confidence==='manual'||track?.confidence==='generated'||track?.tempoConfidence>=.65&&track?.beatStability>=.65;

// A reciprocal ratio gives the same decision in either playback direction.
export function matchPulse(source,target,{octaves=true,maxStretch=.055}={}){
 if(!valid(source)||!valid(target))return {known:false,compatible:false,ratio:1,octave:1,difference:null,gap:null,score:.25};
 const matches=(octaves?[1,.5,2]:[1]).map(octave=>{const ratio=source/(target*octave);return {octave,ratio,gap:Math.max(ratio,1/ratio)-1};}).sort((a,b)=>a.gap-b.gap);
 const best=matches[0];return {...best,known:true,compatible:best.gap<=maxStretch+1e-10,difference:Math.abs(best.ratio-1),score:Math.exp(-Math.abs(Math.log2(best.ratio))*6)};
}
export function transitionTempo(source,target,options={}){
 const automatic=options.style==='auto',morph=options.tempoBlend===true,limitPercent=tempoLimit(options.maxTempoPercent),maxStretch=Math.min(limitPercent/100,morph?.20:automatic?.055:.085);
 const pulse=matchPulse(source?.bpm,target?.bpm,{octaves:automatic&&options.profile==='musical',maxStretch});
 const trustworthy=reliableTempo(source)&&reliableTempo(target),measured=[source,target].every(t=>reliableTempo(t)||t?.tempoConfidence>=.65);
 const permitted=options.sync!==false&&pulse.known&&pulse.compatible&&(!automatic||trustworthy||morph&&measured);
 const status=options.sync===false?'off':!pulse.known?'unknown':!pulse.compatible?'limit':automatic&&!trustworthy&&!(morph&&measured)?'grid':'ready';
 const gapPercent=pulse.gap===null?null:pulse.gap*100,effectiveLimitPercent=maxStretch*100;
 const reason=status==='limit'?`Écart de tempo ${gapPercent.toFixed(1)} % > limite ${effectiveLimitPercent.toFixed(1)} % : relais au tempo naturel.`:status==='grid'?'Grille incertaine : relais au tempo naturel.':status==='unknown'?'Tempo inconnu : relais au tempo naturel.':status==='off'?'Sync désactivée : tempos naturels.':`Écart ${gapPercent.toFixed(1)} % · limite ${effectiveLimitPercent.toFixed(1)} %${trustworthy?'':' · grille estimée'}`;
 return {...pulse,sync:Boolean(permitted),trustworthy,measured,status,limitPercent,effectiveLimitPercent,gapPercent,reason,bpmB:(valid(target?.bpm)?target.bpm:120)*pulse.octave};
}
