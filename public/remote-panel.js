import qrcode from './vendor/qrcode/qrcode.mjs';
export class RemotePanel{
 constructor(root){
  this.root=root;this.state={active:false,links:[]};
  root.innerHTML='<p>Retrouvez le studio complet sur PC, tablette ou téléphone : platines, mixer, dossiers, file, effets et audio. Connectez-vous au même réseau local ; le son reste sur ce PC.</p><div class="remote-panel-actions"><button class="button import remote-enable">Activer la télécommande</button><button class="button remote-disable" hidden>Arrêter et révoquer le lien</button></div><div class="remote-pairing" hidden><label>ADRESSE DU PC<select class="remote-address" aria-label="Adresse réseau du studio"></select></label><canvas class="remote-qr" width="280" height="280" aria-label="QR code d’appairage à scanner"></canvas><label>LIEN D’APPAIRAGE<input class="remote-link" type="text" readonly spellcheck="false" aria-label="Lien d’appairage du téléphone"></label><button class="button remote-copy">Copier le lien</button><p>Scannez le QR code avec le téléphone, ou ouvrez ce lien sur un autre ordinateur. Il donne accès au studio. Gardez-le privé ; Arrêter le rend inutilisable.</p></div><p class="remote-panel-status" role="status">Télécommande arrêtée.</p>';
  root.querySelector('.remote-enable').onclick=()=>this.change(true);root.querySelector('.remote-disable').onclick=()=>this.change(false);
  root.querySelector('.remote-address').onchange=()=>this.updateLink();
  root.querySelector('.remote-copy').onclick=async()=>{const input=root.querySelector('.remote-link');try{await navigator.clipboard.writeText(input.value);this.message('Lien copié. Ouvrez-le sur le téléphone connecté au même Wi-Fi.');}catch{input.focus();input.select();this.message('Lien sélectionné : utilisez Ctrl + C pour le copier.');}};
 }
 message(value){this.root.querySelector('.remote-panel-status').textContent=value;}
 async open(){
  if(!window.sillageDesktop?.remoteStatus){this.message('La télécommande nécessite l’application Windows Sillage 0.12.');this.root.querySelector('.remote-enable').disabled=true;return;}
  try{this.state=await window.sillageDesktop.remoteStatus();this.render();}catch(error){this.message(error.message);}
 }
 async change(enabled){
  this.root.querySelectorAll('button').forEach(button=>button.disabled=true);this.message(enabled?'Ouverture de la télécommande…':'Révocation du lien…');
  try{this.state=await window.sillageDesktop[enabled?'remoteStart':'remoteStop']();this.render();}catch(error){this.message(error.message);}finally{this.root.querySelectorAll('button').forEach(button=>button.disabled=false);}
 }
 render(){
  const active=this.state.active===true;this.root.querySelector('.remote-enable').hidden=active;this.root.querySelector('.remote-disable').hidden=!active;this.root.querySelector('.remote-pairing').hidden=!active;
  const select=this.root.querySelector('.remote-address');select.replaceChildren();
  const links=[...(this.state.links||[])].sort((a,b)=>Number(a.origin.includes('127.0.0.1'))-Number(b.origin.includes('127.0.0.1')));this.links=links;
  links.forEach((link,index)=>{const option=document.createElement('option');option.value=index;option.textContent=link.name+' · '+link.origin;select.append(option);});this.updateLink();
  this.message(active?links.some(link=>!link.origin.includes('127.0.0.1'))?'Studio Web actif sur le réseau local. Les titres restent sur ce PC ; les enregistrements terminés sont téléchargeables à la demande.':'Télécommande active, mais aucune adresse Wi-Fi/Ethernet locale n’est détectée. Connectez le PC au réseau puis réactivez-la.':'Télécommande arrêtée. Les anciens liens sont révoqués.');
 }
 updateLink(){const value=this.links?.[Number(this.root.querySelector('.remote-address').value)]?.url||'';this.root.querySelector('.remote-link').value=value;const canvas=this.root.querySelector('.remote-qr'),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);if(!value)return;const qr=qrcode(0,'M');qr.addData(value);qr.make();const count=qr.getModuleCount(),size=Math.floor(canvas.width/(count+8)),offset=Math.floor((canvas.width-count*size)/2);ctx.fillStyle='#10151c';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))ctx.fillRect(offset+x*size,offset+y*size,size,size);}
}
