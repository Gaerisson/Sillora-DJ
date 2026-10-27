const stylesheet='/audio-settings.css';
export {LiveSettings} from './live-settings.js';
const displayDb=value=>Math.max(-100,Number.isFinite(value)?value:-100).toFixed(1)+' dB';
export class AudioSettings{
 constructor(io,container){
  this.io=io;this.container=container;
  if(!document.querySelector('link[data-sillage-audio-settings]')){const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.sillageAudioSettings='';document.head.append(link);}
  container.classList.add('audio-settings');
  container.innerHTML=`<section class="audio-card"><div class="audio-card-heading"><h3>Sortie du studio</h3><button type="button" data-refresh>Actualiser</button></div><label>Haut-parleurs ou casque<select data-output aria-label="Sortie audio du studio"></select></label><p data-output-status class="audio-help"></p><p class="audio-help">Le choix agit sur les platines, les effets et le micro diffusé. Windows peut limiter la liste des sorties avant l’autorisation d’une entrée audio.</p></section>
   <section class="audio-card"><div class="audio-card-heading"><h3>Micro / entrée ligne</h3><button type="button" data-input-toggle>Activer l’entrée</button></div><div class="audio-fields"><label>Type<select data-option="mode"><option value="mic">Micro · parole</option><option value="line">Entrée ligne · musique</option></select></label><label>Périphérique d’entrée<select data-input aria-label="Entrée micro ou ligne"></select></label></div><p data-input-status class="audio-help"></p><div class="audio-meter-row"><meter data-input-meter min="-60" max="0" low="-36" high="-6" optimum="-18" value="-60" aria-label="Niveau de l’entrée audio"></meter><output data-input-level>−∞ dB</output></div><label class="audio-slider">Gain d’entrée<input data-option="gainDb" type="range" min="-24" max="24" step="1"><output data-value="gainDb"></output></label><label class="audio-checkbox"><input data-option="compress" type="checkbox"> Compression douce pour stabiliser le niveau</label><p class="audio-help">Micro : coupe-bas 80 Hz. Entrée ligne : spectre complet, sans traitement automatique Windows.</p><label class="audio-checkbox audio-monitor"><input data-option="monitor" type="checkbox"> Diffuser le micro dans le master et REC</label><div class="audio-talk-row"><button type="button" data-talk>Ouvrir le micro</button><span data-talk-status>Micro coupé</span></div><p class="audio-help">L’entrée est désactivée au démarrage. Vous pouvez vérifier son niveau sans la diffuser. Pour parler dans le mix, activez la diffusion puis ouvrez le micro. Éloignez le micro des enceintes ou utilisez un casque.</p></section>
   <section class="audio-card"><h3>La musique laisse la place à la voix</h3><label class="audio-checkbox"><input data-option="duckEnabled" type="checkbox"> Baisser automatiquement la musique pendant la voix diffusée</label><div class="audio-duck-live"><span data-duck-status>Musique à son niveau normal</span><meter data-duck-meter min="0" max="30" value="0" aria-label="Réduction du niveau musical"></meter></div><div class="audio-fields"><label class="audio-slider">Seuil de détection<input data-option="thresholdDb" type="range" min="-70" max="-6" step="1"><output data-value="thresholdDb"></output></label><label class="audio-slider">Réduction musicale<input data-option="depthDb" type="range" min="0" max="30" step="1"><output data-value="depthDb"></output></label></div><details><summary>Réactivité de la voix</summary><div class="audio-fields audio-timings"><label>Attaque (ms)<input data-option="attackMs" type="number" min="5" max="500" step="5"></label><label>Maintien (ms)<input data-option="holdMs" type="number" min="0" max="2000" step="25"></label><label>Retour musique (ms)<input data-option="releaseMs" type="number" min="50" max="3000" step="25"></label></div></details><p class="audio-help">Seule la musique baisse : votre voix garde son niveau. Aucun ducking quand le micro est coupé ou sa diffusion désactivée.</p></section><p data-error class="audio-error" role="alert" hidden></p><p data-notice class="audio-help" role="status"></p>`;
  this.find=selector=>container.querySelector(selector);
  this.onChange=()=>this.render();this.onMeter=()=>this.renderMeters();io.addEventListener('change',this.onChange);io.addEventListener('meter',this.onMeter);
  this.find('[data-refresh]').onclick=()=>this.perform(()=>io.refreshDevices());
  this.find('[data-output]').onchange=event=>this.perform(()=>io.selectOutput(event.target.value));
  this.find('[data-input]').onchange=event=>io.setOptions({inputDeviceId:event.target.value});
  this.find('[data-input-toggle]').onclick=()=>{if(io.armed||io.starting)io.stopInput();else this.perform(()=>io.startInput());};
  this.find('[data-talk]').onclick=()=>io.setTalk(!io.talking);
  for(const input of container.querySelectorAll('[data-option]'))input.addEventListener('input',()=>io.setOptions({[input.dataset.option]:input.type==='checkbox'?input.checked:input.type==='range'||input.type==='number'?Number(input.value):input.value}));
  this.render();
 }
 async perform(action){try{return await action();}catch(error){if(!this.io.error)this.io.fail(error);this.render();}}
 async open(){await this.perform(async()=>{await this.io.engine.init();await this.io.refreshDevices();await this.io.restoreOutput();});this.render();return this.io.state;}
 fillDevices(select,kind,selected){
  const devices=this.io.devices.filter(device=>device.kind===kind),options=[{deviceId:'',label:kind==='audioinput'?'Entrée par défaut de Windows':'Sortie par défaut de Windows'},...devices.filter(device=>device.deviceId&&device.deviceId!=='default')];
  if(selected&&!options.some(device=>device.deviceId===selected))options.push({deviceId:selected,label:'Périphérique mémorisé · indisponible'});
  const signature=JSON.stringify(options);if(select.dataset.signature!==signature){select.replaceChildren(...options.map((device,index)=>{const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||(kind==='audioinput'?'Entrée audio ':'Sortie audio ')+index;return option;}));select.dataset.signature=signature;}
  select.value=selected;
 }
 render(){
  const state=this.io.state,o=state.options;
  this.fillDevices(this.find('[data-output]'),'audiooutput',state.actualOutputId);
  this.fillDevices(this.find('[data-input]'),'audioinput',o.inputDeviceId);
  this.find('[data-output]').disabled=!state.outputSupported;
  const output=state.devices.find(device=>device.kind==='audiooutput'&&device.deviceId===state.actualOutputId);
  this.find('[data-output-status]').textContent=!this.io.engine.context?'Sortie activée à la première lecture.':state.outputSupported?'Sortie actuelle : '+(output?.label||'Windows par défaut'):'Cette version utilise la sortie par défaut de Windows.';
  this.find('[data-input-toggle]').textContent=state.starting?'Annuler l’activation':state.armed?'Arrêter l’entrée':'Activer l’entrée';
  this.find('[data-input-toggle]').classList.toggle('active',state.armed);
  this.find('[data-input-status]').textContent=state.starting?'En attente d’autorisation…':state.armed?'Capture active · niveau disponible':'Aucune capture micro en cours.';
  for(const input of this.container.querySelectorAll('[data-option]')){const value=o[input.dataset.option];if(input.type==='checkbox')input.checked=value;else if(document.activeElement!==input)input.value=value;}
  for(const output of this.container.querySelectorAll('[data-value]'))output.textContent=(output.dataset.value==='gainDb'&&o.gainDb>0?'+':'')+o[output.dataset.value]+' dB';
  this.find('[data-talk]').disabled=!state.armed;this.find('[data-talk]').textContent=state.talking?'Couper le micro':'Ouvrir le micro';
  this.find('[data-talk]').classList.toggle('active',state.talking);
  this.find('[data-talk-status]').textContent=!state.talking?'Micro coupé':o.monitor?'Voix dans le master et REC':'Micro ouvert · diffusion désactivée';
  this.find('[data-error]').hidden=!state.error;this.find('[data-error]').textContent=state.error;
  this.find('[data-notice]').textContent=state.notice;
  this.renderMeters();
 }
 renderMeters(){const state=this.io.state;this.find('[data-input-meter]').value=Math.max(-60,state.levelDb);this.find('[data-input-level]').textContent=state.levelDb<=-99?'−∞ dB':displayDb(state.levelDb);this.find('[data-duck-meter]').value=state.reductionDb;this.find('[data-duck-status]').textContent=state.reductionDb>.2?'Musique −'+state.reductionDb.toFixed(1)+' dB · '+(state.voicing?'voix détectée':'retour progressif'):'Musique à son niveau normal';}
 dispose(){this.io.removeEventListener('change',this.onChange);this.io.removeEventListener('meter',this.onMeter);}
}
