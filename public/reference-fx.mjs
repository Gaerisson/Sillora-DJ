import {clamp} from './audio-math.mjs';
import {tempoBeats,tempoDelay,tempoFraction} from './tempo-automation.mjs';
import {impulse} from './performance-fx.js';
import {stemNames} from './stems.mjs';

export const referenceFxIds=Object.freeze(['lunarecho','sweep','hydrant','stemsustain']);
const active=new WeakMap();
const smooth=value=>{const x=clamp(value,0,1);return x*x*(3-2*x);};
const curve=(fn,count=512)=>Float32Array.from({length:count},(_,i)=>fn(i/(count-1)));

// Spatial transitions combine stereo delay, spectral sweeps, modulated air
// and an instrumental hold, each with its own bounded return lifecycle.
export function scheduleReferenceFx(context,{a,b,t,plan,start,duration,level=.45,musicBus,textures,at}={}){
 const style=plan?.style;if(!referenceFxIds.includes(style))return null;
 const instrumentChannel=stemNames.indexOf('other')*2;
 if(style==='stemsustain'&&(instrumentChannel<0||!a?.track?.stemBuffer||a.track.stemBuffer.numberOfChannels<stemNames.length*2||!a.stemTransitionGains||!b?.stemTransitionGains))return null;
 level=clamp(Number.isFinite(level)?level:.45,0,1);duration=Math.max(.05,duration);
 const now=context.currentTime,nodes=[],inputs=[],sources=[],sends=[],voices=[],feedbacks=[];
 const end=start+duration,from=plan.bpmA||120,to=plan.tempoBlend?(plan.bpmB||from):from;
 const when=at||((fraction)=>start+(plan.tempoBlend?tempoFraction(fraction,from,to,duration):duration*fraction));
 const beats=p=>tempoBeats(duration*p,from,to,duration);
 const totalBeats=beats(1),musicalCurve=(fn,count=512)=>curve(p=>fn(beats(p)/totalBeats),count);
 const node=n=>(nodes.push(n),n),gain=value=>{const n=node(context.createGain());n.gain.value=value;return n;};
 const filter=(type,frequency,q=.7)=>{const n=node(context.createBiquadFilter());n.type=type;n.frequency.value=frequency;n.Q.value=q;return n;};
 const automate=(param,values)=>{param.cancelScheduledValues(now);param.setValueAtTime(values[0],now);param.setValueCurveAtTime(values,start,duration);};
 const parameter=(param,points,exponential=false)=>{param.cancelScheduledValues(now);param.setValueAtTime(points[0][1],now);for(const [p,value]of points){const time=when(p);if(exponential)param.exponentialRampToValueAtTime(Math.max(.001,value),time);else param.linearRampToValueAtTime(value,time);}};
 const connect=(input,output)=>{input.connect(output);inputs.push([input,output]);};
 const output=gain(1);output.connect(musicBus);
 const returnEnvelope=musicalCurve(p=>level*.6*smooth((p-.08)/.18)*(1-smooth((p-.78)/.22)));
 const diagnostics={style,independent:true,feedbackMax:0,stemOnly:false,grainCount:0};
 let tailSeconds=0;

 if(style==='lunarecho'){
  tailSeconds=2.8;
  const send=gain(0),hp=filter('highpass',220),split=node(context.createChannelSplitter(2)),merge=node(context.createChannelMerger(2));
  connect(a.gain,send);send.connect(hp).connect(split);sends.push(send);
  const delays=[node(context.createDelay(3)),node(context.createDelay(3))],lowpasses=[filter('lowpass',7000),filter('lowpass',7000)],returns=[gain(0),gain(0)];
  const fb=.26+level*.12;diagnostics.feedbackMax=fb;
  for(let i=0;i<2;i++){
   split.connect(delays[i],i);delays[i].connect(lowpasses[i]).connect(returns[i]);returns[i].connect(merge,0,i);
   const feedback=gain(fb);feedbacks.push(feedback);lowpasses[i].connect(feedback).connect(delays[1-i]);
   automate(delays[i].delayTime,curve(p=>tempoDelay(duration*p,i?.75:.5,from,to,duration),256));
   automate(returns[i].gain,curve(p=>(.36+.16*level*Math.sin(beats(p)*Math.PI+(i?Math.PI:0)))));
   parameter(lowpasses[i].frequency,[[0,7000],[.45,4200],[1,900]],true);
  }
  merge.connect(output);automate(send.gain,musicalCurve(p=>level*(.35+.20*level)*smooth((p-.14)/.16)*(1-smooth((p-.48)/.22))));
  output.gain.setValueAtTime(1,end);output.gain.linearRampToValueAtTime(0,end+tailSeconds);
  parameter(a.transitionLow.gain,[[0,0],[.35,-3],[.70,-14],[1,-18]]);
 }

 if(style==='sweep'){
  tailSeconds=1.8;
  const send=gain(0),band=filter('bandpass',350,.7+level*.55),verb=node(context.createConvolver()),wet=gain(.42),hp=filter('highpass',250);
  verb.buffer=impulse(context);connect(a.gain,send);send.connect(band).connect(hp).connect(verb).connect(wet).connect(output);sends.push(send);
  automate(send.gain,returnEnvelope);
  parameter(band.frequency,[[0,350],[.46,1700],[.76,5600],[1,2800]],true);
  parameter(a.transitionHighpass.frequency,[[0,18],[.22,80],[.56,1100+level*1200],[1,9000]],true);
  parameter(b.transitionLowpass.frequency,[[0,1000+level*1000],[.34,1800],[.76,Math.min(20000,context.sampleRate*.45)],[1,Math.min(20000,context.sampleRate*.45)]],true);
  parameter(b.transitionLow.gain,[[0,-8*level],[.54,-8*level],[.82,0],[1,0]]);
  output.gain.setValueAtTime(1,end);output.gain.linearRampToValueAtTime(0,end+tailSeconds);
 }

 if(style==='hydrant'){
  tailSeconds=.85;
  const send=gain(0),hp=filter('highpass',350),delay=node(context.createDelay(.08)),band=filter('bandpass',1800,.9),returnGain=gain(0),feedback=gain(.22+level*.12);
  diagnostics.feedbackMax=feedback.gain.value;feedbacks.push(feedback);connect(a.gain,send);send.connect(hp).connect(delay).connect(band).connect(returnGain).connect(output);band.connect(feedback).connect(delay);sends.push(send);
  automate(send.gain,musicalCurve(p=>level*(.25+.1*level)*smooth((p-.12)/.18)*(1-smooth((p-.72)/.22))));
  automate(delay.delayTime,curve(p=>.003+.012*(.5-.5*Math.cos(beats(p)*Math.PI))));
  automate(returnGain.gain,curve(p=>.48*(1-level*.32*(.5-.5*Math.cos(beats(p)*Math.PI*4)))));
  parameter(band.frequency,[[0,900],[.45,2600],[.75,6000],[1,1600]],true);
  parameter(a.transitionHighpass.frequency,[[0,18],[.30,90],[.66,900+level*1500],[1,6500]],true);
  parameter(b.transitionLow.gain,[[0,-6*level],[.48,-6*level],[.80,0],[1,0]]);
  if(textures&&level>0){const voice=textures.play('air',{start:when(.24),duration:Math.max(.08,when(.80)-when(.24)),intensity:level*.28});if(voice){voices.push(voice);t?.voices?.push(voice);}}
  output.gain.setValueAtTime(1,end);output.gain.linearRampToValueAtTime(0,end+tailSeconds);
 }

 if(style==='stemsustain'){
  tailSeconds=.7;diagnostics.stemOnly=true;
  const stemBuffer=a.track.stemBuffer,sr=stemBuffer.sampleRate,grainSeconds=Math.min(.50,Math.max(.16,60/from*.75)),frames=Math.max(2,Math.min(stemBuffer.length,Math.round(sr*grainSeconds)));
  const captureTime=when(.32)-start,position=(t?.outPoint??a.offset??0)+tempoBeats(captureTime,from,to,duration)*60/(a.track.bpm||from);
  const first=clamp(Math.round(position*sr),0,Math.max(0,stemBuffer.length-frames)),buffer=context.createBuffer(2,frames,sr);
  for(let ch=0;ch<2;ch++){const input=stemBuffer.getChannelData(instrumentChannel+ch),out=buffer.getChannelData(ch);let mean=0;for(let i=0;i<frames;i++)mean+=input[first+i]||0;mean/=frames;for(let i=0;i<frames;i++)out[i]=(input[first+i]||0)-mean;}
  const manualLevel=a.stemGains?.other?.gain?.value??a.track.stemLevels?.other??1,instrumentLevel=clamp(Number.isFinite(manualLevel)?manualLevel:1,0,1);
  diagnostics.instrumentLevel=instrumentLevel;
  const hold=gain(Math.min(1.8,(a.track.autoGain||1)*(a.volume??.85))*instrumentLevel*.22*level),hp=filter('highpass',220),lp=filter('lowpass',6500),verb=node(context.createConvolver()),room=gain(.22);
  verb.buffer=impulse(context);hold.connect(hp).connect(lp).connect(output);lp.connect(verb).connect(room).connect(output);
  const begin=when(.32),span=Math.min(3.6,Math.max(.08,when(.90)-begin)),hop=buffer.duration/2;
  for(let time=begin;time<begin+span;time+=hop){
   const source=node(context.createBufferSource()),window=gain(0);source.buffer=buffer;source.playbackRate.value=1;source.connect(window).connect(hold);sources.push(source);
   const length=Math.min(buffer.duration,begin+span-time),values=curve(p=>Math.sin(Math.PI*p)**2,128);window.gain.setValueCurveAtTime(values,time,length);source.start(time);source.stop(time+length);diagnostics.grainCount++;
  }
  diagnostics.grainFrames=frames;diagnostics.instrumentChannels=[instrumentChannel,instrumentChannel+1];diagnostics.capturePosition=first/sr;
  for(const [deck,name,fromValue,toValue,begin,end]of [[a,'vocals',1,0,.04,.30],[a,'drums',1,0,.30,.52],[a,'bass',1,0,.36,.56],[b,'vocals',0,1,.64,.92],[b,'drums',0,1,.18,.44],[b,'bass',0,1,.42,.62]]){
   const param=deck.stemTransitionGains[name]?.gain;if(param)automate(param,musicalCurve(p=>fromValue+(toValue-fromValue)*smooth((p-begin)/(end-begin))));
  }
  output.gain.setValueAtTime(1,end);output.gain.linearRampToValueAtTime(0,end+tailSeconds);
 }

 const clock=node(context.createBufferSource()),clockGain=gain(0);clock.buffer=context.createBuffer(1,1,context.sampleRate);clock.loop=true;clock.connect(clockGain).connect(musicBus);clock.start(now);clock.stop(end+tailSeconds+.05);
 let state='running';
 const handle={style,tailSeconds,nodes,diagnostics,get state(){return state;},stop({tail=false}={}){
  if(state==='disposed'||state==='hard'||tail&&state==='tail')return;
  const time=context.currentTime;state=tail?'tail':'hard';
  for(const send of sends){if(send.gain.cancelAndHoldAtTime)send.gain.cancelAndHoldAtTime(time);else send.gain.cancelScheduledValues(time);send.gain.setTargetAtTime(0,time,.008);}
  if(!tail){
   if(output.gain.cancelAndHoldAtTime)output.gain.cancelAndHoldAtTime(time);else output.gain.cancelScheduledValues(time);output.gain.setTargetAtTime(0,time,.008);
   for(const source of sources)try{source.stop(time+.035);}catch{}
   for(const voice of voices)textures?.stop(voice);
   for(const feedback of feedbacks){feedback.gain.cancelScheduledValues(time);feedback.gain.setTargetAtTime(0,time,.008);}
   try{clock.stop(time+.05);}catch{}
  }
 },dispose(){
  if(state==='disposed')return;state='disposed';for(const [input,output]of inputs)try{input.disconnect(output);}catch{}
  for(const source of sources)try{source.stop();}catch{}for(const item of nodes)try{item.disconnect();}catch{}
  active.get(context)?.delete(handle);
 }};
 clock.onended=()=>handle.dispose();let set=active.get(context);if(!set){set=new Set();active.set(context,set);}set.add(handle);
 return handle;
}

export function stopReferenceFx(context){for(const handle of active.get(context)||[])handle.stop({tail:false});}
