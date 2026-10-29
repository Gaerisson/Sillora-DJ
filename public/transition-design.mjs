import {selectIncomingLanding} from './incoming-landing.mjs';
import {clamp} from './audio-math.mjs';
import {selectAutomaticFx,selectMusicalFx} from './automatic-fx.mjs';
import {makeTransitionScore,scoreProgress} from './transition-score.mjs';
import {tempoFraction,tempoMean,tempoShape} from './tempo-automation.mjs';
import {composedPlan,cleanTiming,musicalEntry,musicalExit,gridReliable} from './musical-plan.mjs';
import {harmonicCompatibility,tempoCompatibility} from './dj-library.mjs';

export const transitionCatalog = [
  {id:'auto',label:'DJ dynamique',group:'Intelligent',description:'Rythme mesuré, régions musicales et niveau sonore.'},
  {id:'clean',label:'Relais propre',group:'Passages composés',description:'Le groove reste présent jusqu’au relais, puis le prochain titre entre au niveau plein avec un écho discret.'},
  {id:'bridge',label:'Écho & reprise',group:'Passages composés',description:'Préparation filtrée, écho de sortie et entrée au nouveau tempo.'},
  {id:'landing',label:'Suspension & reprise',group:'Passages composés',description:'Les mélodies se séparent dans une réverbération amortie, puis le prochain groove prend sa place.'},
  {id:'phrase',label:'Relais harmonique',group:'Passages composés',description:'Longue entrée sur les mesures, échange de basses et rappel d’écho discret.'},
  {id:'blend',label:'Fondu · Velours',group:'Fluides',description:'Fondu long à puissance constante.'},
  {id:'dissolve',label:'Dissolve',group:'Fluides',description:'Graves et aigus s’effacent, médiums en relief, entrée progressive.'},
  {id:'stemfade',label:'Stems · Fondu des voix',group:'Stems',description:'Voix espacées, batterie et basse relayées. Stems préparés requis.'},
  {id:'stemecho',label:'Stems · Echo out',group:'Stems',description:'Écho sur la voix sortante, accompagnement séparé. Stems préparés requis.'},
  {id:'stemsustain',label:'Stems · Tenue harmonique',group:'Stems',description:'Un fragment instrumental reste suspendu pendant le relais des voix et des graves. Stems préparés requis.'},
  {id:'bass',label:'EQ · Échange des graves',group:'Club',description:'Relais des graves au milieu du passage.'},
  {id:'filter',label:'Filtre · High-pass',group:'Filtres',description:'Les basses sortent dans un filtre montant.'},
  {id:'lowpass',label:'Low-pass',group:'Filtres',description:'Le titre sortant se referme en douceur.'},
  {id:'echo',label:'Echo out',group:'Espace',description:'Écho d’un temps et queue naturelle.'},
  {id:'dub',label:'Dub delay',group:'Espace',description:'Écho pointé, feedback et relais tardif.'},
  {id:'lunarecho',label:'Écho orbital',group:'Espace',description:'Répétitions croisées gauche/droite, divisions musicales et retour progressivement assombri.'},
  {id:'reverb',label:'Reverb wash',group:'Espace',description:'Réverbération ample, puis fondu.'},
  {id:'space',label:'Space sweep',group:'Espace',description:'Filtre et réverbération combinés.'},
  {id:'sweep',label:'Sweep',group:'Filtres',description:'Balayage spectral du morceau, ouverture du titre entrant et queue réverbérée courte.'},
  {id:'hydrant',label:'Jet',group:'Textures',description:'Jet filtré, courtes réflexions modulées et impulsions dosées autour du relais.'},
  {id:'tremolo',label:'Tremolo · Pulse mix',group:'Rythmiques',description:'Pulsations calées sur les temps.'},
  {id:'stutter',label:'Chop & drop',group:'Rythmiques',description:'Découpes de volume au demi-temps.'},
  {id:'slam',label:'Bass drop',group:'Club',description:'Relais rapide, graves et impact synthétique.'},
  {id:'cut',label:'Cut précis',group:'Club',description:'Relais tardif avec micro-fondu anti-clic.'},
  {id:'riser',label:'Whoosh rise',group:'Textures',description:'Montée de bruit filtré avant le relais.'},
  {id:'downlift',label:'Downlifter',group:'Textures',description:'Ouverture du titre entrant et souffle descendant.'},
  {id:'linear',label:'Fondu linéaire',group:'Fluides',description:'Les deux volumes se croisent linéairement.'}
];
export const transitionIds=transitionCatalog.map(item=>item.id);
export const transitionName=id=>transitionCatalog.find(item=>item.id===id)?.label||'Velours';
export const profiles={musical:'Mix musical',varied:'Variations FX',flow:'Voyage fluide',lift:'Montée d’énergie',peak:'Club / peak time',chill:'Afterhours'};
function energy(track,tail=false){
  const values=track.envelope||track.analysis?.envelope;
  if(values?.length){const n=Math.min(values.length,80), slice=tail?values.slice(-n):values.slice(0,n);return clamp(slice.reduce((a,b)=>a+b,0)/n/0.25,0,1);}
  return Number.isFinite(track.rms)?clamp(track.rms/0.25,0,1):null;
}
function reliable(t){return t.confidence==='manual'||t.confidence==='generated'||(t.tempoConfidence>=.65&&t.beatStability>=.65);}
function regionEnergy(t,tail,point,span=4){const values=t.envelope;if(!values?.length)return t.rms||null;const begin=point??(tail?(t.mixOut??Math.max(0,values.length/10-8)):(t.mixIn||0)),end=Math.min(values.length/10,begin+Math.max(.1,span)),slice=values.slice(Math.max(0,Math.floor(begin*10)),Math.ceil(end*10));return slice.length?Math.sqrt(slice.reduce((s,x)=>s+x*x,0)/slice.length):null;}
export function resolveTransition(a,b,options={}){
 const A=a.track,B=b.track,bpmA=(A.bpm||120)*(a.rate||1),automatic=options.style==='auto',pulse=tempoCompatibility({...A,bpm:bpmA},B),octave=automatic&&options.profile==='musical'&&pulse.compatible?pulse.octave:1,bpmB=(B.bpm||120)*octave,ratio=bpmA/bpmB;
 // A deliberate tempo morph accepts up to 20%, while ordinary Sync keeps its
 // conservative range. Estimated grids remain explicitly identified in Auto.
 const shape=tempoShape(options.tempoShape),morph=options.tempoBlend===true,trustworthy=reliable(A)&&reliable(B),within=Math.abs(Math.log2(ratio))<=Math.log2(morph?1.20:automatic?1.055:1.085);
 const measuredTempo=[A,B].every(t=>reliable(t)||t.tempoConfidence>=.65);
 const sync=Boolean(options.sync!==false&&A.bpm&&B.bpm&&within&&(!automatic||trustworthy||morph&&measuredTempo));
 let style=transitionIds.includes(options.style)?options.style:'blend',beats=Number(options.beats)||16,profile=profiles[options.profile]?options.profile:'flow',reason='';
 const dense=(A.structure?.at(-2)?.density||0)+(B.structure?.[0]?.density||0),keyKnown=A.keyConfidence>.35&&B.keyConfidence>.35;
 const harmony=harmonicCompatibility(A,B),harmonic=harmony.known?harmony.compatible:!keyKnown,regionA=(A.audibleEnd??A.buffer?.duration??Infinity)-(A.mixOut??0),regionB=(B.introEnd??Infinity)-(B.mixIn||0);
 let effectSelection=null,composition=null;
 if(automatic){
  if(!sync){style='linear';beats=trustworthy?4:4;reason=!within?'Tempos éloignés : relais court au tempo naturel.':'Rythme incertain ou Sync désactivée : relais court sans beatmatch.';}
  else if(!harmonic||dense>.45){style='bass';beats=8;reason=!harmonic?'Tonalités estimées éloignées : chevauchement raccourci et relais des graves.':'Arrangement dense : deux mesures et relais des graves pour limiter la superposition.';}
  else{style=profile==='peak'||profile==='lift'?'bass':'blend';beats=Math.min(beats,profile==='chill'?32:16);reason='Rythmes stables et tempos proches : alignement des mesures, niveaux adaptés et '+(style==='bass'?'relais des graves.':'fondu sobre.');}
  if(profile==='varied'){
   effectSelection=selectAutomaticFx({source:A,target:B,sync,dense:dense>.45,harmonic,intensity:clamp(Number(options.intensity??.45),0,1),history:options.history||[],stemsAvailable:options.stemsAvailable??Boolean(A.stemBuffer&&B.stemBuffer)});
   style=effectSelection.style;
   if(['echo','stutter'].includes(style))beats=Math.min(beats,8);
   reason=(sync?'Mesures alignées. ':'Tempo naturel conservé. ')+transitionName(style)+' choisi dans les effets disponibles, avec mémoire des derniers passages.';
  }
  const available=Math.min(regionA/(a.rate||1),regionB/(sync?ratio:1),(A.buffer?.duration||Infinity)*.4,(B.buffer?.duration||Infinity)*.4);
  while(beats>2&&beats*60/bpmA>available)beats/=2;
  if(profile==='musical'){
   composition=composedPlan({source:A,target:B,sync,harmonic,keyKnown:harmony.known,dense:dense>.45,stems:options.stemsAvailable??Boolean(A.stemBuffer&&B.stemBuffer),beats:Number(options.beats)||32,position:options.position||0,bpmA});
   if(composition.style!=='clean'||sync){
    effectSelection=selectMusicalFx({source:{...A,bpm:bpmA},target:{...B,bpm:bpmB},sync,trustworthy,harmonic,keyKnown:harmony.known,dense:dense>.45,intensity:clamp(Number(options.intensity??.45),0,1),history:options.history||[],stemsAvailable:options.stemsAvailable??Boolean(A.stemBuffer&&B.stemBuffer),tempoBlend:morph,beats:Number(options.beats)||32});
    composition={...composition,style:effectSelection.style,beats:effectSelection.beats,seconds:effectSelection.beats*60/bpmA,reason:effectSelection.reason,stages:effectSelection.stages,harmonicGuard:effectSelection.harmonicGuard};
   }
   style=composition.style;beats=composition.beats;reason=composition.reason;
  }
 }
 if(['stemfade','stemecho','stemsustain'].includes(style)&&!(options.stemsAvailable??Boolean(A.stemBuffer&&B.stemBuffer))){style='bass';reason='Stems indisponibles sur une platine : relais EQ. Préparez les deux titres et activez leurs stems avant la lecture.';}
 const bridge=['bridge','landing'].includes(style),separated=bridge||style==='clean',tempoBlend=Boolean(!separated&&sync&&morph&&Math.abs(ratio-1)>.001),nominal=beats*60/(tempoBlend?tempoMean(bpmA,bpmB,shape):bpmA),seconds=composition&&!tempoBlend?composition.seconds:bridge?clamp(nominal,7,12):automatic&&!sync?clamp(nominal,1.2,3):nominal;
 if(!automatic&&!reason)reason=sync&&!separated?(tempoBlend?'Tempo commun '+bpmA.toFixed(1)+' → '+bpmB.toFixed(1)+' BPM pendant le passage. ':'Tempo entrant calé à '+bpmA.toFixed(1)+' BPM. ')+(!trustworthy?'Grille estimée : vérifiez le premier temps.':'Mesures alignées.'):(options.sync===false?'Sync désactivée : tempos naturels.':separated?'Reprise au tempo naturel du prochain titre.':'Écart supérieur à la plage de synchronisation : tempos naturels.');
 const score=makeTransitionScore({style,seconds,beats,bpmA,bpmB,tempoBlend,tempoShape:shape,harmonicGuard:composition?.harmonicGuard},{intensity:options.intensity});
 const timing=style==='clean'?cleanTiming(seconds):{},inPoint=musicalEntry(B),sourceSpanSeconds=tempoBlend?beats*60/(A.bpm||120):seconds*(a.rate||1),outPoint=musicalExit(A,sourceSpanSeconds,options.position||0,score&&gridReliable(A)?{handoffFraction:score.handoffFraction}:timing);
 const ea=regionEnergy(A,true,outPoint,Math.min(4,seconds*(a.rate||1))),eb=regionEnergy(B,false,inPoint,Math.min(4,seconds));
 const gainA=(A.autoGain||1)*(a.volume??.85),gainB=(B.autoGain||1)*(b.volume??.85),trimDb=ea&&eb?clamp(20*Math.log10(ea*gainA/(eb*gainB)),-3,3):0;
 const referenceStages={lunarecho:[[0,'Installer le groove'],[.25,'Ouvrir l’écho orbital'],[.55,'Relayer les graves'],[.82,'Laisser les répétitions']],sweep:[[0,'Préparer le filtre'],[.25,'Balayer le spectre'],[.60,'Ouvrir le nouveau titre'],[.86,'Relâcher la réverbération']],hydrant:[[0,'Installer le jet'],[.30,'Faire monter la pression'],[.60,'Relayer les graves'],[.80,'Relâcher le souffle']],stemsustain:[[0,'Séparer les voix'],[.32,'Suspendre les instruments'],[.56,'Relayer le groove'],[.80,'Poser la nouvelle voix']]};
 const stages=referenceStages[style]?.map(([at,label])=>({at,label}))??composition?.stages;
 const timedStages=tempoBlend&&stages?stages.map(stage=>({...stage,at:tempoFraction(stage.at,bpmA,bpmB,seconds,shape)/seconds})):stages;
 const result={...(composition||{}),score,sourceSpanSeconds,sync:separated?false:sync,rate:sync&&!separated?ratio:1,beats,seconds,style,tempoBlend,tempoShape:shape,fallback:(!sync||separated)&&options.sync!==false,bpmA,bpmB,reason,energyA:ea,energyB:eb,profile,trustworthy,harmonic,keyKnown:harmony.known,keyRelation:harmony.relation,incomingQuantizeBeats:octave===1?undefined:4/octave,trimDb,automatic,effectSelection,inPoint,outPoint,preserveInPoint:Boolean(B.manualRegions||!sync&&(B.regionAnalysisVersion||gridReliable(B))),...timing,...(score?{handoffFraction:score.handoffFraction,handoffPosition:outPoint+sourceSpanSeconds*score.handoffFraction,incomingStartFraction:0,sourceStopFraction:1,quantizeHandoff:false,fadeSeconds:undefined}:{}),...(score?{stages:score.stages.map(stage=>({...stage,at:tempoBlend?tempoFraction(stage.at,bpmA,bpmB,seconds,shape)/seconds:stage.at}))}:timedStages?{stages:timedStages}:{})};
 result.baseInPoint=inPoint;
 result.baseReason=result.reason;
 result.incomingLanding=selectIncomingLanding(B,result,{enabled:options.alignArrival!==false&&!A.manualRegions});
 if(result.incomingLanding){result.inPoint=result.incomingLanding.cue;result.preserveInPoint=true;result.reason+=' Arrivée sur le repère '+result.incomingLanding.label+' au relais.';}
 return result;
}
export function transitionProgress(style,p,duration=8,score=null){
  if(score)return scoreProgress(score,p);
  p=clamp(p,0,1);
  if(style==='clean'){const timing=cleanTiming(duration);return clamp((p-timing.handoffFraction)*duration/timing.fadeSeconds,0,1);}
  if(style==='cut'){const width=Math.min(0.1,0.012/Math.max(0.05,duration));return clamp((p-0.8)/width,0,1);}
  if(style==='slam'||style==='stutter')return clamp((p-0.62)/0.2,0,1);
  const relays={echo:[.48,.84],dub:[.30,.88],lunarecho:[.35,.82],reverb:[.16,.86],space:[.28,.88],sweep:[.18,.86],hydrant:[.35,.80],stemsustain:[.28,.76],filter:[0,.80],lowpass:[.25,.92],riser:[.08,.78],downlift:[.15,.82]};
  if(relays[style]){const [begin,end]=relays[style],x=clamp((p-begin)/(end-begin),0,1);return x*x*(3-2*x);}
  return p;
}
export function faderCurves(from,to,style,duration,count=1024,score=null){
  const curves=[new Float32Array(count),new Float32Array(count)];
  if(style==='clean'){
   const {handoffFraction,fadeSeconds}=cleanTiming(duration),source=1-to,initial=source===0?Math.cos(from*Math.PI/2):Math.sin(from*Math.PI/2);
   for(let i=0;i<count;i++){
    const progress=clamp((i/(count-1)-handoffFraction)*duration/fadeSeconds,0,1);
    curves[source][i]=initial*Math.cos(progress*Math.PI/2);curves[to][i]=Math.sin(progress*Math.PI/2);
   }
   return curves;
  }
  if(['bridge','landing'].includes(style)){
   const smooth=p=>{p=clamp(p,0,1);return p*p*(3-2*p);},source=1-to;
   for(let i=0;i<count;i++){const p=i/(count-1);curves[source][i]=(source===0?Math.cos(from*Math.PI/2):Math.sin(from*Math.PI/2))*(1-smooth((p-.25)/.2));curves[to][i]=smooth((p-.5)/.16);}
   return curves;
  }
  for(let i=0;i<count;i++){const p=transitionProgress(style,i/(count-1),duration,score),x=from+(to-from)*p;curves[0][i]=style==='linear'?1-x:Math.cos(x*Math.PI/2);curves[1][i]=style==='linear'?x:Math.sin(x*Math.PI/2);}
  return curves;
}
export const textureNames={rise:'Whoosh ↑',fall:'Whoosh ↓',impact:'Impact',laser:'Laser',roll:'Snare roll',air:'Air swell'};
// Original deterministic synthesis, with short ramps at both ends to avoid clicks.
export function synthTexture(kind,sampleRate,duration=2,intensity=0.5){
  duration=clamp(duration,0.05,16);intensity=clamp(intensity,0,1);const data=new Float32Array(Math.ceil(sampleRate*duration));let seed=86131,low=0;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate,p=t/duration;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=0.08*(noise-low);let x;
    if(kind==='impact')x=(Math.sin(2*Math.PI*(48*t+1.5*(1-Math.exp(-25*t))))*Math.exp(-5*t)+noise*0.22*Math.exp(-12*t))*0.45;
    else if(kind==='laser')x=Math.sin(2*Math.PI*(140*t+120*(1-Math.exp(-7*t))))*Math.exp(-5*p)*0.28;
    else if(kind==='roll'){const hits=8+Math.floor(p*24),phase=(t*hits)%1;x=(noise-low)*Math.exp(-phase*18)*Math.min(1,p*3)*0.45;}
    else{x=(noise-low)*(kind==='fall'?(1-p)**1.8:kind==='air'?Math.sin(p*Math.PI)**2:p**1.1*Math.min(1,(1-p)/.18))*0.6;}
    data[i]=x*intensity*Math.min(1,t/0.008,(duration-t)/0.018);
  }
  return data;
}
