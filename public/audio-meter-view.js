import {emptyMeterFrame} from './audio-meters.mjs';
const db=value=>Number.isFinite(value)?Math.max(-100,value):-100;
const text=value=>value<=-99?'−∞':value.toFixed(1);
const percent=value=>Math.max(0,Math.min(100,(db(value)+60)/60*100));
export class StereoMeterView{
 constructor(root,{label='L/R',tap=''}={}){
  this.root=root;root.classList.add('signal-meter');root.title=tap;
  root.innerHTML='<div class="signal-meter-head"><span></span><output>−∞ dBFS</output></div>'+['L','R'].map(name=>'<div class="signal-meter-row"><small>'+name+'</small><div class="signal-meter-track"><meter min="-60" max="0" low="-60" high="-6" optimum="-18" value="-60" aria-label="'+name+' RMS dBFS"></meter><i></i></div><small class="signal-clip" aria-label="Saturation '+name+'">●</small></div>').join('');
  root.querySelector('.signal-meter-head span').textContent=label;
  this.rows=[...root.querySelectorAll('.signal-meter-row')].map(row=>({root:row,meter:row.querySelector('meter'),hold:row.querySelector('i'),clip:row.querySelector('.signal-clip')}));this.output=root.querySelector('output');
 }
 update(bus,available=true){
  const channels=[bus?.left,bus?.right];this.root.dataset.available=String(available);
  for(let i=0;i<2;i++){const c=channels[i],row=this.rows[i],rms=available?db(c?.rmsDb):-100,hold=available?db(c?.holdDb):-100;row.meter.value=Math.max(-60,rms);row.hold.style.left=percent(hold)+'%';row.hold.hidden=!available||hold<=-99;row.clip.classList.toggle('hot',Boolean(available&&c?.clipped));row.root.title=(i?'R':'L')+' · RMS '+text(rms)+' · crête '+text(available?db(c?.peakDb):-100)+' · maintien '+text(hold)+' dBFS';}
  this.output.textContent=available?text(Math.max(db(bus?.left?.peakDb),db(bus?.right?.peakDb)))+' dBFS':'— dBFS';
 }
}
export function drawMasterMeter(canvas,bus,available,colors={}){
 if(!canvas)return;const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;ctx.clearRect(0,0,width,height);
 const lanes=[bus?.left,bus?.right];ctx.font='7px sans-serif';ctx.textAlign='center';
 for(let ch=0;ch<2;ch++){
  const c=lanes[ch],level=available?percent(c?.rmsDb)/100:0,x=ch?25:11;
  for(let i=0;i<13;i++){const threshold=-60+i*5;ctx.fillStyle=i/13<level?(threshold>=-6?'#f09c63':colors.green||'#75e5ce'):colors.panel2||'#23303a';ctx.fillRect(x,78-i*5,8,3);}
  if(available&&db(c?.holdDb)>-99){ctx.fillStyle=c?.clipped?'#ff6666':colors.ink||'#e3e9ef';ctx.fillRect(x,78-percent(c?.holdDb)*.6,8,1.5);}
  ctx.fillStyle=available&&c?.clipped?'#ff6666':colors.ink||'#a4b4c0';ctx.fillText(ch?'R':'L',x+4,height-2);
 }
 ctx.textAlign='right';ctx.fillStyle=colors.ink||'#8d9eac';for(const value of [-60,-36,-18,0])ctx.fillText(String(value),9,81-(value+60));
 canvas.title=available?'Après limiteur · L '+text(db(bus?.left?.rmsDb))+' / R '+text(db(bus?.right?.rmsDb))+' dBFS RMS · crêtes '+text(db(bus?.left?.peakDb))+' / '+text(db(bus?.right?.peakDb))+' dBFS':'Mesures audio indisponibles';canvas.setAttribute('aria-label',canvas.title);
}
export function mountAudioMeters({deckRoots=[],masterRoot=null,canvas=null,onReset}={}){
 if(!document.querySelector('link[data-audio-meters]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./audio-meter.css',import.meta.url).href;style.dataset.audioMeters='';document.head.append(style);}
 const deckViews=[...deckRoots].map((deck,id)=>{const root=document.createElement('div');root.dataset.meterDeck=id;(deck.querySelector('.deck-summary')||deck.querySelector('.meta')||deck.querySelector('header')||deck.firstElementChild).after(root);return new StereoMeterView(root,{label:(id?'B':'A')+' · PRÉ-FADER',tap:'Après EQ, effets, volume et trim ; avant crossfader. Retours d’écho/réverbération mesurés au master.'});});
 const master=masterRoot?new StereoMeterView(masterRoot,{label:'MASTER L/R',tap:'Programme après limiteur · crête échantillon, sans mesure true peak.'}):null;
 if(onReset){const peak=document.querySelector('#master-peak');if(peak){peak.setAttribute('role','button');peak.tabIndex=0;peak.title='Réinitialiser les maintiens de crête';peak.onclick=onReset;peak.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onReset();}};}}
 const empty=emptyMeterFrame();let sequence=-1,lastAvailable;
 return{update(frame=empty,colors){const available=Boolean(frame?.available);if(frame.sequence!==sequence||available!==lastAvailable){for(let i=0;i<deckViews.length;i++)deckViews[i].update(frame?.decks?.[i],available);master?.update(frame?.master,available);sequence=frame.sequence;lastAvailable=available;}drawMasterMeter(canvas,frame?.master,available,colors);}};
}
