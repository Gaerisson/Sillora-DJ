// Effect selection is separated from track planning and the DSP lifecycle.
export const AUTOMATIC_FX_HISTORY = 2;
export const AUTOMATIC_FX_ENERGETIC_BPM = 120;

function hash(text) {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const knownTempo = track => track?.confidence === 'manual' || track?.confidence === 'generated' || track?.tempoConfidence >= .65;
const energy = track => Number.isFinite(track?.energy) ? clamp(track.energy, 0, 1) : Number.isFinite(track?.rms) ? clamp(track.rms / .25, 0, 1) : null;
const identity = track => [track?.id, track?.title, track?.bpm, track?.mixIn, track?.mixOut].join('|');
const requestedLength = value => [2, 4, 8, 16, 32].filter(length => length <= clamp(Number(value) || 16, 2, 32)).at(-1) || 2;
const effectLabels = {
 clean:'Relais propre',phrase:'Relais harmonique',blend:'Fondu',bass:'Échange des graves',dissolve:'Dissolve',
 filter:'Filtre montant',echo:'Echo out',riser:'Whoosh rise',sweep:'Sweep',lunarecho:'Écho orbital',
 hydrant:'Jet',tremolo:'Tremolo',stemfade:'Fondu des stems',stemecho:'Écho des voix',stemsustain:'Tenue harmonique',
};

function recentCandidates(scores, history) {
 const all = Object.keys(scores), recent = (Array.isArray(history) ? history : []).slice(-AUTOMATIC_FX_HISTORY);
 let allowed = all.filter(style => !recent.includes(style));
 if (!allowed.length) allowed = all.filter(style => style !== recent.at(-1));
 if (!allowed.length) allowed = all;
 return {allowed, candidates:all, excluded:[...new Set(recent.filter(style => all.includes(style) && !allowed.includes(style)))]};
}

/** Original musical policy. `sync` is an already validated clock decision;
 * this selector never widens its range or turns an unknown tempo into a grid.
 * Scores express arrangement needs. The pair hash breaks score ties only.
 */
export function selectMusicalFx({source, target, sync, trustworthy = true, harmonic = true, keyKnown = false,
 dense = false, intensity = .45, history = [], stemsAvailable = false, tempoBlend = false, beats = 16} = {}) {
 const amount = clamp(Number.isFinite(intensity) ? intensity : .45, 0, 1), requested = requestedLength(beats);
 const uncertain = !trustworthy, measured = knownTempo(source) && knownTempo(target);
 const safeRelay = !sync || !harmonic || uncertain && (!tempoBlend || !measured);
 if (safeRelay) {
  return {style:'clean',beats:Math.min(16,requested),candidates:['clean'],weights:{clean:1},excluded:[],mode:'musical',
   reason:!sync?'Tempos non synchronisés : relais court, chaque titre garde sa vitesse.' : !harmonic?'Tonalités éloignées : relais court pour séparer les mélodies.' : 'Grille ou tempo peu fiable : relais court sans superposer les rythmes.',
   stages:[{at:0,label:'Garder le groove'},{at:.6875,label:'Dernière pulsation'},{at:.75,label:'Poser le nouveau titre'}]};
 }

 const aEnergy=energy(source),bEnergy=energy(target),energyDelta=aEnergy===null||bEnergy===null?null:bEnergy-aEnergy;
 const energetic=Math.min(source?.bpm||0,target?.bpm||0)>AUTOMATIC_FX_ENERGETIC_BPM;
 const ratio=(source?.bpm||120)/(target?.bpm||120),tempoDistance=Math.abs(Math.log2(ratio));
 let scores={},maximum=requested,context='';
 if (uncertain) {
  // The measured BPM can morph, but avoid chopped gates and long melodic beds
  // while the positions of individual beats remain estimated.
  scores=amount<.2?{filter:8,echo:7}:{riser:10,filter:8,sweep:7,echo:6};
  maximum=Math.min(16,requested);context='BPM mesurés : variation commune et chevauchement limité. Grille estimée : vérifiez le premier temps.';
 } else if (dense) {
  scores={bass:10,echo:8,filter:7};
  if(stemsAvailable){scores.stemfade=11;scores.stemecho=9;}
  maximum=Math.min(8,requested);context='Arrangement dense : passage court pour limiter les voix et les graves simultanés.';
 } else if (amount<.2) {
  scores=keyKnown?{phrase:10,blend:8,bass:7}:{bass:9,blend:8};
  maximum=Math.min(keyKnown?32:16,requested);context='Intensité faible : traitement discret et échange de niveaux ou de graves.';
 } else {
  scores=keyKnown?{phrase:10,blend:7,bass:6,dissolve:8,filter:6,echo:5,sweep:6,lunarecho:7}:{bass:10,blend:7,dissolve:8,filter:6,echo:6,sweep:5};
  maximum=Math.min(keyKnown?32:16,requested);
  context=keyKnown?'Tonalités compatibles et grille stable : passage harmonique, avec mémoire des derniers effets.' : 'Tonalité incertaine : relais des graves et durée limitée.';
  if(tempoBlend && tempoDistance>.02){scores.riser=12;scores.sweep=11;scores.filter=10;maximum=Math.min(16,maximum);context='Les tempos évoluent ensemble : souffle ou balayage sur le même relais musical.';}
  if(energyDelta!==null && energyDelta>.12){scores.sweep+=3;if(tempoBlend||energetic)scores.riser=(scores.riser||6)+2;context+=' Énergie montante : préparer l’arrivée du prochain groove.';}
  if(energyDelta!==null && energyDelta<-.12){scores.echo+=4;if(keyKnown)scores.lunarecho+=3;context+=' Énergie descendante : laisser respirer une queue d’écho.';}
  if(energetic&&amount>=.55){scores.tremolo=7;if(amount>=.7)scores.hydrant=energyDelta!==null&&energyDelta>.05?14:7;}
  if(stemsAvailable){scores.stemfade=11;scores.stemecho=8;if(keyKnown)scores.stemsustain=9;}
 }
 const eligibility=recentCandidates(scores,history),seed=[identity(source),identity(target)].join('→');
 const order=[...eligibility.allowed].sort((a,b)=>scores[b]-scores[a] || hash(seed+'|'+a)-hash(seed+'|'+b));
 const style=order[0],short=['echo','lunarecho','tremolo','hydrant','stemecho'].includes(style);
 const length=Math.min(maximum,short?8:['phrase','blend','stemfade','stemsustain'].includes(style)?32:16);
 const prefix=effectLabels[style]||style,stages=[{at:0,label:'Installer le passage'},{at:.4,label:'Relayer le groove'},{at:.78,label:'Laisser le prochain titre'}];
 return {style,beats:length,reason:prefix+' — '+context,...eligibility,weights:scores,mode:'musical',stages};
}

export function selectAutomaticFx({source, target, sync, dense = false, harmonic = true, intensity = .45, history = [],stemsAvailable=false}) {
  // Balance smooth dissolves, low-pass exits, short cuts and bass exchanges.
  let weighted = ['dissolve', 'dissolve', 'dissolve', 'lowpass', 'stutter', 'bass', 'bass'];
  if (source?.bpm > AUTOMATIC_FX_ENERGETIC_BPM && target?.bpm > AUTOMATIC_FX_ENERGETIC_BPM) {
    weighted.push('space', 'riser', 'downlift', 'sweep', 'lunarecho');
    if(intensity>=.7)weighted.push('hydrant','tremolo');
  }
  if(stemsAvailable)weighted.push('stemfade','stemfade','stemecho','stemecho',...(harmonic&&source?.keyConfidence>.35&&target?.keyConfidence>.35?['stemsustain','stemsustain']:[]));
  // Constrain candidates to the supported playback conditions.
  if (!sync) weighted = ['linear', 'reverb', 'lowpass'];
  else if (dense || !harmonic) weighted = ['bass', 'bass', 'filter', 'echo'];
  else if (intensity < .7) weighted = weighted.filter(style => style !== 'stutter');
  let candidates = [...new Set(weighted)];
  if (intensity < .2) candidates = sync ? ['dissolve', 'bass', 'lowpass'] : ['linear', 'lowpass'];
  weighted = weighted.filter(style => candidates.includes(style));
  const recent = history.slice(-AUTOMATIC_FX_HISTORY);
  let allowed = weighted.filter(style => !recent.includes(style));
  // With only two safe candidates, prefer avoiding the immediately last effect.
  if (!allowed.length) allowed = weighted.filter(style => style !== recent.at(-1));
  if (!allowed.length) allowed = weighted;
  const seed = [identity(source), identity(target), ...history.slice(-8)].join('→');
  const style = allowed[hash(seed) % allowed.length];
  return {style, candidates, weights: Object.fromEntries(candidates.map(id => [id, weighted.filter(x => x === id).length])), excluded: [...new Set(recent.filter(id => !allowed.includes(id)))], mode: 'varied'};
}
