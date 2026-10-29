import {readPhraseCues,phraseRevision,phraseGridReady,newPhraseId} from './phrase-cues.mjs';
export function mountPhraseEditor(root,{getTrack,position,isCurrent=()=>true,edit,seek,onError=()=>{}}){
 let revision='',trackId='',pending=false,disposed=false,optimistic=null;
 root.className='phrase-editor';root.innerHTML='<header><h3>PHRASES PRÉPARÉES</h3><span class="phrase-count"></span></header><fieldset><div class="phrase-toolbar"><input class="phrase-new-name" maxlength="40" placeholder="Nom du repère" aria-label="Nom du nouveau repère de phrase"><time class="phrase-position"></time><label><input class="phrase-snap" type="checkbox" checked>Sur la mesure</label><button data-phrase="add">+ Au curseur</button></div><div class="phrase-list"></div><p class="phrase-feedback" role="status">Auto musical · Entrée / Sortie : moment du relais.</p></fieldset>';
 const find=s=>root.querySelector(s),list=find('.phrase-list'),feedback=find('.phrase-feedback');
 const button=(name,action,id)=>{const b=document.createElement('button');b.textContent=name;b.dataset.phrase=action;b.dataset.id=id;return b;};
 function current(){let t=getTrack();if(optimistic){if(t?.id===optimistic.id&&phraseRevision(t)===optimistic.base)t={...t,phraseCues:optimistic.data};else optimistic=null;}return t;}
 function render(force=false){
  if(disposed)return;const t=current(),available=Boolean(t&&isCurrent());find('fieldset').disabled=pending||!available;find('.phrase-position').textContent=Number(position()||0).toFixed(3)+' s';find('.phrase-snap').disabled=!phraseGridReady(t);if(!available){if(trackId){trackId='';revision='';list.replaceChildren();find('.phrase-count').textContent='0/32';}return;}
  const cues=readPhraseCues(t),next=phraseRevision(t);if(!force&&next===revision&&trackId===t.id)return;revision=next;trackId=t.id;list.replaceChildren();find('.phrase-count').textContent=cues.points.length+'/32';
  for(const [index,p]of cues.points.entries()){
   const row=document.createElement('div');row.className='phrase-row';row.dataset.point=p.id;const code=document.createElement('b');code.textContent='P'+(index+1);
   const name=document.createElement('input');name.className='phrase-name';name.value=p.label;name.maxLength=40;name.dataset.id=p.id;name.setAttribute('aria-label','Nom de P'+(index+1));
   const time=document.createElement('input');time.className='phrase-time';time.type='number';time.step='.001';time.min='0';time.value=String(p.time);time.dataset.id=p.id;time.setAttribute('aria-label','Position de P'+(index+1)+' en secondes');
   const actions=document.createElement('div');actions.className='phrase-actions';actions.append(button('Aller','seek',p.id));for(const role of ['entry','exit']){const b=button(role==='entry'?'Entrée':'Sortie',role,p.id);b.setAttribute('aria-pressed',String(cues[role+'Id']===p.id));actions.append(b);}const remove=button('×','remove',p.id);remove.setAttribute('aria-label','Supprimer P'+(index+1));actions.append(remove);row.append(code,name,time,actions);list.append(row);
  }
  if(!cues.points.length){const empty=document.createElement('p');empty.className='phrase-empty';empty.textContent='Placez le curseur au début d’une phrase.';list.append(empty);}
 }
 async function perform(op){
  if(pending||disposed||!isCurrent())return;const expected={trackId,expectedRevision:revision},base=phraseRevision(getTrack());pending=true;render();
  try{const result=await edit(op,expected);if(result?.phraseCues)optimistic={id:expected.trackId,base,data:result.phraseCues};if(op.type==='add')find('.phrase-new-name').value='';feedback.textContent='Repère enregistré · prochain passage.';render(true);}catch(error){optimistic=null;feedback.textContent=error.message;onError(error);render(true);}finally{pending=false;render();}
 }
 root.onclick=event=>{const b=event.target.closest('button[data-phrase]');if(!b||pending||!isCurrent())return;const t=current(),cues=readPhraseCues(t),p=cues.points.find(p=>p.id===b.dataset.id),action=b.dataset.phrase;
  if(action==='seek'){if(p)Promise.resolve(seek(p.time)).catch(error=>{feedback.textContent=error.message;onError(error);});return;}
  if(action==='add'){perform({type:'add',id:newPhraseId(),time:position(),label:find('.phrase-new-name').value,snap:!find('.phrase-snap').disabled&&find('.phrase-snap').checked});return;}
  if(action==='entry'||action==='exit'){perform({type:'assign',role:action,id:cues[action+'Id']===b.dataset.id?null:b.dataset.id});return;}
  if(action==='remove')perform({type:'remove',id:b.dataset.id});
 };
 root.onchange=event=>{const input=event.target;if(input.matches('.phrase-name'))perform({type:'update',id:input.dataset.id,label:input.value});if(input.matches('.phrase-time')){if(!input.value.trim()){feedback.textContent='Indiquez une position en secondes.';render(true);return;}perform({type:'update',id:input.dataset.id,time:Number(input.value)});}};
 render();const timer=setInterval(()=>render(),150);return ()=>{disposed=true;clearInterval(timer);root.onclick=null;root.onchange=null;root.replaceChildren();};
}
