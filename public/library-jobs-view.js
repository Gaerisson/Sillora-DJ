export class LibraryJobsView{
 constructor(root,{pause,cancel,resume,reanalyzePause,page}={}){
  root.classList.add('library-work');root.innerHTML='<div class="library-work-status"><strong>Bibliothèque</strong><span></span></div><div class="library-work-actions"><button data-job="pause">Pause import</button><button data-job="cancel">Annuler</button><button data-job="resume">Reprendre les restants</button><button data-job="analysis">Pause analyses</button><output></output></div><div class="library-pages"><button data-page="-1" aria-label="Page précédente">‹</button><span></span><button data-page="1" aria-label="Page suivante">›</button></div>';
  this.root=root;this.find=s=>root.querySelector(s);this.find('[data-job=pause]').onclick=pause;this.find('[data-job=cancel]').onclick=cancel;this.find('[data-job=resume]').onclick=resume;this.find('[data-job=analysis]').onclick=reanalyzePause;root.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>page(Number(button.dataset.page)));
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./library-work.css',import.meta.url).href;document.head.append(link);
 }
 update({batch,active,analysis,records,bytes,page=0,total=0,size=100,restored=false}){
  const cancelling=batch?.state==='cancelled'&&active?.batch===batch,remaining=batch?batch.keys.length-batch.completed.length:0;
  this.find('strong').textContent=cancelling?'Annulation · décodage en cours':batch?.state==='running'?'Import '+batch.completed.length+' / '+batch.keys.length:batch?.state==='paused'?'Import en pause':batch?.state==='cancelled'?'Import annulé':records+' titres';
  this.find('.library-work-status span').textContent=(analysis.backgroundPaused?'Analyses de fond en pause':analysis.performanceBusy?'Analyses de fond suspendues pendant le passage':analysis.active?'Analyse en cours':'Analyses disponibles')+(analysis.waiting?' · '+analysis.waiting+' en attente':'');
  const pause=this.find('[data-job=pause]');pause.hidden=!batch||!['running','paused'].includes(batch.state);pause.textContent=batch?.state==='paused'?'Reprendre import':'Pause import';
  this.find('[data-job=cancel]').hidden=!batch||!['running','paused'].includes(batch.state);this.find('[data-job=resume]').hidden=cancelling||(!restored&&!(batch&&!['running','paused'].includes(batch.state)&&remaining>0));
  this.find('[data-job=analysis]').textContent=analysis.backgroundPaused?'Reprendre analyses':'Pause analyses';this.find('output').textContent=Math.round((bytes||0)/1048576)+' Mio PCM';this.find('output').title='Budget souple de 384 Mio pour les fichiers originaux. Les platines chargées sont conservées.';
  const pages=this.find('.library-pages');pages.hidden=total<=size;this.find('.library-pages span').textContent=(total?page*size+1:0)+'–'+Math.min(total,(page+1)*size)+' / '+total;this.find('[data-page="-1"]').disabled=page===0;this.find('[data-page="1"]').disabled=(page+1)*size>=total;
 }
}
