import {keyLockProfiles} from './keylock-profiles.mjs';

export class KeyLockSettings{
 constructor(root,{get,set,onError=()=>{}}){
  this.root=root;this.get=get;this.set=set;this.onError=onError;this.pending=false;
  root.classList.add('keylock-settings');root.innerHTML='<label>MAINTIEN DE HAUTEUR<select aria-label="Profil du maintien de hauteur">'+keyLockProfiles.map(p=>'<option value="'+p.id+'">'+p.label+'</option>').join('')+'</select></label><output aria-live="polite" title="Latence mesurée du traitement, compensée par le moteur.">—</output>';
  this.select=root.querySelector('select');this.output=root.querySelector('output');this.select.onchange=async()=>{this.pending=true;this.update();try{await this.set(this.select.value);}catch(error){this.onError(error);}finally{this.pending=false;this.update();}};
  const href=new URL('./keylock-settings.css',import.meta.url).href;if(![...document.querySelectorAll('link[rel=stylesheet]')].some(link=>link.href===href)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
  this.update();
 }
 update(){const state=this.get()||{};if(!this.pending)this.select.value=state.profile||'standard';this.select.disabled=this.pending||Boolean(state.busy);this.select.title=state.busy?'Arrêtez les platines pour changer de profil.':'';this.output.textContent=this.pending||state.changing?'Calibration…':state.enabled===false?'Désactivé':state.available&&Number.isFinite(state.latencyMs)?Math.round(state.latencyMs)+' ms':'—';}
}
