const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function rangeFraction(input){const min=Number.isFinite(Number(input.min))?Number(input.min):0,max=input.max!==''&&Number.isFinite(Number(input.max))?Number(input.max):1,value=clamp(Number(input.value),min,max);if(min<0&&max>0)return value<0?.5*(1-value/min):.5+.5*value/max;return clamp((value-min)/Math.max(.000001,max-min),0,1);}
export function quantizedRangeValue(value,min,max,step=1){const v=clamp(value,min,max);return Number(clamp(min+Math.round((v-min)/(step||1))*(step||1),min,max).toFixed(6));}
export function enhanceKnobs(root=document){
 const cleanups=[];
 // Existing native inputs remain the only accessible sliders and event targets.
 for(const input of root.querySelectorAll('.eq-area input[type=range], [data-knob], .live-knob input[type=range]')){
  if(input.dataset.knobEnhanced)continue;input.dataset.knobEnhanced='true';
  const reused=input.parentElement.matches('.knob-wrap'),wrapper=reused?input.parentElement:document.createElement('span');wrapper.classList.add('dj-knob');if(!reused){input.before(wrapper);wrapper.append(input);}
  const originalCap=reused?wrapper.querySelector('.knob'):null,cap=originalCap||document.createElement('span');cap.classList.add('dj-knob-cap');cap.setAttribute('aria-hidden','true');if(!originalCap)wrapper.prepend(cap);
  let drag=null;const initial=Number(input.defaultValue||input.value),min=Number(input.min)||0,max=Number(input.max)||1,step=input.step==='any'?(max-min)/200:Number(input.step)||1;
  const sync=()=>{const fraction=rangeFraction(input);wrapper.style.setProperty('--knob-angle',`${-135+fraction*270}deg`);wrapper.style.setProperty('--knob-sweep',`${fraction*270}deg`);wrapper.classList.toggle('disabled',input.disabled);};
  const set=value=>{if(input.disabled)return;input.value=String(quantizedRangeValue(value,min,max,step));input.dispatchEvent(new Event('input',{bubbles:true}));sync();};
  const down=event=>{if(event.button!==0||input.disabled)return;event.preventDefault();input.focus();input.setPointerCapture(event.pointerId);drag={id:event.pointerId,y:event.clientY,value:Number(input.value)};wrapper.classList.add('dragging');};
  const move=event=>{if(!drag||event.pointerId!==drag.id)return;set(drag.value+(drag.y-event.clientY)*(max-min)/(event.shiftKey?800:160));};
  const up=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;wrapper.classList.remove('dragging');input.dispatchEvent(new Event('change',{bubbles:true}));};
  const wheel=event=>{if(document.activeElement!==input||input.disabled)return;event.preventDefault();set(Number(input.value)+(event.deltaY<0?step:-step)*(event.shiftKey?1:2));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const reset=event=>{event.preventDefault();set(initial);input.dispatchEvent(new Event('change',{bubbles:true}));};
  input.addEventListener('input',sync);input.addEventListener('change',sync);input.addEventListener('pointerdown',down);input.addEventListener('pointermove',move);input.addEventListener('pointerup',up);input.addEventListener('pointercancel',up);input.addEventListener('wheel',wheel,{passive:false});input.addEventListener('dblclick',reset);
  sync();cleanups.push(()=>{for(const [event,handler] of [['input',sync],['change',sync],['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['wheel',wheel],['dblclick',reset]])input.removeEventListener(event,handler);if(reused){wrapper.classList.remove('dj-knob');cap.classList.remove('dj-knob-cap');}else wrapper.replaceWith(input);delete input.dataset.knobEnhanced;});
 }
 return {refresh(){root.querySelectorAll('.dj-knob input').forEach(input=>{input.parentElement.style.setProperty('--knob-angle',`${-135+rangeFraction(input)*270}deg`);});},destroy(){cleanups.forEach(clean=>clean());}};
}
