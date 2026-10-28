export function waveSettings(value={}){return{mode:value?.mode==='scratch'?'scratch':'seek',sensitivity:[.5,1,1.5,2].includes(value?.sensitivity)?value.sensitivity:1};}
export function mountWaveControls(root,{key,label,onChange=()=>{}}){
 let settings;try{settings=waveSettings(JSON.parse(localStorage.getItem(key)||'{}'));}catch{settings=waveSettings();}
 const controls=document.createElement('div');controls.className='wave-gesture-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Geste sur l’onde '+label);
 controls.innerHTML='<div class="wave-mode-switch"><button type="button" data-wave-mode="seek">Déplacer</button><button type="button" data-wave-mode="scratch">Scratch</button></div><label class="wave-sensitivity"><span class="sr-only">Sensibilité de l’onde '+label+'</span><select aria-label="Sensibilité de l’onde '+label+'"><option value="0.5">½×</option><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label>';
 const render=()=>{for(const b of controls.querySelectorAll('[data-wave-mode]'))b.setAttribute('aria-pressed',String(b.dataset.waveMode===settings.mode));controls.querySelector('select').value=String(settings.sensitivity);controls.querySelector('.wave-sensitivity').hidden=settings.mode!=='scratch';onChange({...settings});};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(settings));}catch{}render();};
 for(const b of controls.querySelectorAll('[data-wave-mode]'))b.onclick=()=>{settings.mode=b.dataset.waveMode;save();};controls.querySelector('select').onchange=e=>{settings=waveSettings({...settings,sensitivity:Number(e.target.value)});save();};root.append(controls);render();
 return {get settings(){return {...settings};},element:controls};
}
