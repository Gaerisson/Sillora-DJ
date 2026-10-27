const size=value=>value>0?(value/1024/1024).toFixed(1)+' Mo':'',time=value=>Number.isFinite(value)&&value>0?Math.ceil(value/60)+' min':'';
const active=new Set(['queued','inspecting','downloading','finalizing']);
export class DownloadPanel{
 constructor(root,{onImport,onLoad,onQueue,onOpenFolder}={}){
  Object.assign(this,{root,onImport,onLoad,onQueue,onOpenFolder,jobs:new Map(),imported:new Set(),pollTimer:null,openState:false});
  root.classList.add('download-panel');root.innerHTML='<div class="download-heading"><div><span class="eyebrow">VOTRE MUSIQUE, SUR VOTRE PC</span><h2>YouTube et SoundCloud</h2><p>Collez un lien public pour enregistrer son audio dans votre dossier Musique.</p></div><span class="download-engine">yt-dlp intégré</span></div><div class="download-layout"><form class="download-form"><label for="youtube-download-url">LIEN YOUTUBE OU SOUNDCLOUD</label><div class="download-input-row"><input id="youtube-download-url" class="download-url" type="url" inputmode="url" maxlength="2048" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" required><button class="button import download-start" type="submit">Télécharger l’audio</button></div><p class="download-format">M4A / Opus · un titre à la fois · 30 minutes maximum</p></form><div class="download-destination"><span>DOSSIER DE DESTINATION</span><strong>Musique / Gaerisson DJ Studio</strong><button type="button" class="button download-folder">Ouvrir le dossier</button></div></div><p class="download-status" role="status">Le moteur et son environnement JavaScript sont inclus dans l’application Windows.</p><p class="download-soundcloud-info">SoundCloud : liens publics sans compte. Go+ : connexion partenaire non configurée.</p><div class="download-jobs" aria-live="polite"></div>';
  root.querySelector('form').onsubmit=event=>{event.preventDefault();this.start();};root.querySelector('.download-folder').onclick=()=>this.openFolder();
  const api=window.sillageDesktop;if(api?.onDownloadProgress)this.unsubscribe=api.onDownloadProgress(job=>this.receive(job));this.render();
 }
 status(message){this.root.querySelector('.download-status').textContent=message;}
 async open(){
  this.openState=true;const api=window.sillageDesktop;
  if(!api?.downloadInfo||!api.startDownload){this.root.querySelectorAll('input,button').forEach(control=>control.disabled=true);this.status('Le téléchargement YouTube / SoundCloud est disponible dans l’application Windows complète.');return;}
  try{const info=await api.downloadInfo();this.info=info;this.root.querySelector('.download-destination strong').textContent=info.folder||'Musique / Gaerisson DJ Studio';this.root.querySelector('.download-destination strong').title=info.path||'';this.root.querySelector('.download-start').disabled=!info.available;this.root.querySelector('.download-url').disabled=!info.available;if(!info.available)this.status('Le moteur de téléchargement inclus est indisponible. Réinstallez la version Windows complète.');else this.status('Prêt à télécharger. Le titre sera conservé sur votre ordinateur.');await this.refresh();}catch(error){this.status(error.message||'Le dossier de téléchargement est indisponible.');}
 }
 close(){this.openState=false;clearTimeout(this.pollTimer);this.pollTimer=null;}
 dispose(){this.close();this.unsubscribe?.();}
 async start(){
  const input=this.root.querySelector('.download-url'),url=input.value.trim();if(!url)return;this.root.querySelector('.download-start').disabled=true;this.status('Préparation du téléchargement…');
  try{const job=await window.sillageDesktop.startDownload({url});this.receive(job);input.value='';this.status(job.message||'Le téléchargement démarre.');this.schedule();}catch(error){this.status(error.message||'Ce lien ne peut pas être téléchargé.');}finally{this.controls();}
 }
 controls(){const busy=[...this.jobs.values()].some(job=>active.has(job.status));this.root.querySelector('.download-start').disabled=busy||!this.info?.available;}
 receive(job){
  if(!job||typeof job.id!=='string'||typeof job.status!=='string')return;this.jobs.set(job.id,job);this.render();this.controls();
  if(job.status==='completed'&&job.descriptor&&!this.imported.has(job.id)){this.imported.add(job.id);Promise.resolve(this.onImport?.(job.descriptor,job)).catch(error=>this.status(error.message||'Le titre est enregistré. Actualisez la bibliothèque pour le retrouver.'));}
  if(['completed','error','cancelled'].includes(job.status))this.status(job.message||'Téléchargement terminé.');this.schedule();
 }
 async refresh(){if(!window.sillageDesktop?.listDownloads)return;try{const response=await window.sillageDesktop.listDownloads();for(const job of Array.isArray(response)?response:response.jobs||[])this.receive(job);}catch(error){this.status(error.message||'Impossible de lire les téléchargements.');}this.schedule();}
 schedule(){clearTimeout(this.pollTimer);if(this.openState&&[...this.jobs.values()].some(job=>active.has(job.status)))this.pollTimer=setTimeout(()=>this.refresh(),1000);}
 async cancel(job){try{this.receive(await window.sillageDesktop.cancelDownload(job.id));}catch(error){this.status(error.message||'Impossible d’annuler ce téléchargement.');}}
 async openFolder(){try{if(this.onOpenFolder)await this.onOpenFolder();else if(window.sillageDesktop?.openDownloadFolder)await window.sillageDesktop.openDownloadFolder();else this.status('Les titres sont enregistrés dans '+(this.info?.folder||'votre dossier Musique')+'.');}catch(error){this.status(error.message||'Impossible d’ouvrir le dossier Musique.');}}
 render(){
  const list=this.root.querySelector('.download-jobs');list.replaceChildren();const jobs=[...this.jobs.values()].reverse();
  if(!jobs.length){const empty=document.createElement('div');empty.className='download-empty';const icon=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('p');icon.textContent='↓';title.textContent='Vos titres seront disponibles ici';description.textContent='Le téléchargement s’ajoute à la bibliothèque et reste accessible depuis les dossiers Windows.';empty.append(icon,title,description);list.append(empty);return;}
  for(const job of jobs){const row=document.createElement('article');row.className='download-job download-job-'+job.status;const icon=document.createElement('div');icon.className='download-job-icon';icon.textContent=job.status==='completed'?'✓':job.status==='error'?'!':job.status==='cancelled'?'×':'↓';const body=document.createElement('div');body.className='download-job-body';const title=document.createElement('strong'),message=document.createElement('p');title.textContent=job.title||'Vidéo YouTube';message.textContent=job.message||'';body.append(title,message);
   if(active.has(job.status)){const progress=document.createElement('progress');progress.max=1;if(job.progress>0)progress.value=job.progress;progress.setAttribute('aria-label','Progression de '+(job.title||'la vidéo'));body.append(progress);const details=document.createElement('small');details.textContent=[job.progress>0?Math.round(job.progress*100)+' %':'',size(job.bytes),job.speed>0?size(job.speed)+'/s':'',time(job.eta)].filter(Boolean).join(' · ');body.append(details);}
   const actions=document.createElement('div');actions.className='download-job-actions';
   if(active.has(job.status)){const cancel=document.createElement('button');cancel.className='button';cancel.textContent='Annuler';cancel.onclick=()=>this.cancel(job);actions.append(cancel);}
   if(job.status==='completed'&&job.descriptor){if(this.onLoad)for(const deck of [0,1]){const load=document.createElement('button');load.className='button';load.textContent=deck?'B':'A';load.setAttribute('aria-label','Charger '+job.title+' sur '+load.textContent);load.onclick=async()=>{try{await this.onLoad(job.descriptor,deck);}catch(error){this.status(error.message||'Impossible de charger ce titre.');}};actions.append(load);}if(this.onQueue){const queue=document.createElement('button');queue.className='button';queue.textContent='＋ File';queue.onclick=()=>Promise.resolve(this.onQueue(job.descriptor)).catch(error=>this.status(error.message));actions.append(queue);}}
   row.append(icon,body,actions);list.append(row);
  }
 }
}
