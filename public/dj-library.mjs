// Harmonic notation describes an estimate, never a guarantee of a compatible arrangement.
const majorWheel=[8,3,10,5,12,7,2,9,4,11,6,1];
const minorWheel=[5,12,7,2,9,4,11,6,1,8,3,10];
const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const identity=track=>typeof track==='object'&&track!==null?track.id:track;
const ids=values=>new Set((values||[]).map(identity));

export const selectionModes={compatible:'Titres compatibles',shuffle:'Aléatoire sans répétition',order:'Ordre du dossier'};

export function camelotKey(track){
 const confidence=track?.keyConfidence;
 if(!finite(confidence)||confidence<=.35)return null;
 const root=track.keyRoot,mode=track.keyMode;
 if(!Number.isInteger(root)||root<0||root>11||!['major','minor'].includes(mode))return null;
 const number=(mode==='minor'?minorWheel:majorWheel)[root],letter=mode==='minor'?'A':'B';
 return {number,letter,label:number+letter,key:names[root]+(mode==='minor'?'m':''),confidence};
}

export function keyLabel(track){const key=camelotKey(track);return key?key.key+' · '+key.label:'Clé incertaine';}

export function harmonicCompatibility(a,b){
 const source=camelotKey(a),target=camelotKey(b);
 if(!source||!target)return {known:false,compatible:false,score:.38,relation:'Tonalité incertaine',source,target};
 const distance=Math.min(Math.abs(source.number-target.number),12-Math.abs(source.number-target.number));
 const sameMode=source.letter===target.letter;
 const same=distance===0&&sameMode,relative=distance===0&&!sameMode,neighbor=distance===1&&sameMode;
 return {known:true,compatible:same||relative||neighbor,score:same?1:relative?.94:neighbor?.86:Math.max(.04,.3-distance*.045-(sameMode?0:.06)),relation:same?'Même tonalité':relative?'Tonalité relative':neighbor?'Voisine harmonique':'Tonalités éloignées',distance,source,target};
}

function gridReliable(track){return track?.confidence==='manual'||track?.confidence==='generated'||(track?.tempoConfidence>=.65&&track?.beatStability>=.65);}

export function tempoCompatibility(a,b,{maxStretch=.055}={}){
 const source=a?.bpm,target=b?.bpm;
 if(!finite(source)||!finite(target)||source<=0||target<=0)return {known:false,compatible:false,score:.25,ratio:1,octave:1,difference:null,reliable:false,relation:'Tempo inconnu'};
 // An 80 BPM grid and a 160 BPM grid may describe the same pulse. Report it explicitly.
 const candidates=[1,.5,2].map(octave=>({octave,ratio:source/(target*octave)}));
 candidates.sort((x,y)=>Math.abs(Math.log2(x.ratio))-Math.abs(Math.log2(y.ratio)));
 const best=candidates[0],difference=Math.abs(best.ratio-1),compatible=difference<=maxStretch;
 const reliable=gridReliable(a)&&gridReliable(b);
 return {known:true,compatible,score:Math.exp(-Math.abs(Math.log2(best.ratio))*6),ratio:best.ratio,octave:best.octave,difference,reliable,relation:(best.octave===1?'Tempo ':'Pulsation ×'+best.octave+' · ')+(difference*100).toFixed(1)+' %'+(reliable?'':' · grille estimée')};
}

export function trackEnergy(track){
 if(finite(track?.energy))return clamp(track.energy,0,1);
 if(finite(track?.rms))return clamp(track.rms/.25,0,1);
 const envelope=track?.envelope||track?.analysis?.envelope;
 if(!envelope?.length)return null;
 let sum=0,count=0;for(const value of envelope)if(finite(value)){sum+=value*value;count++;}
 return count?clamp(Math.sqrt(sum/count)/.25,0,1):null;
}

function eligibleTracks(current,tracks,{played=[],exclude=[],allowRepeat=false}={}){
 const blocked=ids(exclude);if(current)blocked.add(identity(current));if(!allowRepeat)for(const id of ids(played))blocked.add(id);
 const seen=new Set();return tracks.filter(track=>{const id=identity(track);if(!track||id===undefined||blocked.has(id)||seen.has(id))return false;seen.add(id);return true;});
}

export function rankCandidates(current,tracks,options={}){
 const recent=ids(options.recent),energy=trackEnergy(current),desired=options.energyDirection==='lift'?.12:options.energyDirection==='chill'?-.12:0;
 return eligibleTracks(current,tracks,options).map((track,index)=>{
  const tempo=tempoCompatibility(current,track),harmonic=harmonicCompatibility(current,track),candidateEnergy=trackEnergy(track);
  const energyDelta=energy===null||candidateEnergy===null?null:candidateEnergy-energy;
  const energyScore=energyDelta===null?.5:Math.max(0,1-Math.abs(energyDelta-desired)*2.5);
  const score=tempo.score*.5+harmonic.score*.35+energyScore*.15-(recent.has(identity(track))?.5:0);
  const reason=[tempo.relation,harmonic.relation,energyDelta===null?'Énergie non mesurée':Math.abs(energyDelta)<.12?'Énergie proche':energyDelta>0?'Énergie en hausse':'Énergie plus douce'].join(' · ');
  return {track,score,reason,tempo,harmonic,energyDelta,index};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
}

export function selectNextTrack(current,tracks,options={}){
 const mode=options.mode||'compatible',candidates=eligibleTracks(current,tracks,options);
 if(!candidates.length)return null;
 if(mode==='order')return candidates[0];
 if(mode==='shuffle'){
  const recent=ids(options.recent),fresh=candidates.filter(track=>!recent.has(identity(track))),pool=fresh.length?fresh:candidates;
  const sample=(options.random||Math.random)(),value=finite(sample)?clamp(sample,0,1-Number.EPSILON):0;
  return pool[Math.floor(value*pool.length)];
 }
 return rankCandidates(current,candidates,options)[0]?.track||null;
}

export function sortTracks(tracks,sort='title',direction=1){
 const order=direction<0?-1:1;
 const name=(a,b)=>String(a.title||a.name||'').localeCompare(String(b.title||b.name||''),'fr',{numeric:true,sensitivity:'base'});
 return [...tracks].sort((a,b)=>{
  if(sort==='key'){
   const ka=camelotKey(a),kb=camelotKey(b);
   // Unknown estimates always stay at the end, also when reversing the wheel.
   if(!ka||!kb)return ka?-1:kb?1:name(a,b)*order;
   return (ka.number-kb.number||ka.letter.localeCompare(kb.letter)||name(a,b))*order;
  }
  if(sort==='bpm'||sort==='energy'||sort==='duration'){
   const read=track=>sort==='bpm'?track.bpm:sort==='energy'?trackEnergy(track):(track.buffer?.duration??track.duration);
   const va=read(a),vb=read(b);if(!finite(va)||!finite(vb))return finite(va)?-1:finite(vb)?1:name(a,b)*order;
   return (va-vb||name(a,b))*order;
  }
  return name(a,b)*order;
 });
}
