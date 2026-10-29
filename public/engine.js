import {runtimeIncomingLanding} from './incoming-landing.mjs';
import {checkedGrid,automaticGrid,gridRevision} from './grid-editor.mjs';
import {keyLockProfile as resolveKeyLockProfile} from './keylock-profiles.mjs';
import {ProgramBus,programOptions} from './program-bus.js';
import {PumpingBus} from './pumping-bus.mjs';
import {scheduleReferenceFx,stopReferenceFx} from './reference-fx.mjs';
import {contentAnalysisKey,cachedAnalysis,cacheAnalysis} from './analysis-cache.mjs';
import {AnalysisQueue} from './analysis-queue.mjs';
import {emptyMeterFrame} from './audio-meters.mjs';
import {continuityWindow} from './continuity.mjs';
import {DeckEffects,TextureBus,impulse} from './performance-fx.js';
import {faderCurves,transitionProgress,textureNames} from './transition-design.mjs';
import {makeTransitionScore,scheduleTransitionScore} from './transition-score.mjs';
import {eqCurves} from './transition-envelopes.mjs';
import {tempoAt,tempoBeats,tempoFraction,tempoDelay,warpTempoCurve} from './tempo-automation.mjs';
import {cleanTiming,gridReliable} from './musical-plan.mjs';
import {stemNames} from './stems.mjs';
import {analyzeWaveDetail} from './wave-colors.mjs';
import { clamp, crossfadeGains, waveformPeaks, estimateTempo, transitionSeconds, quantizedDelay } from './audio-math.mjs';
import { analyzeAudio, prepareAnalysisRegions, nextMusicalTime, makeTransitionPlan } from './analysis.mjs';
import {arrangementFor} from './arrangement.mjs';

export class StudioEngine extends EventTarget {
  constructor(options={}) {
    super();let program={};try{program=JSON.parse(globalThis.localStorage?.getItem('sillage:program-v13')||'{}');}catch{}this.programOptions=programOptions({...program,muted:false,dim:false}); this.context = null; this.crossfade = 0; this.masterVolume = 0.7;
    this.decks = [0, 1].map(id => ({ id, track: null, source: null, playing: false, offset: 0, started: 0, rate: 1, volume: 0.85, cue: 0, loop: null, eq: [0, 0, 0], filter: 0 }));
    this.transitionHistory=[]; this.performanceLog=[]; this.transition = null; this.keyLock = true; this.keyLockAvailable = false; this.starting = false;this.keyLockProfile=resolveKeyLockProfile(options?.keyLockProfile).id;this.keyLockProfileChanging=null;
    this.analysisQueue=new AnalysisQueue();this.addEventListener('change',()=>this.analysisQueue.setPerformanceBusy(Boolean(this.transition||this.decks.some(d=>d.scratching))));this.audioMetrics=emptyMeterFrame();this.emptyMetrics=emptyMeterFrame();
    this.clockTimer = setInterval(() => this.tick(), 25); this.clockTimer.unref?.();
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      const ctx = this.context;
      this.master = ctx.createGain(); this.master.gain.value = this.masterVolume;
      // Music and performance FX share one duckable bus. Live input joins the
      // program at master, so speaking reduces music without reducing the mic.
      this.musicBus=ctx.createGain();this.musicBus.gain.value=1;this.pumping=new PumpingBus(ctx,this.programOptions);this.musicBus.connect(this.pumping.input);this.pumping.output.connect(this.master);
      this.limiter = ctx.createDynamicsCompressor();
      Object.assign(this.limiter.threshold, { value: -6 });
      this.limiter.knee.value = 3; this.limiter.ratio.value = 8; this.limiter.attack.value = 0.01; this.limiter.release.value = 0.15;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 256;
      this.programBus=new ProgramBus(ctx,this.programOptions);this.master.connect(this.programBus.input);this.programBus.output.connect(this.limiter).connect(this.analyser).connect(ctx.destination);
      this.textures=new TextureBus(ctx,this.musicBus);
      for (const deck of this.decks) {
        deck.input = ctx.createGain();
        deck.low = ctx.createBiquadFilter(); deck.low.type = 'lowshelf'; deck.low.frequency.value = 250;
        deck.mid = ctx.createBiquadFilter(); deck.mid.type = 'peaking'; deck.mid.frequency.value = 1200; deck.mid.Q.value = 0.7;
        deck.high = ctx.createBiquadFilter(); deck.high.type = 'highshelf'; deck.high.frequency.value = 4000;
        deck.sweep = ctx.createBiquadFilter(); deck.sweep.type = 'lowpass'; deck.sweep.frequency.value = 22000; deck.sweep.Q.value = 0.55;
        deck.highpass=ctx.createBiquadFilter();deck.highpass.type='highpass';deck.highpass.frequency.value=18;deck.highpass.Q.value=.55;
        deck.trim=ctx.createGain();
        deck.gain = ctx.createGain(); deck.fader = ctx.createGain();deck.fader.gain.value=crossfadeGains(this.crossfade)[deck.id];
        deck.fx=new DeckEffects(ctx);deck.transitionGate=ctx.createGain();
        // A transition owns its automation layer. Moving a manual EQ/filter
        // during the handover no longer overwrites or cancels that automation.
        deck.transitionLow=ctx.createBiquadFilter();deck.transitionLow.type='lowshelf';deck.transitionLow.frequency.value=250;
        deck.transitionMid=ctx.createBiquadFilter();deck.transitionMid.type='peaking';deck.transitionMid.frequency.value=1200;deck.transitionMid.Q.value=.7;
        deck.transitionHigh=ctx.createBiquadFilter();deck.transitionHigh.type='highshelf';deck.transitionHigh.frequency.value=4000;
        deck.transitionHighpass=ctx.createBiquadFilter();deck.transitionHighpass.type='highpass';deck.transitionHighpass.frequency.value=0;deck.transitionHighpass.Q.value=.55;
        deck.transitionLowpass=ctx.createBiquadFilter();deck.transitionLowpass.type='lowpass';deck.transitionLowpass.frequency.value=ctx.sampleRate/2;deck.transitionLowpass.Q.value=.55;
        deck.input.connect(deck.low).connect(deck.mid).connect(deck.high).connect(deck.highpass).connect(deck.sweep).connect(deck.fx.input);deck.fx.output.connect(deck.transitionLow).connect(deck.transitionMid).connect(deck.transitionHigh).connect(deck.transitionHighpass).connect(deck.transitionLowpass).connect(deck.transitionGate).connect(deck.gain).connect(deck.trim).connect(deck.fader).connect(this.musicBus);
        deck.verbSend=ctx.createGain();deck.verbSend.gain.value=0;deck.verb=ctx.createConvolver();deck.verb.buffer=impulse(ctx);deck.verbWet=ctx.createGain();deck.verbWet.gain.value=0;deck.gain.connect(deck.verbSend).connect(deck.verb).connect(deck.verbWet).connect(this.musicBus);
        deck.delay = ctx.createDelay(2); deck.feedback = ctx.createGain(); deck.wet = ctx.createGain(); deck.echoSend = ctx.createGain();
        deck.wet.gain.value = 0; deck.feedback.gain.value = 0.28; deck.delay.delayTime.value = 0.25;
        deck.echoSend.gain.value=0;
        deck.stemEchoSend=ctx.createGain();deck.stemEchoSend.gain.value=0;deck.stemEchoSend.connect(deck.delay);
        deck.manualEchoSend=ctx.createGain();deck.manualEchoSend.gain.value=0;deck.fader.connect(deck.manualEchoSend).connect(deck.delay);
        deck.echoHP=ctx.createBiquadFilter();deck.echoHP.type='highpass';deck.echoHP.frequency.value=180;
        deck.echoLP=ctx.createBiquadFilter();deck.echoLP.type='lowpass';deck.echoLP.frequency.value=4200;
        deck.gain.connect(deck.echoSend).connect(deck.delay).connect(deck.echoHP).connect(deck.echoLP).connect(deck.feedback).connect(deck.delay);
        deck.echoLP.connect(deck.wet).connect(this.musicBus);
        deck.gain.gain.value = deck.volume;
      }
      this.setCrossfade(this.crossfade);
      this.dspReady = Promise.all([this.prepareKeyLock(),this.prepareLimiter(),this.prepareScratch().catch(()=>false),this.pumping.prepare()]).then(()=>this.prepareMeters());
    }
    await this.dspReady;
    if(this.context.state!=='running')await this.context.resume();
    this.dispatchEvent(new Event('change'));
    return this.context;
  }
  async prepareLimiter(){
    if(!this.context.audioWorklet||typeof AudioWorkletNode==='undefined')return;
    try{await this.context.audioWorklet.addModule('/limiter-worklet.js');const node=new AudioWorkletNode(this.context,'sillage-limiter',{outputChannelCount:[2]});this.limiter.disconnect();this.limiter.connect(node).connect(this.analyser);this.peakLimiter=node;this.output=node;node.port.postMessage({ceilingDb:this.programOptions.ceilingDb});}catch{this.output=this.limiter;}
  }
  async prepareMeters(){
    const ctx=this.context;if(!ctx.audioWorklet||typeof AudioWorkletNode==='undefined')return false;
    try{
      await ctx.audioWorklet.addModule('/meter-worklet.js');
      const node=new AudioWorkletNode(ctx,'sillora-meter',{numberOfInputs:3,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers'});
      node.port.onmessage=({data})=>{if(data?.available&&Number.isFinite(data.audioTime)){this.audioMetrics=data;this.metricsReceivedAt=performance.now();}};
      node.onprocessorerror=()=>{this.audioMetrics=emptyMeterFrame();this.metricsReceivedAt=0;node.disconnect();};
      // Master is measured after the final limiter; deck taps are post EQ,
      // effects, volume and trim, before the crossfader. FX returns join master.
      (this.output||this.limiter).connect(node,0,0);this.decks[0].trim.connect(node,0,1);this.decks[1].trim.connect(node,0,2);
      node.connect(ctx.destination);this.meterNode=node;return true;
    }catch{this.audioMetrics=emptyMeterFrame();return false;}
  }
  readAudioMetrics(){
    return this.context?.state==='running'&&performance.now()-(this.metricsReceivedAt||0)<500?this.audioMetrics:this.emptyMetrics;
  }
  resetAudioPeaks(){this.meterNode?.port.postMessage({type:'reset'});}
  async prepareScratch(){
    if(!this.context?.audioWorklet||typeof AudioWorkletNode==='undefined')return false;
    this.scratchReady||=this.context.audioWorklet.addModule('/scratch-worklet.js').catch(error=>{this.scratchReady=null;throw error;});
    await this.scratchReady;return true;
  }
  async prepareKeyLock() {
    if (!this.context.audioWorklet || typeof AudioWorkletNode === 'undefined') return;
    try {
      const {KeyLockNode}=await import('./keylock-node.mjs');
      await KeyLockNode.register(this.context);this.SoundTouchNode=KeyLockNode;
      this.keyLockLatency=await this.calibrateKeyLock(this.keyLockProfile);this.keyLockAvailable=true;
    }catch(error){this.keyLockAvailable=false;this.dispatchEvent(new CustomEvent('warning',{detail:'Le maintien de tonalité est indisponible dans ce navigateur. La vitesse modifiera aussi la hauteur.'}));}
  }
  async calibrateKeyLock(profile) {
    if(!this.SoundTouchNode||typeof OfflineAudioContext==='undefined')return 0;
    const sr=this.context.sampleRate,probe=new OfflineAudioContext(2,sr,sr);await this.SoundTouchNode.register(probe);
    const buffer=probe.createBuffer(2,sr*.6,sr);for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=Math.round(sr*.15);i<data.length;i++)data[i]=.2*Math.sin((i-Math.round(sr*.15))*2*Math.PI*440/sr);}
    const source=probe.createBufferSource(),node=new this.SoundTouchNode({context:probe,profile});source.buffer=buffer;source.connect(node).connect(probe.destination);source.start();
    try{const result=(await probe.startRendering()).getChannelData(0),first=result.findIndex(x=>Math.abs(x)>.01),original=buffer.getChannelData(0).findIndex(x=>Math.abs(x)>.01),latency=(first-original)/sr;if(first<original||!Number.isFinite(latency)||latency>.3)throw Error('Calibration du maintien de hauteur indisponible.');return latency;}finally{node.disconnect();node.port.close();}
  }
  canChangeKeyLockProfile(){return !this.keyLockProfileChanging&&!this.starting&&!this.transition&&!this.decks.some(d=>d.playing||d.playRequest||d.scratching||d.braking);}
  async setKeyLockProfile(profile){
    if(!['standard','rhythm'].includes(profile))throw Error('Profil de maintien de hauteur invalide.');
    if(profile===this.keyLockProfile&&!this.keyLockProfileChanging)return profile;
    if(!this.canChangeKeyLockProfile())throw Error('Mettez les platines en pause avant de changer ce profil.');
    if(!this.context){this.keyLockProfile=profile;this.dispatchEvent(new Event('change'));return profile;}
    const change=(async()=>{await this.dspReady;const latency=await this.calibrateKeyLock(profile);if(!Number.isFinite(latency)||latency<0||latency>.3)throw Error('Calibration invalide.');this.keyLockProfile=profile;this.keyLockLatency=latency;return profile;})();
    this.keyLockProfileChanging=change;this.dispatchEvent(new Event('change'));
    try{return await change;}finally{if(this.keyLockProfileChanging===change)this.keyLockProfileChanging=null;this.dispatchEvent(new Event('change'));}
  }
  position(id) {
    const d = this.decks[id];
    if(d.scratching)return clamp(d.scratchSession?.position??d.offset,0,d.track?.buffer.duration||0);
    const now=this.context?.currentTime||0;
    let pos = d.offset + (d.playing ? Math.max(0,now - d.started) * d.rate : 0);
    if(d.playing && d.rateRamp) {
      const r=d.rateRamp, before=Math.max(0,Math.min(now,r.start)-d.started), during=clamp(now-r.start,0,r.duration), after=Math.max(0,now-r.start-r.duration);
      pos=d.offset+before*r.from+during*r.from+(r.to-r.from)*during*during/(2*r.duration)+after*r.to;
    }
    if(d.braking){const r=d.braking,t=clamp(now-r.start,0,r.duration);pos=r.position+r.from*t+(r.to-r.from)*t*t/(2*r.duration);}
    if (d.loop && pos >= d.loop.end) pos = d.loop.start + (pos - d.loop.start) % (d.loop.end - d.loop.start);
    return clamp(pos, 0, d.track?.buffer.duration || 0);
  }
  async decodeFile(file,{signal}={}) {
    signal?.throwIfAborted();await this.init();signal?.throwIfAborted();const began=performance.now(),bytes=await file.arrayBuffer();signal?.throwIfAborted();
    const contentKey=await contentAnalysisKey(bytes);signal?.throwIfAborted();const buffer=await this.context.decodeAudioData(bytes);signal?.throwIfAborted();return{buffer,contentKey,decodeMs:performance.now()-began};
  }
  async importFile(file,{deferAnalysis=false,priority=50,id=crypto.randomUUID(),signal}={}) {
    const decoded=await this.decodeFile(file,{signal}),buffer=decoded.buffer,parts=file.name.replace(/\.[^.]+$/,'').split(' - ');
    const track={id,title:parts.length>1?parts.slice(1).join(' - '):parts[0],artist:parts.length>1?parts[0]:'Fichier local',...decoded,source:'local',color:Math.random()*360,bpm:null,peaks:[],mixIn:0,mixOut:Math.max(0,buffer.duration-8),audibleEnd:buffer.duration,confidence:'low',analysisStatus:'queued'};
    return this.analyzeTrack(track,{deferAnalysis,priority,signal});
  }
  async analyzeTrack(track,{force=false,deferAnalysis=false,priority=20,signal}={}) {
    signal?.throwIfAborted();
    if(track.analysisTask&&['queued','analyzing'].includes(track.analysisStatus)){this.analysisQueue.promote(track.id,priority);if(!deferAnalysis)await track.analysisTask;return track;}
    if(!track.buffer?.getChannelData&&track.ensureAudio)await track.ensureAudio({priority});
    const buffer=track.buffer,cacheKey=track.contentKey;track.analysisStatus='queued';track.analysisReanalyzing=Boolean(track.analysis);track.analysisError=null;
    this.dispatchEvent(new CustomEvent('analysis',{detail:{track}}));
    let analysis=!force&&cacheKey?await cachedAnalysis(cacheKey):null;
    if(analysis?.waveformVersion!==2||!analysis?.regionAnalysisVersion)analysis=null;
    const apply=result=>{
      const preserved={};
      if(track.manualRegions)for(const key of ['manualRegions','mixIn','mixOut'])preserved[key]=track[key];
      if(track.manualGrid)for(const key of ['manualGrid','bpm','downbeat','beatOffset','confidence'])preserved[key]=track[key];
      if(track.manualKey)for(const key of ['manualKey','key','keyRoot','keyMode','keyConfidence'])preserved[key]=track[key];
      Object.assign(track,result,preserved,{analysis:result,analysisStatus:'ready',analysisError:null,analysisReanalyzing:false});
      this.refreshArrangement(track);
      for(const deck of this.decks)if(deck.track===track&&deck.input){
        const now=this.context.currentTime;deck.input.gain.cancelScheduledValues(now);
        deck.input.gain.setTargetAtTime(track.autoGain||1,now,.35);
      }
      this.dispatchEvent(new CustomEvent('analysis',{detail:{track}}));return track;
    };
    if(analysis){track.cacheHit=true;apply(analysis);return track;}
    track.cacheHit=false;
    track.analysisTask=this.analysisQueue.enqueue(track.id,async signal=>{
      track.analysisStatus='analyzing';this.dispatchEvent(new CustomEvent('analysis',{detail:{track}}));signal.throwIfAborted();
      const start=performance.now();
      const result=typeof Worker==='undefined'?analyzeAudio(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate):await new Promise((resolve,reject)=>{
        const worker=new Worker('/analysis-worker.js',{type:'module'});
        const stop=()=>{worker.terminate();reject(new DOMException('Analyse annulée','AbortError'));};
        const finish=()=>{signal.removeEventListener('abort',stop);worker.terminate();};
        signal.addEventListener('abort',stop,{once:true});
        worker.onmessage=({data})=>{finish();data.error?reject(new Error(data.error)):resolve(data.result);};
        worker.onerror=()=>{finish();reject(new Error('Analyse audio impossible.'));};
        const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice().buffer);
        worker.postMessage({id:1,channels,sampleRate:buffer.sampleRate},channels);
      });
      if(signal.aborted)throw new DOMException('Analyse annulée','AbortError');
      if(cacheKey)await cacheAnalysis(cacheKey,result);
      if(signal.aborted)throw new DOMException('Analyse annulée','AbortError');
      track.analysisMs=performance.now()-start;return apply(result);
    },{priority,sticky:force}).catch(error=>{track.analysisStatus=track.analysis?'ready':error.name==='AbortError'?'cancelled':'error';track.analysisReanalyzing=false;track.analysisError=error.message;this.dispatchEvent(new CustomEvent('analysis',{detail:{track}}));if(!deferAnalysis)throw error;return track;});
    if(signal){const cancel=()=>this.analysisQueue.cancel(track.id);signal.addEventListener('abort',cancel,{once:true});track.analysisTask.then(()=>signal.removeEventListener('abort',cancel),()=>signal.removeEventListener('abort',cancel));if(signal.aborted)cancel();}
    if(!deferAnalysis)await track.analysisTask;return track;
  }
  stopSource(d){
    this.clearBrake(d);
    this.disposeScratch(d);
    const source=d.source,node=d.pitchNode,voice=d.voiceGain,stemNodes=d.stemNodes;d.source=null;d.pitchNode=null;d.voiceGain=null;d.stemNodes=null;d.stemGains=null;d.stemTransitionGains=null;if(!source)return;
    const cleanup=()=>{source.disconnect();voice?.disconnect();for(const n of stemNodes||[])n.disconnect();if(node){node.disconnect();node.port.close();}};source.onended=cleanup;
    if(voice&&this.context){const now=this.context.currentTime;voice.gain.cancelScheduledValues(now);voice.gain.setTargetAtTime(0,now,.003);try{source.stop(now+.025);}catch{cleanup();}}
    else{try{source.stop();}catch{}cleanup();}
  }
  refreshArrangement(track){if(track)track.arrangement=arrangementFor(track);return track?.arrangement;}
  load(id, track) {
    this.decks[id].playRequest=null;
    this.releaseContinuity(id);
    this.cancelTransition();
    this.analysisQueue.promote(track.id,0);
    this.refreshArrangement(track);
    if(!track.manualRegions&&track.envelope?.length){const regions=prepareAnalysisRegions(track,track.buffer.duration);Object.assign(track,{mixIn:regions.mixIn,mixOut:regions.mixOut,introEnd:regions.introEnd,regionAnalysisVersion:regions.regionAnalysisVersion});if(track.analysis)Object.assign(track.analysis,{mixIn:regions.mixIn,mixOut:regions.mixOut,introEnd:regions.introEnd,regionAnalysisVersion:regions.regionAnalysisVersion});}
    const d = this.decks[id]; this.stopSource(d);
    d.fx?.reset();d.roll=null;
    if(d.echoSend){const now=this.context.currentTime;d.echoSend.gain.cancelScheduledValues(now);d.echoSend.gain.setValueAtTime(0,now);d.manualEchoSend.gain.setValueAtTime(0,now);d.verbSend.gain.cancelScheduledValues(now);d.verbSend.gain.setValueAtTime(0,now);d.trim.gain.cancelScheduledValues(now);d.trim.gain.setValueAtTime(1,now);}
    const preserveTail=(d.echoTailUntil||0)>(this.context?.currentTime||0);
    Object.assign(d, { track, playing: false, endedNaturally:false, offset: track.mixIn || 0, rate: 1, cue: track.mixIn ?? track.downbeat ?? track.beatOffset ?? 0, loop: null, rateRamp:null });
    if(d.input) d.input.gain.value=track.autoGain||1;
    this.setEQ(id, 0, 0); this.setEQ(id, 1, 0); this.setEQ(id, 2, 0); this.setFilter(id, 0); if(!preserveTail)this.setEcho(id, false);else d.echo=false;
    this.dispatchEvent(new Event('change'));
  }
  async play(id, when) {
    const d=this.decks[id];if(!d.track||d.playing)return;if(d.playRequest)return d.playRequest.promise;
    const track=d.track,request={};d.playRequest=request;this.dispatchEvent(new Event('change'));
    request.promise=(async()=>{try{try{await this.keyLockProfileChanging;}catch{}await this.init();
    if(track.ensureAudio&&!track.buffer?.getChannelData)await track.ensureAudio({priority:0});
    if(d.playRequest!==request||d.track!==track)return;
    if(d.scratching)await this.endScratch(id,{resume:false});
    if (!d.track || d.playing) return;
    if (d.offset >= d.track.buffer.duration - 0.02) d.offset = 0;
    this.stopSource(d);
    const source = this.context.createBufferSource();request.source=source; source.buffer = d.track.stemBuffer||d.track.buffer; source.playbackRate.value = d.rate;
    if (d.loop) { source.loop = true; source.loopStart = d.loop.start; source.loopEnd = d.loop.end; }
    d.voiceGain=this.context.createGain();d.voiceGain.gain.value=0;d.voiceGain.connect(d.input);
    let signal=source;
    if(d.track.stemBuffer){
      const split=this.context.createChannelSplitter(8),sum=this.context.createGain();sum.channelCount=2;sum.channelCountMode='explicit';source.connect(split);d.stemNodes=[split,sum];d.stemGains={};d.stemTransitionGains={};
      for(const [index,name] of stemNames.entries()){
        const stereo=this.context.createChannelMerger(2),gain=this.context.createGain(),automation=this.context.createGain();
        gain.gain.value=d.track.stemLevels?.[name]??1;
        split.connect(stereo,index*2,0);split.connect(stereo,index*2+1,1);stereo.connect(gain).connect(automation).connect(sum);
        d.stemNodes.push(stereo,gain,automation);d.stemGains[name]=gain;d.stemTransitionGains[name]=automation;
        if(name==='vocals')gain.connect(d.stemEchoSend);
      }
      signal=sum;
    }
    if(this.keyLock && this.keyLockAvailable && !d.brakeBypass) {
      d.pitchNode=new this.SoundTouchNode({context:this.context,profile:this.keyLockProfile}); d.pitchNode.playbackRate.value=d.rate; d.pitchNode.pitch.value=1;
      signal.connect(d.pitchNode).connect(d.voiceGain);
    } else signal.connect(d.voiceGain);
    d.source=source;d.endedNaturally=false;d.latency=d.pitchNode?(this.keyLockLatency||0):0;const sourceStart=Math.max(this.context.currentTime,(when??this.context.currentTime+d.latency)-d.latency);d.started=sourceStart+d.latency;d.playing=true;
    d.voiceGain.gain.setValueAtTime(0,sourceStart);d.voiceGain.gain.setValueAtTime(0,Math.max(sourceStart,d.started-.005));d.voiceGain.gain.linearRampToValueAtTime(1,d.started+.005);
    const voice=d.voiceGain,pitch=d.pitchNode,stemNodes=d.stemNodes;
    source.onended=()=>{if(d.source===source){if(d.braking?.source===source)this.pause(id);else{d.playing=false;d.endedNaturally=true;d.offset=d.track.buffer.duration;d.source=null;d.stemGains=null;d.stemTransitionGains=null;this.dispatchEvent(new Event('naturalend'));this.dispatchEvent(new Event('change'));}}setTimeout(()=>{source.disconnect();voice.disconnect();for(const n of stemNodes||[])n.disconnect();if(pitch){pitch.disconnect();pitch.port.close();}if(d.pitchNode===pitch)d.pitchNode=null;if(d.voiceGain===voice)d.voiceGain=null;if(d.stemNodes===stemNodes)d.stemNodes=null;},Math.ceil((d.latency+.1)*1000));};
    source.start(sourceStart, d.offset);
    this.dispatchEvent(new Event('change'));
    }finally{if(d.playRequest===request)d.playRequest=null;this.dispatchEvent(new Event('change'));}})();return request.promise;
  }
  disposeScratch(d){
    d.scratchRequest=null;
    const session=d.scratchSession;
    d.scratching=false;d.scratchSession=null;
    if(!session)return;
    session.finish?.(session.position);
    session.node.port.onmessage=null;
    session.node.port.postMessage({type:'finish'});
    // Let the worklet's short envelope settle before releasing its sample data.
    setTimeout(()=>{session.node.disconnect();session.node.port.close();},20);
  }
  async beginScratch(id){
    const d=this.decks[id];if(!d?.track)return false;if(d.scratching)return true;
    this.releaseContinuity(id);
    const track=d.track,request={};d.scratchRequest=request;
    await this.init();
    if(!this.context.audioWorklet||typeof AudioWorkletNode==='undefined'){
      if(d.scratchRequest===request)d.scratchRequest=null;
      throw new Error('Le scratch audio nécessite AudioWorklet. Ouvre la version Windows de Sillage.');
    }
    try{
      if(track.ensureAudio&&!track.buffer?.getChannelData)await track.ensureAudio({priority:0});
      await this.prepareScratch();
      if(d.scratchRequest!==request||d.track!==track)return false;
      this.cancelTransition();
      const position=this.position(id),wasPlaying=d.playing;
      if(d.rateRamp)d.rate=this.currentRate(id);
      this.stopSource(d);
      d.playing=false;d.offset=position;d.rateRamp=null;d.loop=null;d.roll=null;
      const buffer=track.buffer;
      const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,channel)=>buffer.getChannelData(channel));
      const node=new AudioWorkletNode(this.context,'sillage-scratch',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{channels,sourceRate:buffer.sampleRate,position}});
      const session={node,position,target:position,wasPlaying,track};
      d.scratchSession=session;d.scratching=true;
      node.port.onmessage=({data})=>{
        if(Number.isFinite(data.position))session.position=clamp(data.position,0,track.buffer.duration);
        if(data.type==='finished')session.finish?.(session.position);
      };
      node.onprocessorerror=()=>{
        if(d.scratchSession!==session)return;
        d.offset=session.position;this.disposeScratch(d);
        this.dispatchEvent(new CustomEvent('warning',{detail:'Le scratch audio a été interrompu. Recharge la platine pour réessayer.'}));
        this.dispatchEvent(new Event('change'));
      };
      node.connect(d.input);
      this.dispatchEvent(new Event('change'));return true;
    }catch(error){if(d.scratchRequest===request)d.scratchRequest=null;throw error;}
  }
  scratchBy(id,deltaSeconds,elapsedMs=16){
    const d=this.decks[id],session=d?.scratchSession;
    if(!session||!Number.isFinite(deltaSeconds))return;
    session.target=clamp(session.target+deltaSeconds,0,Math.max(0,d.track.buffer.duration-1/d.track.buffer.sampleRate));
    session.node.port.postMessage({type:'move',position:session.target,elapsedMs:clamp(Number.isFinite(elapsedMs)?elapsedMs:16,8,50)});
    return session.target;
  }
  async endScratch(id,{resume=true}={}){
    const d=this.decks[id],session=d?.scratchSession;
    if(!session){if(d)d.scratchRequest=null;return;}
    const position=await new Promise(resolve=>{
      const timeout=setTimeout(()=>resolve(session.position),225);
      session.finish=value=>{clearTimeout(timeout);resolve(value);};
      session.node.port.postMessage({type:'finish'});
    });
    if(d.scratchSession!==session)return;
    d.offset=position;this.disposeScratch(d);
    if(resume&&session.wasPlaying&&d.track===session.track)await this.play(id);
    this.dispatchEvent(new Event('change'));
  }
  setStemLevel(id,name,level){
    const d=this.decks[id];if(!d.track?.stemBuffer||!stemNames.includes(name))return;
    d.track.stemLevels||=Object.fromEntries(stemNames.map(name=>[name,1]));d.track.stemLevels[name]=clamp(Number.isFinite(level)?level:1,0,1);
    d.stemGains?.[name].gain.setTargetAtTime(d.track.stemLevels[name],this.context.currentTime,.02);this.dispatchEvent(new Event('change'));
  }
  async activateStems(id){const d=this.decks[id];if(!d.track?.stemBuffer||!d.playing)return;this.cancelTransition();this.pause(id);await this.play(id);}
  unload(id) {
    this.decks[id].playRequest=null;
    this.releaseContinuity(id);
    this.cancelTransition(); const d=this.decks[id]; this.stopSource(d);
    Object.assign(d,{track:null,playing:false,endedNaturally:false,offset:0,rate:1,cue:0,loop:null,rateRamp:null});this.setEcho(id,false);
    this.dispatchEvent(new Event('change'));
  }
  pause(id) {
    this.decks[id].playRequest=null;
    this.releaseContinuity(id);
    const d = this.decks[id], position=this.position(id);if(d.roll)d.loop=null;d.roll=null;
    if(d.rateRamp) d.rate=this.currentRate(id);
    d.offset=position; d.rateRamp=null; d.playing = false;d.endedNaturally=false; this.stopSource(d); this.dispatchEvent(new Event('change'));
  }
  clearBrake(d){
    const brake=d.braking;if(!brake)return;
    clearTimeout(brake.timer);d.braking=null;d.rate=brake.resumeRate;d.brakeBypass=false;brake.resolve?.();
  }
  async brake(id,duration=.35){
    const d=this.decks[id];if(!d?.track||!d.playing)return;if(d.braking)return d.braking.promise;
    this.cancelTransition();if(d.roll)await this.endRoll(id);if(d.loop)this.loop(id,4);
    await this.init();const position=this.position(id),resumeRate=d.rate;
    // A deck stop must descend in pitch even when key lock is enabled. Restart
    // just this source through its native playback path; the voice ramps mask
    // the short handoff and normal playback restores the key-lock path.
    if(d.pitchNode){this.stopSource(d);d.offset=position;d.playing=false;d.brakeBypass=true;await this.play(id);}
    const start=this.context.currentTime,seconds=clamp(Number(duration)||.35,.08,2),from=resumeRate,to=.005;
    let resolve;const promise=new Promise(done=>{resolve=done;});
    const brake={start,duration:seconds,from,to,position:this.position(id),resumeRate,source:d.source,promise,resolve};d.braking=brake;
    const rate=d.source.playbackRate;rate.cancelScheduledValues(start);rate.setValueAtTime(from,start);rate.linearRampToValueAtTime(to,start+seconds);
    const gain=d.voiceGain.gain;gain.cancelScheduledValues(start);gain.setValueAtTime(1,start);gain.setValueAtTime(1,start+seconds*.65);gain.linearRampToValueAtTime(0,start+seconds);
    // The source clock ends the brake accurately, including offline rendering;
    // the timer also closes it when a browser delays the ended event.
    d.source.stop(start+seconds+.005);
    const finish=()=>{if(d.braking!==brake)return;const remaining=start+seconds-this.context.currentTime;if(remaining>.002){brake.timer=setTimeout(finish,Math.max(10,remaining*1000));brake.timer.unref?.();}else this.pause(id);};
    brake.timer=setTimeout(finish,seconds*1000+10);brake.timer.unref?.();this.dispatchEvent(new Event('change'));return promise;
  }
  async toggle(id) { this.cancelTransition(); return this.decks[id].playing ? this.pause(id) : this.play(id); }
  async seek(id, position,{cancel=true}={}) {
    if(cancel)this.cancelTransition(); const d = this.decks[id], playing = d.playing;
    this.pause(id); d.loop = null; d.offset = clamp(position, 0, Math.max(0, (d.track?.buffer.duration || 0) - 0.001));
    if (playing) await this.play(id); this.dispatchEvent(new Event('change'));
  }
  setHotCue(id, slot, position = this.position(id)) {
    const d = this.decks[id];
    if (!d.track || !Number.isInteger(slot) || slot < 0 || slot > 3) return;
    d.track.hotCues ||= [null, null, null, null];
    d.track.hotCues[slot] = clamp(position, 0, Math.max(0, d.track.buffer.duration - 0.02));
    this.dispatchEvent(new Event('change')); return d.track.hotCues[slot];
  }
  clearHotCue(id, slot) {
    const d = this.decks[id]; if (!d.track || !Number.isInteger(slot) || slot < 0 || slot > 3) return;
    d.track.hotCues ||= [null, null, null, null]; d.track.hotCues[slot] = null; this.dispatchEvent(new Event('change'));
  }
  async triggerHotCue(id, slot) {
    const cue = this.decks[id].track?.hotCues?.[slot];
    if (!Number.isFinite(cue)) return this.setHotCue(id, slot);
    await this.seek(id, cue); await this.play(id);
  }
  async beatJump(id, beats) {
    const d = this.decks[id]; if (!d.track) return;
    await this.seek(id, this.position(id) + beats * 60 / (d.track.bpm || 120));
  }
  setDownbeat(id) {
    const d = this.decks[id]; if (!d.track) return;
    this.setGrid(id,{bpm:d.track.bpm||120,downbeat:this.position(id)});
  }
  setGrid(id,grid,{automatic=false,expectedTrack=this.decks[id]?.track,expectedRevision}={}) {
    const track=this.decks[id]?.track;
    if(!track||track!==expectedTrack)throw Error('La piste a changé. Rouvrez sa préparation.');
    if(expectedRevision!==undefined&&gridRevision(track)!==expectedRevision)throw Error('La grille a changé. Rechargez sa préparation.');
    const patch=automatic?automaticGrid(track):{...checkedGrid(grid,track.buffer.duration),manualGrid:true,confidence:'manual'};
    this.cancelTransition();const previousEntry=track.mixIn;
    Object.assign(track,patch);this.refreshArrangement(track);
    if(!track.manualRegions){
      const regions=prepareAnalysisRegions({...track,regionAnalysisVersion:0},track.buffer.duration);
      for(const key of ['mixIn','mixOut','introEnd','outroEnd','regionAnalysisVersion'])track[key]=regions[key];
      for(const deck of this.decks)if(deck.track===track&&Math.abs(deck.cue-previousEntry)<1e-7)deck.cue=track.mixIn;
    }
    this.dispatchEvent(new Event('change'));
    return track;
  }
  async setRate(id, rate,{cancel=true}={}) {
    if(cancel)this.cancelTransition(); const d = this.decks[id], pos=this.position(id);
    if(d.braking){this.pause(id);d.offset=pos;d.rate=clamp(rate,.5,2);await this.play(id);this.dispatchEvent(new Event('change'));return;}
    d.offset=pos; if(this.context)d.started=this.context.currentTime; d.rateRamp=null; d.rate=clamp(rate,0.5,2);
    if(d.source) { d.source.playbackRate.cancelScheduledValues(this.context.currentTime); d.source.playbackRate.setValueAtTime(d.rate,this.context.currentTime); }
    if(d.pitchNode) { d.pitchNode.playbackRate.cancelScheduledValues(this.context.currentTime); d.pitchNode.playbackRate.setValueAtTime(d.rate,this.context.currentTime); }
    this.dispatchEvent(new Event('change'));
  }
  currentRate(id) { const d=this.decks[id],r=d.braking||d.rateRamp; return r?r.from+(r.to-r.from)*clamp((this.context.currentTime-r.start)/r.duration,0,1):d.rate; }
  scheduleRate(id,to,start,duration) {
    const d=this.decks[id]; d.rateRamp={from:d.rate,to,start,duration};
    for(const param of [d.source?.playbackRate,d.pitchNode?.playbackRate].filter(Boolean)) {const at=Math.max(this.context.currentTime,start-(d.latency||0));param.cancelScheduledValues(this.context.currentTime);param.setValueAtTime(d.rate,this.context.currentTime);param.setValueAtTime(d.rate,at);param.linearRampToValueAtTime(to,at+duration); }
  }
  settleRate(id) {
    const d=this.decks[id]; if(!d.rateRamp)return;
    const position=this.position(id),rate=this.currentRate(id);d.offset=position;d.started=this.context.currentTime;d.rate=rate;d.rateRamp=null;
    for(const param of [d.source?.playbackRate,d.pitchNode?.playbackRate].filter(Boolean)) {param.cancelScheduledValues(this.context.currentTime);param.setValueAtTime(rate,this.context.currentTime);}
  }
  async sync(id) {
    const d = this.decks[id], other = this.decks[1 - id];
    if (!d.track?.bpm || !other.track?.bpm) throw new Error('Renseigne le BPM des deux morceaux pour synchroniser.');
    await this.setRate(id, other.track.bpm * other.rate / d.track.bpm);
    const beat = 60 / d.track.bpm;
    const otherPhase = ((this.position(1 - id) - (other.track.beatOffset || 0)) / (60 / other.track.bpm)) % 1;
    const nearest = Math.floor((this.position(id) - (d.track.beatOffset || 0)) / beat);
    await this.seek(id, Math.max(0, (d.track.beatOffset || 0) + (nearest + otherPhase) * beat));
  }
  setCrossfade(x, cancel = true) {
    if (cancel) this.cancelTransition();
    this.crossfade = clamp(x, 0, 1);
    if (!this.context) return;
    crossfadeGains(this.crossfade).forEach((v, i) => {
      const p = this.decks[i].fader.gain; p.cancelScheduledValues(this.context.currentTime);if(this.decks[i].playing)p.setTargetAtTime(v,this.context.currentTime,.008);else p.setValueAtTime(v,this.context.currentTime);
    });
  }
  setVolume(id, volume) { const d = this.decks[id]; d.volume = volume; d.gain?.gain.setTargetAtTime(volume, this.context.currentTime, 0.01); }
  setProgramOptions(patch){this.programOptions=programOptions({...this.programOptions,...patch});this.programBus?.set(this.programOptions);this.pumping?.set(this.programOptions);this.peakLimiter?.port.postMessage({ceilingDb:this.programOptions.ceilingDb});try{globalThis.localStorage?.setItem('sillage:program-v13',JSON.stringify({...this.programOptions,muted:false,dim:false}));}catch{}this.dispatchEvent(new Event('change'));return this.programOptions;}
  setMaster(value) { this.masterVolume = value; this.master?.gain.setTargetAtTime(value, this.context.currentTime, 0.01); }
  setEQ(id, band, value) { const d = this.decks[id]; d.eq[band] = value; [d.low, d.mid, d.high][band]?.gain.setTargetAtTime(value, this.context.currentTime, 0.02); }
  setFilter(id,value){
    const d=this.decks[id];d.filter=value;if(!d.sweep)return;const now=this.context.currentTime;
    for(const [param,freq] of [[d.highpass.frequency,value>0?18*400**value:18],[d.sweep.frequency,value<0?22000*.009**(-value):22000]]){param.cancelScheduledValues(now);param.setTargetAtTime(freq,now,.035);}
  }
  setEcho(id,enabled){
    const d=this.decks[id];d.echo=enabled;if(!d.manualEchoSend)return;const now=this.context.currentTime;
    d.manualEchoSend.gain.cancelScheduledValues(now);d.manualEchoSend.gain.setTargetAtTime(enabled?.22:0,now,.025);
    d.wet.gain.cancelScheduledValues(now);d.wet.gain.setTargetAtTime(enabled?.55:0,now,.08);
    if(d.delay&&!d.echoTailUntil)d.delay.delayTime.setTargetAtTime(30/(d.track?.bpm||120)/d.rate,now,.05);
  }
  loop(id, beats,{quantize=false,cancel=true}={}) {
    const d = this.decks[id]; if (!d.track) return;
    this.releaseContinuity(id);
    if(cancel)this.cancelTransition();
    if (d.loop) {
      // Native BufferSource continues from its audible loop position on release.
      // Rebase the UI clock there too; a slip roll has its own continuing clock.
      const position=this.position(id);this.settleRate(id);d.loop = null;d.offset=position;d.started=this.context?.currentTime||0;
      if (d.source) d.source.loop = false;
    }
    else {
      if(!Number.isFinite(beats)||beats<=0)return;
      const beat = 60 / (d.track.bpm || 120), pos = this.position(id),offset=d.track.downbeat??d.track.beatOffset??0;
      // Quantized capture starts on the next beat/subdivision. Immediate
      // capture preserves the audible cursor instead of jumping back a beat.
      const start=quantize?Math.max(0,nextMusicalTime(pos+(d.latency||0)*d.rate,d.track.bpm||120,offset,Math.min(1,beats))):pos;
      if(start>=d.track.buffer.duration-.005)return;
      d.loop = { start, end: Math.min(start + beats * beat, d.track.buffer.duration) };
      if (d.source) { d.source.loopStart = d.loop.start; d.source.loopEnd = d.loop.end; d.source.loop = true; }
    }
    this.dispatchEvent(new Event('change'));
  }
  setDeckEffect(id,kind,amount){const d=this.decks[id];d.fx?.set(kind,amount,(d.track?.bpm||120)*this.currentRate(id));this.dispatchEvent(new Event('change'));}
  holdForNext(id,{maxSeconds=30}={}){
    const d=this.decks[id];if(d.continuity)return true;
    if(!d.playing||!d.source||d.loop||d.scratching||d.braking||this.transition||this.context.currentTime<d.started)return false;
    const position=this.position(id),window=continuityWindow(d.track,position);if(!window)return false;
    this.settleRate(id);const now=this.context.currentTime,period=(window.end-window.start)/d.rate,firstEdge=now+(window.end-position)/d.rate,seconds=.004;
    const gain=d.voiceGain.gain;gain.cancelScheduledValues(now);gain.setValueAtTime(1,now);
    let lastEdge=firstEdge;
    // Schedule both sides of every seam before the hold starts. These 4 ms
    // ramps run on the audio clock, including when the UI is stalled.
    for(let edge=firstEdge;edge<=now+clamp(maxSeconds,1,30)+period;edge+=period){gain.setValueAtTime(1,edge-seconds);gain.linearRampToValueAtTime(0,edge);gain.linearRampToValueAtTime(1,edge+seconds);lastEdge=edge;}
    d.continuity={track:d.track,armedAt:now,window,fade:{firstEdge,lastEdge,period,seconds}};d.loop=window;
    d.source.loopStart=window.start;d.source.loopEnd=window.end;d.source.loop=true;
    this.dispatchEvent(new Event('change'));return true;
  }
  releaseContinuity(id){
    const d=this.decks[id];if(!d?.continuity)return;
    const held=d.continuity,owned=d.loop===held.window;d.continuity=null;if(!owned)return;
    const position=this.position(id);this.settleRate(id);d.loop=null;d.offset=position;d.started=this.context?.currentTime||0;
    if(d.source)d.source.loop=false;
    if(d.voiceGain&&held.fade){const now=this.context.currentTime,f=held.fade,edge=f.firstEdge+Math.round((now-f.firstEdge)/f.period)*f.period,level=edge>=f.firstEdge&&edge<=f.lastEdge?clamp(Math.abs(now-edge)/f.seconds,0,1):1;const gain=d.voiceGain.gain;gain.cancelScheduledValues(now);gain.setValueAtTime(level,now);gain.linearRampToValueAtTime(1,now+.004);}
    this.dispatchEvent(new Event('change'));
  }
  async roll(id,beats){
    const d=this.decks[id];if(!d.track)return;this.cancelTransition();if(d.roll){await this.endRoll(id);return;}
    if(!d.playing)await this.play(id);if(d.loop)this.loop(id,1);const position=this.position(id),now=this.context.currentTime;
    this.loop(id,beats);d.roll={position,started:now,rate:d.rate,beats};this.dispatchEvent(new Event('change'));
  }
  async endRoll(id,{cancel=true}={}){const d=this.decks[id],r=d.roll;if(!r)return;const position=r.position+Math.max(0,this.context.currentTime-r.started)*r.rate;d.roll=null;await this.seek(id,position,{cancel});}
  async playTexture(kind,options={}){await this.init();return this.textures.play(kind,options);}
  silence(){
    this.cancelTransition();this.pause(0);this.pause(1);this.stopTextures();this.pumping?.reset();if(!this.context)return;const now=this.context.currentTime;
    for(const d of this.decks){d.fx.reset();this.setEcho(d.id,false);d.echoTailUntil=0;for(const p of [d.manualEchoSend.gain,d.echoSend.gain,d.wet.gain,d.verbSend.gain,d.verbWet.gain]){p.cancelScheduledValues(now);p.setValueAtTime(0,now);}}
  }
  stopTextures(){this.textures?.stopAll();if(this.context)stopReferenceFx(this.context);}
  restoreTransition(t,tail){
    const now=this.context.currentTime,a=this.decks[t.source];
    t.referenceFx?.stop({tail});
    for(const d of this.decks){if(!tail){d.trim.gain.cancelScheduledValues(now);d.trim.gain.setTargetAtTime(1,now,.1);}for(const [param,value] of [[d.transitionLow.gain,0],[d.transitionMid.gain,0],[d.transitionHigh.gain,0],[d.transitionHighpass.frequency,0],[d.transitionLowpass.frequency,this.context.sampleRate/2],[d.transitionGate.gain,1]]){param.cancelScheduledValues(now);param.setTargetAtTime(value,now,.015);}}
    for(const d of this.decks){d.stemEchoSend.gain.cancelScheduledValues(now);d.stemEchoSend.gain.setTargetAtTime(0,now,.008);for(const node of Object.values(d.stemTransitionGains||{})){node.gain.cancelScheduledValues(now);node.gain.setTargetAtTime(1,now,.015);}}
    if(t.echoUsed){
      a.feedback.gain.cancelScheduledValues(now);a.feedback.gain.setTargetAtTime(t.previousFeedback,tail&&!t.previousEcho?now+4:now+.05,.02);a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setTargetAtTime(0,now,.008);
      if(tail&&!t.previousEcho){a.echo=false;a.echoTailUntil=now+6;a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setValueAtTime(0,now);a.wet.gain.setTargetAtTime(0,now+1.5,0.6);}
      else {this.setEcho(t.source,t.previousEcho);a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setTargetAtTime(t.previousDelay,now,.025);}
    }
    if(t.verbUsed){a.verbSend.gain.cancelScheduledValues(now);a.verbSend.gain.setTargetAtTime(0,now,0.008);a.verbWet.gain.cancelScheduledValues(now);a.verbWet.gain.setTargetAtTime(0,tail?now+1.8:now,0.08);}
    if(!tail)for(const voice of t.voices||[])this.textures.stop(voice);
  }
  cancelTransition() {
    this.startPreparation=(this.startPreparation||0)+1;
    if (!this.transition || !this.context) return;
    const t = this.transition, p = clamp((this.context.currentTime - t.start) / t.duration, 0, 1);
    this.transition = null;this.settleRate(0);this.settleRate(1);
    const beatProgress=t.tempoBlend?tempoBeats(p*t.duration,t.bpmA,t.bpmB,t.duration)/tempoBeats(t.duration,t.bpmA,t.bpmB,t.duration):p;
    this.crossfade = t.from + (t.to - t.from) * transitionProgress(t.style,beatProgress,t.duration,t.score);
    if(t.incomingStart>this.context.currentTime){this.pause(t.target);this.crossfade=t.from;}
    this.setCrossfade(this.crossfade, false);
    this.restoreTransition(t,false);
  }
  async startTransition(options = {}) {
    if (this.transition || this.starting) return;
    this.starting=true;const preparation=this.startPreparation=(this.startPreparation||0)+1;
    try {
    const {quantize=true,tempoBlend=false}=options;
    try{await this.keyLockProfileChanging;}catch{}
    await this.init();if(preparation!==this.startPreparation)return;
    const source = this.crossfade < 0.5 ? 0 : 1, target = 1 - source;
    const a = this.decks[source], b = this.decks[target];
    if (!a.track || !b.track) throw new Error('Charge un morceau sur chaque platine.');
    const originalA=a.track,originalB=b.track,obsolete=()=>preparation!==this.startPreparation||a.track!==originalA||b.track!==originalB;
    await Promise.all([a,b].map(d=>d.track.ensureAudio&&!d.track.buffer?.getChannelData?d.track.ensureAudio({priority:5}):null));
    if(preparation!==this.startPreparation||a.track!==originalA||b.track!==originalB)return;
    if(a.braking)this.pause(source);if(b.braking)this.pause(target);
    const recovering=Boolean(options.automix&&a.endedNaturally);
    if (!a.playing&&!recovering){const pending=this.play(source),ticket=a.playRequest;await pending;if(obsolete()||!a.playing){if(ticket?.source&&a.source===ticket.source)this.pause(source);return;}}
    // A scheduled transition leaves the loop before calculating its start.
    if(a.roll)await this.endRoll(source,{cancel:false});if(b.roll)await this.endRoll(target,{cancel:false});if(obsolete())return;
    this.releaseContinuity(source);this.releaseContinuity(target);
    if (a.loop) this.loop(source, 4,{cancel:false});
    if (b.loop) this.loop(target, 4,{cancel:false});
    const plan=makeTransitionPlan(a,b,{...options,tempoBlend,history:this.transitionHistory,position:this.position(source),stemsAvailable:Boolean(a.stemGains&&b.track.stemBuffer)});
    if(recovering)Object.assign(plan,{style:'linear',sync:false,tempoBlend:false,seconds:.2,beats:0,inPoint:plan.baseInPoint??plan.inPoint,incomingLanding:null,reason:'Titre sortant terminé : reprise du prochain titre sans relancer le précédent.'});
    const style=plan.style,bridge=['bridge','landing'].includes(style),clean=style==='clean';
    if(plan.sync) await this.setRate(target,plan.rate,{cancel:false});
    else await this.setRate(target,1,{cancel:false});
    if(obsolete())return;
    const now = this.context.currentTime;
    const pos=this.position(source), lookahead=Math.max(.12,(this.keyLockLatency||0)+.04);
    const requestedPoint=options.automix&&!options.startNow&&!recovering?(options.plannedPoint??plan.outPoint??a.track.mixOut??0):0;
    const sourceMeanRate=plan.tempoBlend?(a.rate+plan.bpmB/(a.track.bpm||120))/2:a.rate;
    const previewSeconds=options.startNow?Math.min(plan.seconds,clamp(Number(options.skipBeats)||4,1,16)*60/(plan.tempoBlend?(plan.bpmA+plan.bpmB)/2:plan.bpmA)):plan.seconds;
    const arrivalScore=plan.incomingLanding?makeTransitionScore(plan,{seconds:previewSeconds}):null;
    const alignArrival=Boolean(arrivalScore&&quantize&&gridReliable(a.track)&&!a.track.manualRegions&&(!options.quantizeBeats||options.quantizeBeats===4));
    const canQuantizeSource=!plan.automatic||!options.automix||options.startNow||gridReliable(a.track);
    const alignStart=!recovering&&canQuantizeSource&&quantize&&a.track.bpm&&(!plan.automatic||plan.trustworthy||plan.quantizeHandoff||plan.tempoBlend)&&!(options.automix&&a.track.manualRegions);
    const alignmentOffset=(a.track.downbeat??a.track.beatOffset??0)-(alignArrival?previewSeconds*sourceMeanRate*arrivalScore.handoffFraction:options.automix&&!options.startNow&&plan.score&&gridReliable(a.track)?plan.sourceSpanSeconds*plan.score.handoffFraction:0);
    const targetPosition=alignStart?nextMusicalTime(Math.max(pos+lookahead*a.rate,requestedPoint),a.track.bpm,alignmentOffset,options.quantizeBeats||(alignArrival?4:options.startNow?1:4)):Math.max(pos+lookahead*a.rate,requestedPoint);
    const endPosition=Math.min(a.track.audibleEnd||a.track.buffer.duration,a.track.buffer.duration);
    const remaining=(endPosition-pos)/a.rate;
    const delay=(targetPosition-pos)/a.rate;
    // Prefer a short immediate handover when the next measure is past the ending.
    const transportWait=Math.max(0,a.started-now);
    const start=now+transportWait+(delay+0.1<remaining?delay:Math.max(0,Math.min(lookahead,remaining-0.1)));
    const availableA=recovering?Infinity:Math.max(0,endPosition-pos-Math.max(0,start-now-transportWait)*a.rate)/sourceMeanRate-.02;
    let fallbackCue=plan.baseInPoint??plan.inPoint??b.track.mixIn??b.cue;
    if(quantize&&plan.sync&&b.track.bpm&&(!plan.preserveInPoint||plan.incomingLanding)&&!b.track.manualRegions){
      const quantum=plan.incomingQuantizeBeats||4,rawBeat=(targetPosition-(a.track.downbeat??a.track.beatOffset??0))*(a.track.bpm||120)/60,sourceBeat=Math.abs(rawBeat-Math.round(rawBeat))<1e-6?Math.round(rawBeat):rawBeat,phase=((sourceBeat%4)+4)%4/4;
      const aligned=nextMusicalTime(fallbackCue,b.track.bpm,(b.track.downbeat??b.track.beatOffset??0)+phase*quantum*60/b.track.bpm,quantum);
      if(aligned<b.track.buffer.duration-.05)fallbackCue=aligned;
    }
    let incomingCue=plan.incomingLanding?plan.inPoint:fallbackCue;
    const targetMeanRate=plan.tempoBlend?(b.rate+1)/2:b.rate,availableB=(b.track.buffer.duration-incomingCue)/Math.max(.01,targetMeanRate);
    const nominal=plan.seconds;
    const requested=options.startNow?Math.min(nominal,clamp(Number(options.skipBeats)||4,1,16)*60/(plan.tempoBlend?(plan.bpmA+plan.bpmB)/2:plan.bpmA)):nominal;
    const sourcePart=clean?cleanTiming(requested).sourceStopFraction:bridge?.48:1,incomingPart=clean?.25:bridge?.5:1;
    const bounded=Math.max(.05,Math.min(requested,Math.max(.05,availableA)/sourcePart,availableB/incomingPart)),barSeconds=4*60/(plan.tempoBlend?(plan.bpmA+plan.bpmB)/2:plan.bpmA);
    const duration=plan.automatic&&plan.sync&&bounded>=barSeconds?Math.max(barSeconds,Math.floor((bounded+1e-6)/barSeconds)*barSeconds):bounded;
    const runtimeScore=makeTransitionScore(plan,{seconds:duration,intensity:options.intensity});
    const sourceHandoff=pos+Math.max(0,start-now-transportWait)*a.rate+duration*sourceMeanRate*(runtimeScore?.handoffFraction||0),sourcePhase=(sourceHandoff-(a.track.downbeat??a.track.beatOffset??0))*(a.track.bpm||120)/240;
    const safeArrival=!quantize||alignArrival&&Math.abs(sourcePhase-Math.round(sourcePhase))<1e-5;
    const incomingLanding=safeArrival?runtimeIncomingLanding(b.track,plan,runtimeScore,duration):null;
    incomingCue=incomingLanding?.cue??fallbackCue;
    if(b.playing)this.pause(target);
    b.offset=incomingCue;const timing=clean?cleanTiming(duration):null,incomingStart=start+duration*(clean?timing.incomingStartFraction:bridge?.5:0);const incoming=this.play(target,incomingStart),incomingTicket=b.playRequest;await incoming;
    if(obsolete()||!b.playing){if(incomingTicket?.source&&b.source===incomingTicket.source)this.pause(target);return;}
    const from = this.crossfade, to = target;
    this.transition = { source, target, from, to, start, duration, style, fallback:plan.fallback,tempoBlend:plan.tempoBlend };
    if(plan.tempoBlend) {this.scheduleRate(source,plan.bpmB/(a.track.bpm||120),start,duration);this.scheduleRate(target,1,start,duration);}
    const t=this.transition;t.reason=plan.reason;t.stages=plan.stages;t.incomingStart=incomingStart;t.inPoint=incomingCue;t.outPoint=pos+Math.max(0,start-now-transportWait)*a.rate;t.beats=plan.beats;t.profile=plan.profile;t.effectSelection=plan.effectSelection;t.titleA=a.track.title;t.titleB=b.track.title;t.intensity=clamp(Number(options.intensity??0.45),0,1);t.previousEcho=Boolean(a.echo);t.previousDelay=a.delay.delayTime.value;t.previousFeedback=a.feedback.gain.value;t.voices=[];t.trimDb=plan.trimDb;t.sync=plan.sync;t.bpmA=plan.bpmA;t.bpmB=plan.bpmB;
    const at=fraction=>start+(plan.tempoBlend?tempoFraction(fraction,plan.bpmA,plan.bpmB,duration):duration*fraction);
    t.sourceSpanSeconds=duration*sourceMeanRate;
    t.score=runtimeScore;t.incomingLanding=incomingLanding;
    if(plan.incomingLanding&&!incomingLanding)t.reason=plan.baseReason+' Repère entrant écarté : passage raccourci ou calage indisponible.';
    if(incomingLanding)t.incomingLandingAt=at(incomingLanding.handoffFraction);
    if(t.score){t.beats=t.score.beats;t.stages=t.score.stages.map(stage=>({...stage,at:(at(stage.at)-start)/duration}));t.handoffAt=at(t.score.handoffFraction);t.handoffPosition=t.outPoint+t.sourceSpanSeconds*t.score.handoffFraction;}
    if(clean)Object.assign(t,timing,{handoffPosition:t.outPoint+duration*timing.handoffFraction*a.rate});
    b.trim.gain.cancelScheduledValues(now);b.trim.gain.setValueAtTime(10**(plan.trimDb/20),now);b.trim.gain.setValueAtTime(10**(plan.trimDb/20),start+duration);b.trim.gain.linearRampToValueAtTime(1,start+duration+8);
    const rawCurves=faderCurves(from,to,style,duration,clean?4096:1024,t.score),curves=plan.tempoBlend?rawCurves.map(curve=>warpTempoCurve(curve,plan.bpmA,plan.bpmB,duration)):rawCurves;
    for(let id=0;id<2;id++){const gain=this.decks[id].fader.gain;gain.cancelScheduledValues(now);gain.setValueAtTime(crossfadeGains(from)[id],now);gain.setValueCurveAtTime(curves[id],start,duration);}
    const level=t.intensity;
    scheduleTransitionScore(this.context,{score:t.score,a,b,t,start,duration,at});
    if(clean){
      // Keep the complete outgoing groove until the relay. Capture only the
      // last beat, through the damped echo, instead of washing out several bars.
      const beat=60/plan.bpmA,capture=Math.max(start,incomingStart-beat),ramp=Math.min(.06,beat*.2);
      t.echoUsed=true;a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setValueAtTime(beat,now);
      a.feedback.gain.cancelScheduledValues(now);a.feedback.gain.setValueAtTime(.22,now);
      a.wet.gain.cancelScheduledValues(now);a.wet.gain.setValueAtTime(.24,now);
      a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setValueAtTime(0,now);a.echoSend.gain.setValueAtTime(0,capture);
      a.echoSend.gain.linearRampToValueAtTime(.12+level*.12,Math.min(incomingStart,capture+ramp));
      a.echoSend.gain.setValueAtTime(.12+level*.12,incomingStart);a.echoSend.gain.linearRampToValueAtTime(0,incomingStart+timing.fadeSeconds);
      a.transitionLow.gain.cancelScheduledValues(now);a.transitionLow.gain.setValueAtTime(0,start);a.transitionLow.gain.setValueAtTime(0,Math.max(start,incomingStart-.035));a.transitionLow.gain.linearRampToValueAtTime(-12,incomingStart+timing.fadeSeconds);
    }
    if(bridge){
      a.transitionLow.gain.cancelScheduledValues(now);a.transitionLow.gain.setValueAtTime(0,start);a.transitionLow.gain.linearRampToValueAtTime(-18,start+duration*.42);
      a.transitionHighpass.frequency.cancelScheduledValues(now);a.transitionHighpass.frequency.setValueAtTime(18,start);a.transitionHighpass.frequency.exponentialRampToValueAtTime(450+level*700,start+duration*.43);
      t.echoUsed=true;a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setValueAtTime(60/plan.bpmA,now);a.feedback.gain.cancelScheduledValues(now);a.feedback.gain.setValueAtTime(.5+level*.08,now);a.wet.gain.cancelScheduledValues(now);a.wet.gain.setValueAtTime(.85,now);
      a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setValueAtTime(0,now);a.echoSend.gain.setValueAtTime(0,start+duration*.25);a.echoSend.gain.linearRampToValueAtTime(.5+level*.3,start+duration*.36);a.echoSend.gain.setValueAtTime(.5+level*.3,start+duration*.4);a.echoSend.gain.linearRampToValueAtTime(0,start+duration*.45);
      if(style==='landing'){
        t.verbUsed=true;a.verbWet.gain.cancelScheduledValues(now);a.verbWet.gain.setValueAtTime(.55+level*.3,now);a.verbSend.gain.cancelScheduledValues(now);a.verbSend.gain.setValueAtTime(0,now);a.verbSend.gain.setValueAtTime(0,start+duration*.22);a.verbSend.gain.linearRampToValueAtTime(.65,start+duration*.36);a.verbSend.gain.linearRampToValueAtTime(0,start+duration*.46);
        b.transitionHighpass.frequency.cancelScheduledValues(now);b.transitionHighpass.frequency.setValueAtTime(180,start);b.transitionHighpass.frequency.setValueAtTime(180,incomingStart);b.transitionHighpass.frequency.exponentialRampToValueAtTime(18,start+duration*.7);
      }
    }
    if(!t.score&&['bass','dissolve','phrase'].includes(style)){
      const eq=eqCurves(style==='phrase'?'bass':style);
      for(const [d,side] of [[a,'out'],[b,'in']])for(const [band,node] of [d.transitionLow,d.transitionMid,d.transitionHigh].entries()){
        node.gain.cancelScheduledValues(now);node.gain.setValueAtTime(eq[side][band][0],now);node.gain.setValueCurveAtTime(plan.tempoBlend?warpTempoCurve(eq[side][band],plan.bpmA,plan.bpmB,duration):eq[side][band],start,duration);
      }
      if(style==='phrase'){
        t.echoUsed=true;a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setValueAtTime(60/plan.bpmA,now);a.feedback.gain.cancelScheduledValues(now);a.feedback.gain.setValueAtTime(.32,now);a.wet.gain.cancelScheduledValues(now);a.wet.gain.setValueAtTime(.4,now);
        a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setValueAtTime(0,now);a.echoSend.gain.setValueAtTime(0,start+duration*.67);a.echoSend.gain.linearRampToValueAtTime(.08+level*.12,start+duration*.75);a.echoSend.gain.linearRampToValueAtTime(0,start+duration);
      }
    }
    if(style==='slam'){
      const mid=0.7;
      b.transitionLow.gain.setValueAtTime(-18,now);b.transitionLow.gain.setValueAtTime(-18,start+duration*(mid-0.1));b.transitionLow.gain.linearRampToValueAtTime(0,start+duration*(mid+0.1));
      a.transitionLow.gain.setValueAtTime(0,now);a.transitionLow.gain.setValueAtTime(0,start+duration*(mid-0.1));a.transitionLow.gain.linearRampToValueAtTime(-18,start+duration*(mid+0.1));
    }
    if(!t.score&&['filter','riser'].includes(style)){
      // The sweep reaches the upper spectrum while the outgoing deck is still
      // present. Previously its cutoff rose mainly after that deck had faded.
      const frequency=a.transitionHighpass.frequency;frequency.cancelScheduledValues(now);frequency.setValueAtTime(18,start);frequency.exponentialRampToValueAtTime(90,at(.15));frequency.exponentialRampToValueAtTime(2500+level*2500,at(.52));frequency.exponentialRampToValueAtTime(6500+level*3000,at(.8));frequency.exponentialRampToValueAtTime(Math.min(this.context.sampleRate*.45,10000+level*2500),start+duration);t.filterSource=true;
      // The incoming bass is available throughout this sweep, rather than
      // applying opposing high-passes to both decks and thinning the handover.
      t.echoUsed=true;a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setValueAtTime(30/plan.bpmA,now);a.feedback.gain.cancelScheduledValues(now);a.feedback.gain.setValueAtTime(.30,now);a.wet.gain.cancelScheduledValues(now);a.wet.gain.setValueAtTime(.50,now);a.echoSend.gain.cancelScheduledValues(now);a.echoSend.gain.setValueAtTime(0,now);a.echoSend.gain.setValueAtTime(0,at(.12));a.echoSend.gain.linearRampToValueAtTime(.18+level*.16,at(.34));a.echoSend.gain.linearRampToValueAtTime(0,at(.62));
      if(style==='riser'){
        // A short suspension gives the sweep a destination: the incoming bass
        // returns at its crest instead of masking the entire build-up.
        b.transitionLow.gain.cancelScheduledValues(now);b.transitionLow.gain.setValueAtTime(-6-level*8,start);b.transitionLow.gain.setValueAtTime(-6-level*8,at(.54));b.transitionLow.gain.linearRampToValueAtTime(0,at(.78));
        t.stages=[{at:0,label:'Caler les tempos'},{at:(at(.15)-start)/duration,label:'Ouvrir le filtre'},{at:(at(.54)-start)/duration,label:'Monter le souffle'},{at:(at(.78)-start)/duration,label:'Relâcher les graves'}];
      }
    }
    if(style==='space'){a.transitionHighpass.frequency.cancelScheduledValues(now);a.transitionHighpass.frequency.setValueAtTime(18,start);a.transitionHighpass.frequency.exponentialRampToValueAtTime(1500+level*3500,start+duration*.8);t.filterSource=true;}
    if(style==='lowpass'){a.transitionLowpass.frequency.cancelScheduledValues(now);a.transitionLowpass.frequency.setValueAtTime(20000,start);a.transitionLowpass.frequency.exponentialRampToValueAtTime(220,start+duration);t.filterSource=true;}
    if(style==='downlift'){b.transitionLowpass.frequency.cancelScheduledValues(now);b.transitionLowpass.frequency.setValueAtTime(450,start);b.transitionLowpass.frequency.exponentialRampToValueAtTime(20000,start+duration);t.filterTarget=true;}
    if(['stemfade','stemecho'].includes(style)){
      const ramp=(from,to,begin,end)=>Float32Array.from({length:1024},(_,i)=>from+(to-from)*clamp((i/1023-begin)/(end-begin),0,1));
      for(const [deck,name,values] of [[a,'vocals',ramp(1,0,.08,.38)],[b,'vocals',ramp(0,1,.62,.92)],[a,'drums',ramp(1,0,.55,.8)],[b,'drums',ramp(0,1,.15,.5)],[a,'bass',ramp(1,0,.4,.6)],[b,'bass',ramp(0,1,.4,.6)]]){
        const p=deck.stemTransitionGains[name].gain;p.cancelScheduledValues(now);p.setValueAtTime(values[0],now);p.setValueCurveAtTime(values,start,duration);
      }
    }
    if(!t.score&&['echo','dub','stemecho'].includes(style)){
      t.echoUsed=true;a.wet.gain.cancelScheduledValues(now);a.wet.gain.setValueAtTime(style==='dub'?.68:.60,now);a.feedback.gain.setValueAtTime(style==='dub'?0.46:0.28,now);a.delay.delayTime.setValueAtTime((style==='dub'?45:60)/plan.bpmA,now);
      const send=style==='stemecho'?a.stemEchoSend:a.echoSend,compensation=style==='stemecho'?(a.track.autoGain||1)*a.volume:1;
      // Capture a distinct beat into the return, then let its repeats decay over
      // the new groove. A late tiny send over a full-length fade hid the effect.
      const begin=style==='stemecho'?.08:style==='dub'?.28:.40,peak=style==='stemecho'?.35:style==='dub'?.48:.56,stop=style==='stemecho'?.5:style==='dub'?.72:.68;
      send.gain.cancelScheduledValues(now);send.gain.setValueAtTime(0,now);send.gain.setValueAtTime(0,start+duration*begin);send.gain.linearRampToValueAtTime((.28+level*.32)*compensation,start+duration*peak);send.gain.linearRampToValueAtTime(0,start+duration*stop);
      if(style==='dub'){a.transitionHighpass.frequency.cancelScheduledValues(now);a.transitionHighpass.frequency.setValueAtTime(18,start);a.transitionHighpass.frequency.exponentialRampToValueAtTime(650+level*600,start+duration*.72);}
    }
    if(['reverb','space'].includes(style)){
      t.verbUsed=true;a.verbWet.gain.cancelScheduledValues(now);a.verbWet.gain.setValueAtTime(.64,now);a.verbSend.gain.cancelScheduledValues(now);a.verbSend.gain.setValueAtTime(0,now);a.verbSend.gain.setValueAtTime(0,start+duration*.18);a.verbSend.gain.linearRampToValueAtTime(.22+level*.28,start+duration*.54);a.verbSend.gain.linearRampToValueAtTime(0,start+duration*.88);
      a.transitionLow.gain.cancelScheduledValues(now);a.transitionLow.gain.setValueAtTime(0,start);a.transitionLow.gain.linearRampToValueAtTime(-12,start+duration*.7);
    }
    if(['stutter','tremolo'].includes(style)){
      const values=Float32Array.from({length:2048},(_,i)=>{const p=i/2047,seconds=p*duration,beats=plan.tempoBlend?tempoBeats(seconds,plan.bpmA,plan.bpmB,duration):seconds*plan.bpmA/60,depth=Math.min(1,p*2)*level;return style==='tremolo'?1-depth*0.8*(0.5-0.5*Math.cos(beats*Math.PI*2)):p<0.3?1:1-depth*(.5-.5*Math.tanh(Math.cos(beats*Math.PI*4)*4));});
      a.transitionGate.gain.cancelScheduledValues(now);a.transitionGate.gain.setValueCurveAtTime(values,start,duration);
    }
    const texture=['filter','riser'].includes(style)?'rise':style==='downlift'?'fall':style==='slam'?'impact':null;
    if(!t.score&&texture&&level>0){const sweep=['filter','riser'].includes(style),fxStart=style==='slam'?at(.72):sweep?at(.1):start,fxDuration=style==='slam'?Math.min(1.3,duration*.28):sweep?at(.78)-fxStart:duration;t.voices.push(this.textures.play(texture,{start:fxStart,duration:fxDuration,intensity:level*(sweep?.95:.7)}));if(style==='riser')t.voices.push(this.textures.play('fall',{start:at(.78),duration:Math.max(.08,Math.min(2.5,at(1)-at(.78))),intensity:level*.30}));}
    if(t.score?.texture&&level>0){const fx=t.score.texture;t.voices.push(this.textures.play('rise',{start:at(fx.begin),duration:at(fx.end)-at(fx.begin),intensity:fx.amount}));t.voices.push(this.textures.play('fall',{start:at(fx.end),duration:at(fx.releaseEnd)-at(fx.end),intensity:fx.amount*.28}));}
    if(plan.tempoBlend&&t.echoUsed){
      const division=t.score?.echo?.division??(['filter','riser'].includes(style)?.5:style==='dub'?.75:1);
      // Delay taps follow the integral of the changing beat clock; using the
      // original fixed delay made repeats drift away during tempo morphs.
      const values=Float32Array.from({length:256},(_,i)=>tempoDelay(duration*i/255,division,plan.bpmA,plan.bpmB,duration));
      a.delay.delayTime.cancelScheduledValues(now);a.delay.delayTime.setValueAtTime(values[0],now);a.delay.delayTime.setValueCurveAtTime(values,start,duration);
    }
    t.referenceFx=scheduleReferenceFx(this.context,{a,b,t,plan,start,duration,level,musicBus:this.musicBus,textures:this.textures,at});
    if(!t.score&&plan.automatic&&plan.profile==='musical'&&level>0&&['clean','bass','phrase','stemfade','stemecho'].includes(style)){
      // A measured automatic relay can carry a controlled accent without
      // choosing a random replacement style or stretching an uncertain grid.
      const edge=clean?incomingStart:start+duration*.82,beat=60/plan.bpmA,span=Math.min(duration*.35,beat*3),begin=Math.max(start,edge-span*.85);
      t.voices.push(this.textures.play('rise',{start:begin,duration:span,intensity:level*.38}));t.accent='filtered-rise';
      const frequency=a.transitionHighpass.frequency,sweep=Math.min(.18,beat*.35);frequency.cancelScheduledValues(now);frequency.setValueAtTime(18,start);frequency.setValueAtTime(18,Math.max(start,edge-(clean?sweep:beat)));frequency.exponentialRampToValueAtTime(clean?1800:800,Math.min(start+duration,edge+(clean?timing.fadeSeconds:beat*.25)));
      t.reason+=' Souffle filtré dosé autour du relais.';
    }
    this.dispatchEvent(new Event('change'));
    } finally {this.starting=false;this.dispatchEvent(new Event('change'));}
  }
  tick() {
    if (!this.transition) return null;
    const t = this.transition, progress = this.context.currentTime >= t.start + t.duration - 0.000001 ? 1 : clamp((this.context.currentTime - t.start) / t.duration, 0, 1);
    const beatProgress=t.tempoBlend?tempoBeats(progress*t.duration,t.bpmA,t.bpmB,t.duration)/tempoBeats(t.duration,t.bpmA,t.bpmB,t.duration):progress;
    this.crossfade = t.from + (t.to - t.from) * transitionProgress(t.style,beatProgress,t.duration,t.score);
    if (progress >= 1) {
      this.settleRate(0);this.settleRate(1);
      this.transition = null; this.pause(t.source); this.decks[t.source].offset = 0;
      this.setCrossfade(t.to, false); this.setEQ(t.source, 0, this.decks[t.source].eq[0]); this.setEQ(t.target, 0, this.decks[t.target].eq[0]);
      this.restoreTransition(t,true);this.transitionHistory.push(t.style);this.transitionHistory=this.transitionHistory.slice(-8);
      this.performanceLog.push({at:Date.now(),from:t.titleA,to:t.titleB,style:t.style,profile:t.profile,effectSelection:t.effectSelection,seconds:t.duration,beats:t.beats,sync:t.sync,trimDb:t.trimDb,reason:t.reason});this.performanceLog=this.performanceLog.slice(-100);
      this.dispatchEvent(new CustomEvent('transitionend', { detail: t }));
      this.dispatchEvent(new Event('change'));
    }
    return progress;
  }
}

// All demo audio is synthesized locally; no copyrighted recordings or downloads.
export function createDemo(context, { title, bpm, root, color, variant }) {
  const sampleRate = context.sampleRate, duration = 64 * 60 / bpm, buffer = context.createBuffer(2, Math.ceil(duration * sampleRate), sampleRate);
  let seed = 1234 + variant;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate, beat = t * bpm / 60, phase = beat % 1, bar = Math.floor(beat / 4);
      const kickTime = phase * 60 / bpm;
      const kick = Math.sin(2 * Math.PI * (47 * kickTime + 2.5 * (1 - Math.exp(-kickTime * 35)))) * Math.exp(-kickTime * 15) * 0.65;
      const hatPhase = (beat * 2) % 1, hat = (random() * 2 - 1) * Math.exp(-hatPhase * 35) * 0.12;
      const clap = Math.floor(beat) % 2 === 1 ? (random() * 2 - 1) * Math.exp(-phase * 24) * 0.16 : 0;
      const note = [0, 0, 7, 3][bar % 4], freq = root * 2 ** (note / 12);
      const bass = Math.sin(2 * Math.PI * freq * t) * Math.exp(-phase * 5) * 0.2;
      const arpStep = [0, 7, 12, 15, 12, 7, 3, 10][Math.floor(beat * 2 + variant) % 8];
      const arp = Math.sin(2 * Math.PI * root * 4 * 2 ** (arpStep / 12) * t + channel * 0.15) * Math.exp(-hatPhase * 5) * 0.055;
      const fade = Math.min(1, t * 10, (duration - t) * 10);
      data[i] = Math.tanh((kick + hat + clap + bass + arp) * fade) * 0.8;
    }
  }
  let energy=0;for(const x of buffer.getChannelData(0))energy+=x*x;
  return { rms:Math.sqrt(energy/buffer.getChannelData(0).length), id: `demo-${variant}`, title, artist: 'Sillage Sessions · Démo originale', bpm, beatOffset: 0, downbeat:0,mixIn:0,mixOut:duration-16*60/bpm,audibleEnd:duration,autoGain:0.85,confidence:'generated', source: 'demo', color, buffer, peaks: waveformPeaks(buffer.getChannelData(0),4096) };
}
