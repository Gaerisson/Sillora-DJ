const duration=value=>value>0?Math.floor(value/60)+':'+Math.floor(value%60).toString().padStart(2,'0'):'Durée à l’import';
function licenseLabel(value){if(!value)return 'Licence sur la source';try{const url=new URL(value);if(url.hostname==='creativecommons.org')return url.pathname.includes('/publicdomain/')?'Domaine public / CC0':'CC '+url.pathname.split('/')[2].toUpperCase();}catch{}return value;}
export class SourcesPanel{
 constructor(root,{onLoad,onQueue}={}){
  Object.assign(this,{root,onLoad,onQueue,items:[],busy:false});
  root.classList.add('sources-panel');root.innerHTML='<div class="sources-heading"><div><span class="eyebrow">DÉCOUVRIR ET MIXER</span><h2>Musique en ligne</h2><p>Chargez un véritable fichier audio dans les platines, puis utilisez vos effets et transitions.</p></div></div><form class="sources-form"><label>CATALOGUE<select class="sources-provider"><option value="audius">Audius · musique indépendante</option><option value="archive">Internet Archive · audio Creative Commons</option></select></label><label class="sources-query-label">TITRE, ARTISTE OU STYLE<input class="sources-query" type="search" value="house" maxlength="100" placeholder="House, ambient, un artiste…"></label><button class="button import sources-search" type="submit">Rechercher</button></form><p class="sources-status" role="status">Choisissez un catalogue et lancez une recherche. Sans compte à connecter.</p><div class="sources-results"></div>';
  root.querySelector('form').onsubmit=event=>{event.preventDefault();this.search();};
 }
 async open(){if(!window.sillageDesktop?.searchSources){this.root.querySelector('.sources-search').disabled=true;this.status('Les catalogues audio nécessitent l’application Windows Sillage 0.13.');}}
 status(message){this.root.querySelector('.sources-status').textContent=message;}
 controls(busy){this.busy=busy;this.root.querySelectorAll('button,input,select').forEach(control=>control.disabled=busy);}
 async search(){
  if(this.busy)return;const provider=this.root.querySelector('.sources-provider').value,query=this.root.querySelector('.sources-query').value.trim();if(!query)return this.status('Saisissez un titre, un artiste ou un style.');
  this.controls(true);this.status('Recherche dans '+(provider==='audius'?'Audius':'Internet Archive')+'…');
  try{const response=await window.sillageDesktop.searchSources(provider,query);this.items=response.items||[];this.render();this.status(this.items.length?this.items.length+' titre'+(this.items.length>1?'s disponibles':' disponible')+' · A / B pour charger, ＋ pour ajouter à la file.':'Aucun fichier audio compatible pour cette recherche. Essayez un autre terme ou catalogue.');}
  catch(error){this.items=[];this.render();this.status(error.message||'Ce catalogue est indisponible pour le moment. Essayez l’autre catalogue.');}
  finally{this.controls(false);}
 }
 render(){
  const list=this.root.querySelector('.sources-results');list.replaceChildren();
  for(const item of this.items){const row=document.createElement('article');row.className='source-result';const cover=document.createElement('div');cover.className='source-cover';cover.textContent=item.provider==='audius'?'AU':'IA';const info=document.createElement('div');info.className='source-info';const title=document.createElement('h3'),artist=document.createElement('p'),meta=document.createElement('small');title.textContent=item.title;artist.textContent=item.artist;meta.textContent=duration(item.duration)+' · '+licenseLabel(item.license);info.append(title,artist,meta);const actions=document.createElement('div');actions.className='source-actions';
   for(const deck of [0,1]){const button=document.createElement('button');button.className='button';button.textContent=deck?'B':'A';button.setAttribute('aria-label','Charger '+item.title+' sur '+button.textContent);button.onclick=()=>this.import(item,deck,false);actions.append(button);}
   if(this.onQueue){const queue=document.createElement('button');queue.className='button';queue.textContent='＋';queue.setAttribute('aria-label','Ajouter '+item.title+' à la file');queue.onclick=()=>this.import(item,null,true);actions.append(queue);}
   const credit=document.createElement('button');credit.className='source-credit';credit.textContent='Copier le lien source';credit.onclick=async()=>{try{await navigator.clipboard.writeText(item.link);this.status('Lien source copié.');}catch{this.status(item.link);}};info.append(credit);row.append(cover,info,actions);list.append(row);
  }
 }
 async import(item,deck,queue){
  if(this.busy)return;this.controls(true);this.status('Chargement de « '+item.title+' » et préparation audio…');
  try{if(queue)await this.onQueue(item);else await this.onLoad(item,deck);this.status('« '+item.title+' » '+(queue?'ajouté à la file.':'chargé sur '+(deck?'B':'A')+'.'));}
  catch(error){this.status(error.message||'Ce titre ne peut pas être lu. Essayez un autre résultat.');}
  finally{this.controls(false);}
 }
}
