import {duckOptions} from './duck-math.mjs';
import {liveOptions,TonalDetector} from './live-dsp.mjs';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const storageKey='sillage:audio-io-v11';
const defaults={inputDeviceId:'',outputDeviceId:'',mode:'mic',gainDb:0,compress:true,monitor:false,duckEnabled:false,thresholdDb:-36,depthDb:12,attackMs:35,holdMs:250,releaseMs:550};
function sanitize(value={}){const duck=duckOptions(value);return {...defaults,...liveOptions(value),inputDeviceId:typeof value.inputDeviceId==='string'?value.inputDeviceId:'',outputDeviceId:typeof value.outputDeviceId==='string'?value.outputDeviceId:'',mode:value.mode==='line'?'line':'mic',gainDb:clamp(Number.isFinite(value.gainDb)?value.gainDb:0,-24,24),compress:value.compress!==false,monitor:value.monitor===true,duckEnabled:value.duckEnabled===true,...Object.fromEntries(['thresholdDb','depthDb','attackMs','holdMs','releaseMs','preDelayMs','hysteresisDb','curve','triggerMode'].map(key=>[key,duck[key]]))};}
export class AudioIO extends EventTarget{
 constructor(engine,{mediaDevices=globalThis.navigator?.mediaDevices,storage,storageKey:key=storageKey,duckSink=null,window:hostWindow=globalThis.window}={}){
  super();this.engine=engine;this.mediaDevices=mediaDevices;this.storageKey=key;this.duckSink=duckSink;this.autoNotches=[];this.feedbackDetector=new TonalDetector();this.dynamics={gateOpen:true,gateReductionDb:0,limitReductionDb:0};try{this.storage=storage??globalThis.localStorage;}catch{}let saved={};try{saved=JSON.parse(this.storage?.getItem(this.storageKey)||'{}');}catch{}
  this.options=sanitize({...saved,monitor:false});this.armed=false;this.talking=false;this.starting=false;this.levelDb=-100;this.reductionDb=0;this.voicing=false;this.devices=[];this.actualOutputId='';this.error='';this.notice='';this.request=null;
  this.onDeviceChange=()=>this.refreshDevices({deviceChange:true}).catch(error=>this.fail(error));this.mediaDevices?.addEventListener?.('devicechange',this.onDeviceChange);
  this.hostWindow=hostWindow;this.onUnload=()=>this.dispose();hostWindow?.addEventListener?.('beforeunload',this.onUnload,{once:true});
 }
 meters(){const graph=this.graph;if(!graph?.analyser?.getFloatTimeDomainData)return{waveform:[],inputDb:-100,outputDb:-100,peakDb:-100};this.inputWave||=new Float32Array(2048);this.outputWave||=new Float32Array(1024);graph.analyser.getFloatTimeDomainData(this.inputWave);graph.outputAnalyser?.getFloatTimeDomainData(this.outputWave);let inputPower=0,outputPower=0,peak=0;for(const x of this.inputWave)inputPower+=x*x;for(const x of this.outputWave){outputPower+=x*x;peak=Math.max(peak,Math.abs(x));}const db=x=>Math.max(-100,20*Math.log10(Math.max(.00001,x))),waveform=Array.from({length:64},(_,i)=>{let value=0;for(let j=i*32;j<(i+1)*32;j++)if(Math.abs(this.inputWave[j])>Math.abs(value))value=this.inputWave[j];return Math.round(value*1000)/1000;});return{waveform,inputDb:db(Math.sqrt(inputPower/this.inputWave.length)),outputDb:db(Math.sqrt(outputPower/this.outputWave.length)),peakDb:db(peak)};}
 get state(){return{...this.meters(),armed:this.armed,starting:this.starting,talking:this.talking,monitor:this.options.monitor,levelDb:this.levelDb,reductionDb:this.reductionDb,voicing:this.voicing,actualOutputId:this.actualOutputId,outputSupported:typeof this.engine.context?.setSinkId==='function',devices:this.devices.map(device=>({...device})),options:{...this.options,notches:this.options.notches.map(notch=>({...notch}))},dynamics:{...this.dynamics},autoNotches:this.autoNotches.map(notch=>({...notch})),error:this.error,notice:this.notice};}
 changed(){this.dispatchEvent(new Event('change'));}
 persist(){try{this.storage?.setItem(this.storageKey,JSON.stringify(this.options));}catch{}}
 fail(error){this.error=error?.message||String(error);this.changed();return error;}
 async refreshDevices({deviceChange=false}={}){
  if(!this.mediaDevices?.enumerateDevices)throw this.fail(new Error('La liste des périphériques audio est indisponible.'));
  this.devices=(await this.mediaDevices.enumerateDevices()).filter(device=>['audioinput','audiooutput'].includes(device.kind)).map(device=>({kind:device.kind,deviceId:device.deviceId,label:device.label}));
  if(deviceChange&&this.actualOutputId&&this.actualOutputId!=='default'&&!this.devices.some(device=>device.kind==='audiooutput'&&device.deviceId===this.actualOutputId)){
   try{await this.selectOutput('');this.notice='Sortie débranchée : retour confirmé à la sortie Windows.';}catch{this.error='La sortie a disparu. Choisissez une sortie disponible ou vérifiez Windows.';}
  }
  if(deviceChange&&this.armed&&this.options.inputDeviceId&&!this.devices.some(device=>device.kind==='audioinput'&&device.deviceId===this.options.inputDeviceId)){this.stopInput();this.notice='Entrée débranchée : micro arrêté.';}
  this.changed();return this.devices;
 }
 async selectOutput(deviceId=''){
  const context=await this.engine.init();
  if(typeof context.setSinkId!=='function')throw this.fail(new Error('Choix de sortie indisponible ici. Utilisez la sortie audio par défaut de Windows.'));
  try{await context.setSinkId(deviceId==='default'?'':deviceId);this.actualOutputId=typeof context.sinkId==='string'?context.sinkId:(deviceId==='default'?'':deviceId);this.options.outputDeviceId=this.actualOutputId;this.persist();this.error='';this.notice='Sortie audio appliquée.';this.changed();return this.actualOutputId;}
  catch(error){throw this.fail(new Error('Sortie non appliquée : '+(error.message||'accès refusé ou périphérique absent.')));}
 }
 async restoreOutput(){if(this.options.outputDeviceId)try{await this.selectOutput(this.options.outputDeviceId);}catch{}return this.state;}
 setOptions(value={}){
  const previous=this.options;this.options=sanitize({...previous,...value});
  if(previous.inputDeviceId!==this.options.inputDeviceId&&(this.armed||this.starting)){this.stopInput();this.notice='Entrée modifiée : activez-la à nouveau pour autoriser sa capture.';}
  if(previous.mode!==this.options.mode&&!('compress' in value))this.options.compress=this.options.mode==='mic';
  if(previous.mode!==this.options.mode&&!('hpEnabled' in value))this.options.hpEnabled=this.options.mode==='mic';
  if(previous.autoNotchEnabled&&!this.options.autoNotchEnabled)this.resetFeedback();
  this.persist();this.apply();this.changed();return this.state;
 }
 setTalk(enabled,{remote=false}={}){
  if(!this.armed||remote&&!this.options.monitor){if(remote)throw new Error('Activez localement le micro et sa diffusion avant la commande distante.');return false;}
  this.talking=enabled===true;this.apply();this.changed();return this.talking;
 }
 apply(){
  const graph=this.graph;if(!graph)return;const now=this.engine.context.currentTime,o=this.options;
  graph.highpass.type=o.hpEnabled?'highpass':'allpass';graph.highpass.frequency.setTargetAtTime(o.highpassHz,now,.02);graph.preamp.gain.setTargetAtTime(10**(o.gainDb/20),now,.02);
  for(const [node,gain,hz] of [[graph.eqLow,o.eqLowDb,180],[graph.eqMid,o.eqMidDb,o.eqMidHz],[graph.eqHigh,o.eqHighDb,5000]]){node.gain.setTargetAtTime(gain,now,.02);node.frequency.setTargetAtTime(hz,now,.02);}graph.eqMid.Q?.setTargetAtTime(o.eqMidQ,now,.02);
  // Native compressor stays neutral: the worklet owns the explicit soft-knee
  // transfer and makeup gain, without Chromium's hidden normalization gain.
  graph.compressor.threshold.setTargetAtTime(0,now,.02);graph.compressor.ratio.setTargetAtTime(1,now,.02);graph.compressor.knee.setTargetAtTime(0,now,.02);
  for(let index=0;index<3;index++){const notch=o.notches[index],node=graph['notch'+index];node.frequency.setTargetAtTime(notch.frequency,now,.02);node.Q?.setTargetAtTime(notch.Q,now,.02);node.gain.setTargetAtTime(notch.enabled?notch.depthDb:0,now,.02);}
  graph.pro.port.postMessage({type:'options',value:{...o,makeupDb:o.compress?o.makeupDb:0}});
  graph.dry.gain.setTargetAtTime(1,now,.02);graph.compressed.gain.setTargetAtTime(0,now,.02);
  graph.send.gain.setTargetAtTime(o.monitor&&this.talking?1:0,now,.008);
  graph.duck.port.postMessage({type:'options',value:{...o,manualActive:this.talking,enabled:o.duckEnabled&&o.monitor&&this.talking}});
 }
 resetFeedback(){this.autoNotches=[];this.feedbackDetector.reset();if(this.graph)for(let index=0;index<3;index++)this.graph['auto'+index].gain.setTargetAtTime(0,this.engine.context.currentTime,.03);this.changed();}
 inspectFeedback(){
  if(!this.graph||!this.options.autoNotchEnabled||!this.options.monitor||!this.talking)return;
  this.graph.analyser.getFloatFrequencyData(this.feedbackSpectrum);const result=this.feedbackDetector.inspect(this.feedbackSpectrum,this.engine.context.sampleRate,this.graph.analyser.fftSize,performance.now(),this.options);
  if(!result||this.autoNotches.some(notch=>Math.abs(notch.frequency-result.frequency)<Math.max(30,result.frequency*.03)))return;
  const index=this.autoNotches.length<3?this.autoNotches.length:0;this.autoNotches[index]=result;const node=this.graph['auto'+index],now=this.engine.context.currentTime;node.frequency.setTargetAtTime(result.frequency,now,.02);node.Q.setTargetAtTime(result.Q,now,.02);node.gain.setTargetAtTime(result.depthDb,now,.04);this.changed();
 }
 async startInput(){
  if(this.armed)return true;if(this.starting)return false;this.stopInput();const request={};this.request=request;this.starting=true;this.error='';this.notice='Autorisation de capture audio…';this.changed();let stream;
  try{
   const context=await this.engine.init();if(this.request!==request)return false;
   if(!this.mediaDevices?.getUserMedia)throw new Error('Capture micro indisponible dans cette application.');
   if(!context.audioWorklet||typeof AudioWorkletNode==='undefined'||!this.engine.musicBus)throw new Error('Le moteur de micro et de ducking nécessite la nouvelle application Windows.');
   this.duckReady||=Promise.all([context.audioWorklet.addModule('/duck-worklet.js'),context.audioWorklet.addModule('/pro-mic-worklet.js')]).catch(error=>{this.duckReady=null;throw error;});await this.duckReady;await this.duckSink?.ready?.();if(this.request!==request)return false;
   const input=this.options.inputDeviceId;
   stream=await this.mediaDevices.getUserMedia({audio:{...(input?{deviceId:{exact:input}}:{}),channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   if(this.request!==request){stream.getTracks().forEach(track=>track.stop());return false;}
   this.pendingStream=stream;
   const source=context.createMediaStreamSource(stream),highpass=context.createBiquadFilter(),preamp=context.createGain(),compressor=context.createDynamicsCompressor(),dry=context.createGain(),compressed=context.createGain(),mix=context.createGain(),bus=context.createGain(),send=context.createGain();
   const eqLow=context.createBiquadFilter(),eqMid=context.createBiquadFilter(),eqHigh=context.createBiquadFilter();eqLow.type='lowshelf';eqMid.type='peaking';eqHigh.type='highshelf';
   const filters={};for(let index=0;index<3;index++)for(const kind of ['notch','auto']){const node=context.createBiquadFilter();node.type='peaking';node.gain.value=0;filters[kind+index]=node;}
   const outputAnalyser=context.createAnalyser();outputAnalyser.fftSize=2048;const analyser=context.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.6;this.feedbackSpectrum=new Float32Array(analyser.frequencyBinCount||4096);
   compressor.threshold.value=0;compressor.knee.value=0;compressor.ratio.value=1;compressor.attack.value=.008;compressor.release.value=.18;
   dry.gain.value=0;compressed.gain.value=0;send.gain.value=0;
   const duck=new AudioWorkletNode(context,'sillage-duck',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   const pro=new AudioWorkletNode(context,'sillage-pro-mic',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{...this.options,makeupDb:this.options.compress?this.options.makeupDb:0}});
   this.graph={outputAnalyser,source,highpass,preamp,compressor,dry,compressed,bus,send,duck,pro,mix,eqLow,eqMid,eqHigh,analyser,...filters};
   let signal=source.connect(highpass).connect(preamp).connect(eqLow).connect(eqMid).connect(eqHigh);for(let index=0;index<3;index++)signal=signal.connect(filters['notch'+index]);for(let index=0;index<3;index++)signal=signal.connect(filters['auto'+index]);signal.connect(analyser);signal.connect(dry).connect(mix);mix.connect(pro).connect(bus);bus.connect(outputAnalyser);bus.connect(send).connect(this.engine.master);bus.connect(duck);if(this.duckSink)this.duckSink.connect(duck);else duck.connect(this.engine.musicBus.gain);
   this.stream=stream;this.pendingStream=null;this.armed=true;this.starting=false;this.talking=false;this.notice='Entrée active pour le niveau. Ouvrez le micro et activez sa diffusion pour l’entendre.';
   duck.port.onmessage=({data})=>{this.levelDb=Number.isFinite(data.levelDb)?data.levelDb:-100;this.reductionDb=Number.isFinite(data.reductionDb)?data.reductionDb:0;this.voicing=Boolean(data.voicing);this.dispatchEvent(new Event('meter'));};
   duck.onprocessorerror=()=>{this.stopInput();this.fail(new Error('Le traitement micro a été interrompu. Réactivez l’entrée.'));};
   pro.port.onmessage=({data})=>{this.dynamics=data;};pro.onprocessorerror=duck.onprocessorerror;
   this.feedbackTimer=setInterval(()=>this.inspectFeedback(),100);this.feedbackTimer.unref?.();
   for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(this.stream===stream){this.stopInput();this.notice='Capture interrompue par le périphérique.';this.changed();}},{once:true});
   this.apply();this.changed();this.refreshDevices().catch(()=>{});return true;
  }catch(error){stream?.getTracks().forEach(track=>track.stop());if(this.request===request){this.stopInput();this.fail(new Error('Entrée non activée : '+error.message));}throw error;}
 }
 stopInput(){
  this.request=null;this.starting=false;this.armed=false;this.talking=false;
  clearInterval(this.feedbackTimer);this.feedbackTimer=null;this.autoNotches=[];this.feedbackDetector.reset();
  const streams=[this.stream,this.pendingStream];this.stream=null;this.pendingStream=null;for(const stream of streams)stream?.getTracks().forEach(track=>track.stop());
  const graph=this.graph;this.graph=null;
  if(graph){this.duckSink?.disconnect?.(graph.duck);graph.duck.port.onmessage=null;graph.pro.port.onmessage=null;for(const node of Object.values(graph))try{node.disconnect();}catch{}graph.duck.port.close();graph.pro.port.close();
   if(!this.duckSink){const gain=this.engine.musicBus.gain,now=this.engine.context.currentTime;gain.cancelScheduledValues(now);gain.setValueAtTime(10**(-this.reductionDb/20),now);gain.setTargetAtTime(1,now,.05);}
  }
  this.levelDb=-100;this.reductionDb=0;this.voicing=false;this.changed();
 }
 dispose(){this.stopInput();this.mediaDevices?.removeEventListener?.('devicechange',this.onDeviceChange);this.hostWindow?.removeEventListener?.('beforeunload',this.onUnload);}
}
