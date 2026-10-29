const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_.:-]{1,64}$/.test(id);
export const newPhraseId=()=>globalThis.crypto?.randomUUID?.()??'phrase-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);
const label=value=>typeof value==='string'&&!/(?:[A-Za-z]:[\\/]|file:\/\/)/.test(value)?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,40):'';
export const phraseDuration=track=>track?.buffer?.duration??track?.duration??0;
export const phraseGridReady=t=>t?.confidence==='manual'||t?.confidence==='generated'||t?.tempoConfidence>=.65&&t?.beatStability>=.65||['manual','known','auto'].includes(t?.grid?.mode)&&t.grid.confidence>=.65;
export function readPhraseCues(track){
 const raw=track?.phraseCues,duration=phraseDuration(track),points=[],seen=new Set();
 if(raw?.version===1&&Array.isArray(raw.points))for(const p of raw.points.slice(0,32)){if(!validId(p?.id)||seen.has(p.id)||!Number.isFinite(p.time)||p.time<0||p.time>=duration-.02)continue;seen.add(p.id);points.push({id:p.id,time:p.time,label:label(p.label)||'Phrase'});}
 points.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));return {version:1,points,entryId:seen.has(raw?.entryId)?raw.entryId:null,exitId:seen.has(raw?.exitId)?raw.exitId:null};
}
export function phraseRevision(track){
 const text=JSON.stringify([phraseDuration(track),readPhraseCues(track)]);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function phraseTime(track,time,snap=false){
 const duration=phraseDuration(track);if(!Number.isFinite(time)||time<0||time>=duration-.02)throw Error('Repère hors du morceau.');
 if(snap){if(!phraseGridReady(track)||!(track.bpm>0))throw Error('Corrigez la grille avant de caler une phrase.');const bar=240/track.bpm,offset=track.downbeat??track.beatOffset??0;time=offset+Math.round((time-offset)/bar)*bar;if(time<0||time>=duration-.02)throw Error('La mesure la plus proche est hors du morceau.');}return time;
}
export function phraseOnBar(track,time){if(!phraseGridReady(track)||!(track.bpm>0))return false;const bar=240/track.bpm,phase=(time-(track.downbeat??track.beatOffset??0))/bar;return Math.abs(phase-Math.round(phase))<1e-5;}
export function editPhraseCues(track,op,expectedRevision){
 if(expectedRevision!==undefined&&expectedRevision!==phraseRevision(track))throw Error('Les phrases ont changé. Rechargez leurs repères.');
 const next=readPhraseCues(track),point=next.points.find(p=>p.id===op?.id);
 if(op?.type==='add'){
  if(next.points.length>=32)throw Error('Maximum de 32 repères par morceau.');if(!validId(op.id)||point)throw Error('Identifiant de repère invalide.');
  const time=phraseTime(track,op.time,op.snap===true);if(next.points.some(p=>Math.abs(p.time-time)<.02))throw Error('Un repère existe déjà à cet endroit.');next.points.push({id:op.id,time,label:label(op.label)||'Phrase '+(next.points.length+1)});
 }else if(op?.type==='assign'){
  if(!['entry','exit'].includes(op.role)||op.id!==null&&!point)throw Error('Rôle de phrase invalide.');next[op.role+'Id']=op.id;
 }else if(op?.type==='update'){
  if(!point)throw Error('Repère indisponible.');if(op.time!==undefined){const time=phraseTime(track,op.time,op.snap===true);if(next.points.some(p=>p!==point&&Math.abs(p.time-time)<.02))throw Error('Un repère existe déjà à cet endroit.');point.time=time;}if(op.label!==undefined){if(!label(op.label))throw Error('Nommez ce repère.');point.label=label(op.label);}
 }else if(op?.type==='remove'){
  if(!point)throw Error('Repère indisponible.');next.points=next.points.filter(p=>p.id!==op.id);if(next.entryId===op.id)next.entryId=null;if(next.exitId===op.id)next.exitId=null;
 }else throw Error('Commande de phrase invalide.');
 next.points.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));return next;
}
export function phraseAnchor(track,role,{enabled=true,quantize=true}={}){
 if(!enabled||track.manualRegions)return null;const cues=readPhraseCues(track),index=cues.points.findIndex(p=>p.id===cues[role+'Id']);if(index<0)return null;
 const point=cues.points[index];if(quantize&&!phraseOnBar(track,point.time))return null;
 return {...point,index,label:'P'+(index+1),name:point.label,origin:'manual',confidence:1,kind:'phrase'};
}
