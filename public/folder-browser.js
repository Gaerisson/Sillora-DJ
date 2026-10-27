const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class FolderBrowser{
 constructor(root,{onImport,onError,onScopeChanged,onAutomix}){
  Object.assign(this,{root,onImport,onError,onScopeChanged,onAutomix,roots:[],current:null,sequence:0});
  root.innerHTML='<div class="folder-toolbar"><select class="folder-roots" aria-label="Dossiers de musique"></select><button class="folder-add">＋ Ajouter un dossier</button><button class="folder-import">Importer les titres affichés</button><select class="folder-mode" aria-label="Choix du prochain titre pour Automix"><option value="compatible">Titres compatibles</option><option value="shuffle">Aléatoire sans répétition</option><option value="order">Ordre du dossier</option></select><button class="folder-automix">▶ Démarrer Automix ici</button></div><nav class="folder-crumbs" aria-label="Chemin du dossier"></nav><div class="folder-path"></div><input class="folder-filter" type="search" aria-label="Rechercher dans ce dossier" placeholder="Filtrer les fichiers de ce dossier…"><p class="folder-status" role="status"></p><div class="folder-items"></div>';
  root.querySelector('.folder-roots').onchange=event=>this.navigate(event.target.value).catch(error=>onError(error.message));
  root.querySelector('.folder-filter').oninput=()=>this.render();
  root.querySelector('.folder-add').onclick=async()=>{try{this.roots=await window.sillageDesktop.chooseFolder();this.renderRoots();if(this.roots.length)await this.navigate(this.roots.at(-1).token);}catch(error){onError(error.message);}};
  root.querySelector('.folder-import').onclick=()=>this.import(this.visible(),null,false);
  root.querySelector('.folder-automix').onclick=()=>this.startAutomix();
 }
 get scope(){return this.current?{id:this.current.token,path:this.current.path,name:this.current.crumbs.at(-1)?.name||this.current.path,files:[...this.current.files]}:null;}
 get files(){return this.scope?.files||[];}
 get mode(){return this.root.querySelector('.folder-mode').value;}
 async open(){
  if(!window.sillageDesktop?.folderRoots){this.root.querySelector('.folder-status').textContent='La navigation dans les dossiers est disponible dans la nouvelle application Windows.';return;}
  if(this.current)return;
  this.roots=await window.sillageDesktop.folderRoots();this.renderRoots();if(this.roots.length)await this.navigate(this.roots[0].token);
 }
 renderRoots(){const select=this.root.querySelector('.folder-roots');select.innerHTML=this.roots.map(root=>'<option value="'+escape(root.token)+'">'+escape(root.name)+'</option>').join('');}
 async navigate(token){
  const sequence=++this.sequence;this.root.querySelector('.folder-status').textContent='Lecture du dossier…';
  const current=await window.sillageDesktop.folderList(token);if(sequence!==this.sequence)return;
  this.current=current;this.root.querySelector('.folder-filter').value='';this.root.querySelector('.folder-path').textContent=current.path;
  const root=this.roots.find(r=>r.token===current.crumbs[0]?.token);if(root)this.root.querySelector('.folder-roots').value=root.token;
  this.root.querySelector('.folder-crumbs').innerHTML=current.crumbs.map(crumb=>'<button data-folder="'+escape(crumb.token)+'">'+escape(crumb.name)+'</button>').join('<span>›</span>');
  this.bindDirectories();this.render();
  if(this.onScopeChanged)await this.onScopeChanged(this.scope);
 }
 visible(){const query=this.root.querySelector('.folder-filter').value.toLocaleLowerCase('fr');return (this.current?.files||[]).filter(file=>file.name.toLocaleLowerCase('fr').includes(query));}
 bindDirectories(){this.root.querySelectorAll('[data-folder]').forEach(button=>button.onclick=()=>this.navigate(button.dataset.folder).catch(error=>this.onError(error.message)));}
 render(){
  if(!this.current)return;const files=this.visible(),list=this.root.querySelector('.folder-items');
  list.innerHTML=this.current.directories.map(directory=>'<button class="folder-directory" data-folder="'+escape(directory.token)+'"><span aria-hidden="true">▱</span><span class="folder-directory-name">'+escape(directory.name)+'</span><b aria-hidden="true">›</b></button>').join('')+files.map((file,index)=>'<div class="folder-file"><span class="folder-note" aria-hidden="true">♪</span><div class="folder-filename" title="'+escape(file.name)+'">'+escape(file.name)+'<small>'+(file.size/1048576).toFixed(1)+' Mo</small></div><div class="folder-file-actions"><button data-file="'+index+'" data-target="0" aria-label="Charger '+escape(file.name)+' sur A">A</button><button data-file="'+index+'" data-target="1" aria-label="Charger '+escape(file.name)+' sur B">B</button><button data-file="'+index+'" data-target="queue" aria-label="Ajouter '+escape(file.name)+' à la file">＋</button></div></div>').join('');
  if(!files.length&&!this.current.directories.length)list.textContent='Aucun fichier audio dans ce dossier.';
  this.root.querySelector('.folder-status').textContent=files.length+' fichier'+(files.length>1?'s':'')+' audio · '+this.current.directories.length+' sous-dossier'+(this.current.truncated?' · affichage limité à 2 000 entrées':'');
  this.root.querySelector('.folder-import').disabled=!files.length;
  const automix=this.root.querySelector('.folder-automix');automix.disabled=this.busy||!this.onAutomix||!this.current.files.length;automix.textContent='▶ Démarrer Automix ici · '+this.current.files.length+' titre'+(this.current.files.length>1?'s':'');automix.title='Utilise tous les titres de ce dossier, sans les sous-dossiers. Le filtre ne modifie pas cette sélection.';
  this.bindDirectories();list.querySelectorAll('[data-file]').forEach(button=>button.onclick=()=>this.import([files[Number(button.dataset.file)]],button.dataset.target==='queue'?null:Number(button.dataset.target),button.dataset.target==='queue'));
 }
 async import(entries,target,queue){
  if(this.busy||!entries.length)return;const scope=this.scope;this.setBusy(true,'Analyse et chargement des fichiers…');
  try{return await this.onImport(entries,target,queue,scope);}catch(error){this.onError(error.message);}finally{this.setBusy(false);}
 }
 setBusy(value,status){this.busy=value;this.root.querySelectorAll('button,select').forEach(control=>control.disabled=value);if(status)this.root.querySelector('.folder-status').textContent=status;else this.render();}
 async startAutomix(){
  const scope=this.scope;if(this.busy||!this.onAutomix||!scope?.files.length)return;
  const mode=this.mode;this.setBusy(true,'Analyse du dossier et préparation du premier passage…');
  try{await this.onAutomix(scope.files,scope,mode);}catch(error){this.onError(error.message);}finally{this.setBusy(false);}
 }
}
