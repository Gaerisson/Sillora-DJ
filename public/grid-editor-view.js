import {readGrid,retimeGrid,shiftGrid,calibrateGrid,automaticGrid,gridRevision} from './grid-editor.mjs';
import {drawDJWaveform} from './dj-waveform.mjs';
import {bindWaveSeek} from './wave-seek.mjs';
import {gridStatus,gridLabel} from './grid-status.mjs';

const stamp=value=>value.toFixed(3)+' s';
export function mountGridEditor(root,{track,overview,position,playing,isCurrent,seek,toggle,apply,colors=()=>({}),onError=()=>{}}){
 let revision=gridRevision(track),draft,automatic=false,dirty=false,disposed=false,raf,range=[0,1],center=position(),follow=true,zoom=16,start=null,end=null;
 try{draft=readGrid(track);}catch{draft={bpm:120,downbeat:0,beatOffset:0};}
 const duration=track.buffer.duration;
 root.className='grid-editor';root.setAttribute('aria-label','Préparation de la grille');
 root.innerHTML=`<header><h3>GRILLE RYTHMIQUE</h3><span class="grid-state"></span></header>
 <fieldset><div class="grid-fields"><label>BPM du fichier<input class="grid-bpm" type="number" min="40" max="240" step="0.01" inputmode="decimal"></label><label>Premier temps · secondes<input class="grid-anchor-time" type="number" min="0" max="${duration}" step="0.001" inputmode="decimal"></label><button data-grid="anchor">1er temps au curseur</button></div>
 <div class="grid-wave-tools"><button data-grid="play">Lecture</button><time class="grid-position"></time><label>Zoom<select class="grid-zoom"><option value="4">1 mesure</option><option value="16" selected>4 mesures</option><option value="64">16 mesures</option></select></label><button data-grid="previous" aria-label="Fenêtre précédente">←</button><button data-grid="next" aria-label="Fenêtre suivante">→</button><label class="grid-follow"><input type="checkbox" checked>Suivre</label></div>
 <canvas class="grid-detail" height="170" aria-label="Onde détaillée : cliquer ou glisser pour déplacer la lecture"></canvas>
 <div class="grid-overview"></div>
 <div class="grid-adjust"><span>Décalage</span><select class="grid-step" aria-label="Précision du décalage"><option value="0.001">1 ms</option><option value="0.005" selected>5 ms</option><option value="0.02">20 ms</option></select><button data-grid="earlier" aria-label="Avancer la grille">−</button><button data-grid="later" aria-label="Retarder la grille">+</button><span>Mesure</span><button data-grid="bar-back" title="Décaler le premier temps d’un temps vers la gauche">−1 temps</button><button data-grid="bar-next" title="Décaler le premier temps d’un temps vers la droite">+1 temps</button></div>
 <details class="grid-calibration"><summary>Calibrer entre deux impacts</summary><div><button data-grid="start">Début au curseur</button><output class="grid-start">—</output><button data-grid="end">Fin au curseur</button><output class="grid-end">—</output><label>Distance en temps<input class="grid-beats" type="number" min="1" max="4096" step="1" value="32"></label><button data-grid="calibrate">Calculer le BPM</button></div></details>
 <footer><p class="grid-feedback" role="status">Les corrections restent en aperçu jusqu’à leur application.</p><div><button data-grid="restore">Analyse d’origine</button><button data-grid="reload">Recharger</button><button data-grid="apply" class="grid-primary" disabled>Appliquer</button></div></footer></fieldset>`;
 const find=s=>root.querySelector(s),bpm=find('.grid-bpm'),anchor=find('.grid-anchor-time'),detail=find('.grid-detail'),feedback=find('.grid-feedback');
 overview.classList.add('grid-overview-wave');overview.setAttribute('aria-label','Vue globale : cliquer pour naviguer dans le morceau');find('.grid-overview').append(overview);
 const refreshFields=()=>{bpm.value=String(Math.round(draft.bpm*1e6)/1e6);anchor.value=String(Math.round(draft.downbeat*1e6)/1e6);find('[data-grid=apply]').disabled=!dirty;find('.grid-state').textContent=dirty?(automatic?'Aperçu automatique':'Brouillon manuel'):gridLabel(gridStatus(track));};
 const ensure=()=>{if(disposed||!isCurrent())throw Error('La piste a changé. Rouvrez sa préparation.');if(gridRevision(track)!==revision)throw Error('La grille a changé. Cliquez sur Recharger.');};
 const edit=next=>{draft=next;dirty=true;automatic=false;feedback.textContent='Aperçu · le son et la grille enregistrée restent inchangés.';refreshFields();};
 const act=async action=>{try{ensure();await action();}catch(error){if(disposed)return;refreshFields();feedback.textContent=error.message;onError(error);}};
 bpm.onchange=()=>act(()=>edit(retimeGrid(draft,Number(bpm.value),position(),duration)));
 anchor.onchange=()=>act(()=>{const value=Number(anchor.value);if(!anchor.value||value<0||value>duration)throw Error('Premier temps hors du morceau.');edit({...draft,downbeat:value,beatOffset:value});});
 find('.grid-zoom').onchange=event=>{zoom=Number(event.target.value);center=position();};
 find('.grid-follow input').onchange=event=>{follow=event.target.checked;};
 const handlers={
  anchor:()=>{const at=position();edit({...draft,downbeat:at,beatOffset:at});},
  play:()=>toggle(),previous:()=>pan(-1),next:()=>pan(1),
  earlier:()=>edit(shiftGrid(draft,-Number(find('.grid-step').value),duration)),later:()=>edit(shiftGrid(draft,Number(find('.grid-step').value),duration)),
  'bar-back':()=>edit(shiftGrid(draft,-60/draft.bpm,duration)),'bar-next':()=>edit(shiftGrid(draft,60/draft.bpm,duration)),
  start:()=>{start=position();find('.grid-start').textContent=stamp(start);},end:()=>{end=position();find('.grid-end').textContent=stamp(end);},
  calibrate:()=>{if(start===null||end===null)throw Error('Placez les deux repères sur les impacts à comparer.');edit(calibrateGrid(start,end,Number(find('.grid-beats').value),duration));},
  restore:()=>{draft=automaticGrid(track);automatic=true;dirty=true;feedback.textContent='Aperçu de l’analyse d’origine · à appliquer pour retirer la correction manuelle.';refreshFields();},
  apply:async()=>{await apply(draft,{automatic,expectedRevision:revision});},
 };
 function pan(direction){follow=false;find('.grid-follow input').checked=false;center=Math.max(0,Math.min(duration,center+direction*zoom*60/draft.bpm*.75));}
 root.onclick=event=>{const button=event.target.closest('button[data-grid]');if(!button||button.disabled)return;if(button.dataset.grid==='reload'){if(!isCurrent())return onError(Error('La piste a changé.'));revision=gridRevision(track);draft=readGrid(track);automatic=false;dirty=false;feedback.textContent='Grille enregistrée rechargée.';refreshFields();return;}act(()=>handlers[button.dataset.grid]?.());};
 const seekTo=async at=>{try{ensure();const target=Math.max(0,Math.min(duration-.001,at));await seek(target);center=target;}catch(error){if(!disposed){feedback.textContent=error.message;onError(error);}}};
 const releaseDetail=bindWaveSeek(detail,{getRange:()=>range,getDuration:()=>duration,isCurrent:()=>!disposed&&isCurrent(),seek:seekTo,onError});
 const releaseOverview=bindWaveSeek(overview,{getRange:()=>[0,duration],getDuration:()=>duration,isCurrent:()=>!disposed&&isCurrent(),seek:seekTo,onError});
 const preview={...track};
 function draw(){
  if(disposed)return;
  if(!isCurrent()){find('fieldset').disabled=true;feedback.textContent='La piste a changé. Rouvrez sa préparation.';return;}
  const pos=position();if(follow)center=pos;
  const span=zoom*60/draft.bpm,from=center-span*.35;range=[from,from+span];
  Object.assign(preview,track,draft,{arrangement:dirty?null:track.arrangement});const palette=colors();
  for(const [canvas,startAt,endAt]of [[detail,...range],[overview,0,duration]]){const width=Math.max(1,canvas.getBoundingClientRect().width),height=canvas===detail?170:64,pixels=Math.round(width*devicePixelRatio),rows=Math.round(height*devicePixelRatio);if(canvas.width!==pixels)canvas.width=pixels;if(canvas.height!==rows)canvas.height=rows;const ctx=canvas.getContext('2d');ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);drawDJWaveform(ctx,{track:preview,position:pos,from:startAt,to:endAt,width,height,colors:palette});if(canvas===detail){const beat=60/draft.bpm;for(let i=Math.ceil((startAt-draft.downbeat)/beat);draft.downbeat+i*beat<=endAt;i++){const x=(draft.downbeat+i*beat-startAt)/(endAt-startAt)*width,number=((i%4)+4)%4+1;ctx.fillStyle=number===1?palette.a:palette.text;ctx.globalAlpha=number===1?.55:.17;ctx.fillRect(Math.round(x),18,1,height-18);ctx.globalAlpha=1;ctx.font='10px Consolas,monospace';ctx.fillText(String(number),x+3,12);}}}
  find('.grid-position').textContent=stamp(pos);find('[data-grid=play]').textContent=playing()?'Pause':'Lecture';
  if(gridRevision(track)!==revision){feedback.textContent='La grille a changé. Cliquez sur Recharger.';find('[data-grid=apply]').disabled=true;}
  raf=requestAnimationFrame(draw);
 }
 refreshFields();raf=requestAnimationFrame(draw);
 return ()=>{disposed=true;cancelAnimationFrame(raf);releaseDetail();releaseOverview();root.onclick=null;};
}
