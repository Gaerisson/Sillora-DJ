import {tempoAt,tempoShapes} from './tempo-automation.mjs';
export function updateTempoControl(select,{enabled=true,active=false,shape=select.value}={}){
 select.disabled=!enabled;
 const label=select.closest('.tempo-profile');if(!label)return;
 label.classList.toggle('inactive',!enabled);label.classList.toggle('running',active);
 const signature=shape+':'+enabled+':'+active;if(label.dataset.profile===signature)return;label.dataset.profile=signature;
 const path=label.querySelector('path');path.setAttribute('d',Array.from({length:65},(_,i)=>(i?'L':'M')+(2+i*1.5).toFixed(2)+','+(26-24*tempoAt(i/64,0,1,1,shape)).toFixed(2)).join(' '));
 const hints={linear:'Variation régulière du tempo.',smooth:'Départ et arrivée progressifs.',early:'Le tempo rejoint plus tôt celui du prochain titre.',late:'Le tempo change surtout en fin de passage.'};
 label.title=(enabled?hints[select.value]:'Activez Sync BPM et Tempo progressif.')+(active?' Passage en cours : le choix sera appliqué au suivant.':'');
 path.setAttribute('aria-label',tempoShapes[shape]||tempoShapes.linear);
}
