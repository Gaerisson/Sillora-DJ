import {programDefaults,programOptions} from './program-bus.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(value,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
export class ProgramSettings{
 constructor(root,{get,set,panic,meter=()=>null,onError=()=>{}}){this.root=root;this.get=get;this.set=set;this.meter=meter;this.onError=onError;
  const range=(key,label,min,max,step,unit,scope='master')=>`<label class="program-control"><span>${label}</span><input type="range" data-program="${key}" aria-label="${label} ${scope}" min="${min}" max="${max}" step="${step}"><output data-value="${key}" data-unit="${escape(unit)}"></output></label>`;
  root.innerHTML=`<div class="program-heading"><h3>PROGRAM / MASTER</h3><button data-panic class="program-panic">PANIC</button></div>
   <div class="program-controls">${range('highpass','Coupe-bas',20,160,1,'Hz')}${range('low','Graves',-12,12,.5,'dB')}${range('mid','Présence',-12,12,.5,'dB')}${range('high','Aigus',-12,12,.5,'dB')}${range('balance','Balance',-1,1,.01,'')}${range('ceilingDb','Plafond',-12,-.1,.1,'dB')}${range('dimDb','Atténuation DIM',6,36,1,'dB')}</div>
   <section class="program-pumping" aria-label="Sidechain musique">
    <div class="program-pump-heading"><div><h4>SIDECHAIN <span>PUMPING</span></h4><small data-pump-status>Prêt</small></div><button data-flag="pumpEnabled" class="program-pump-toggle" aria-label="Activer le sidechain sur la musique" aria-pressed="false">Activer</button></div>
    <div class="program-pump-main">${range('pumpDepth','Dosage',0,6,.1,'dB','sidechain')}${range('pumpRelease','Relâchement',60,450,5,'ms','sidechain')}</div>
    <div class="program-pump-display"><span class="program-pump-kick" data-pump-kick data-active="false" role="img" aria-label="Kick non détecté">KICK</span><div class="program-pump-reduction"><div class="program-pump-meter-track" aria-hidden="true"><span data-pump-fill></span></div><meter data-pump-meter min="0" max="6" low="1" high="4" optimum="0" value="0" aria-label="Réduction sidechain en décibels"></meter><div><span>RÉDUCTION</span><output data-pump-reduction>0.0 dB</output></div></div></div>
    <details class="program-pump-advanced"><summary>Détection du kick</summary><div class="program-pump-main">${range('pumpThreshold','Seuil',-48,-12,1,'dB','sidechain')}${range('pumpCrossover','Graves préservés',80,220,5,'Hz','sidechain')}</div></details>
   </section>
   <div class="program-buttons"><button data-flag="mono">MONO</button><button data-flag="dim">DIM</button><button data-flag="muted">MUTE</button><button data-reset>Réinitialiser</button></div>`;
  root.querySelectorAll('[data-program]').forEach(input=>{input.addEventListener('input',()=>this.change({[input.dataset.program]:Number(input.value)}));input.addEventListener('dblclick',()=>this.change({[input.dataset.program]:programDefaults[input.dataset.program]}));});
  root.querySelectorAll('[data-flag]').forEach(button=>button.onclick=()=>this.change({[button.dataset.flag]:!this.get()?.[button.dataset.flag]}));root.querySelector('[data-reset]').onclick=()=>this.change({...programDefaults});root.querySelector('[data-panic]').onclick=()=>Promise.resolve(panic?.()).catch(onError);this.update();
 }
 async change(patch){try{await this.set(patch);this.update();}catch(error){this.onError(error);}}
 update(){
  const o=programOptions(this.get()),state=this.meter?.(),unavailable=state?.available===false;
  this.root.querySelectorAll('[data-program]').forEach(input=>{
   const key=input.dataset.program,value=o[key];if(document.activeElement!==input)input.value=value;if(key.startsWith('pump'))input.disabled=unavailable;
   const out=this.root.querySelector(`[data-value="${key}"]`);out.textContent=key==='balance'?value===0?'C':(value<0?'L ':'R ')+Math.round(Math.abs(value)*100):value.toFixed(['low','mid','high','ceilingDb','pumpDepth'].includes(key)?1:0)+' '+out.dataset.unit;
  });
  this.root.querySelectorAll('[data-flag]').forEach(button=>button.setAttribute('aria-pressed',String(o[button.dataset.flag])));
  const toggle=this.root.querySelector('[data-flag="pumpEnabled"]');toggle.textContent=o.pumpEnabled?'Activé':'Activer';toggle.disabled=unavailable&&!o.pumpEnabled;toggle.setAttribute('aria-label',o.pumpEnabled?'Désactiver le sidechain sur la musique':'Activer le sidechain sur la musique');
  const pumping=this.root.querySelector('.program-pumping');pumping.classList.toggle('is-enabled',o.pumpEnabled&&!unavailable);pumping.classList.toggle('is-unavailable',unavailable);
  const reduction=o.pumpEnabled&&!unavailable?bounded(state?.reductionDb,0,6):0,kick=o.pumpEnabled&&!unavailable&&state?.kick===true;
  this.root.querySelector('[data-pump-meter]').value=reduction;this.root.querySelector('[data-pump-fill]').style.width=(reduction/6*100)+'%';this.root.querySelector('[data-pump-reduction]').textContent=(reduction>.04?'− ':'')+reduction.toFixed(1)+' dB';
  const indicator=this.root.querySelector('[data-pump-kick]');indicator.dataset.active=String(kick);indicator.setAttribute('aria-label',kick?'Kick détecté':'Kick non détecté');
  this.root.querySelector('[data-pump-status]').textContent=unavailable?'Indisponible':o.pumpEnabled?state?.available===true?'Musique · actif':'À la lecture':'Musique · désactivé';
 }
}
