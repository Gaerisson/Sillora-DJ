import {mixRegionPatch} from './studio-tools.mjs';

const names={lift:'Énergie +',release:'Énergie −',change:'Texture'};
const stamp=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')+'.'+String(Math.floor(s%1*10));
export function renderArrangement(root,track,{seek,setRegion,onError=()=>{}}){
 const points=track.arrangement?.landmarks||[];
 root.className='arrangement-view';root.setAttribute('aria-label','Repères d’arrangement');
 root.innerHTML='<header><h3>STRUCTURE</h3><span>'+points.length+' repère'+(points.length>1?'s':'')+'</span></header>'+(points.length?'<div class="arrangement-list">'+points.map((p,i)=>'<div class="arrangement-row"><b>R'+(i+1)+'</b><time>'+stamp(p.time)+'</time><span>'+names[p.kind]+'</span><small title="Confiance du changement mesuré">'+Math.round(p.confidence*100)+' %</small><div class="arrangement-actions"><button data-action="seek" data-index="'+i+'" aria-label="Aller au repère '+(i+1)+'">Aller</button><button data-action="in" data-index="'+i+'" aria-label="Placer IN au repère '+(i+1)+'">IN</button><button data-action="out" data-index="'+i+'" aria-label="Placer OUT au repère '+(i+1)+'">OUT</button></div></div>').join('')+'</div>':'<p>Aucun changement durable assez fiable.</p>');
 for(const button of root.querySelectorAll('button[data-action]'))if(button.dataset.action!=='seek')try{mixRegionPatch(track,button.dataset.action,points[Number(button.dataset.index)].time);}catch{button.disabled=true;}
 root.onclick=async event=>{const button=event.target.closest('button[data-action]');if(!button||button.disabled||!root.contains(button))return;const point=points[Number(button.dataset.index)];if(!point)return;button.disabled=true;try{if(button.dataset.action==='seek')await seek(point.time);else await setRegion(button.dataset.action,point.time);}catch(error){onError(error);}finally{if(button.isConnected)button.disabled=false;}};
 const href=new URL('./arrangement-view.css',import.meta.url).href;if(![...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href===href)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
}
