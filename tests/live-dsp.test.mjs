import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {GateLimiter,TonalDetector,minimumDuck,compressorReduction} from '../public/live-dsp.mjs';
import {DuckEnvelope} from '../public/duck-math.mjs';
function advance(processor,seconds,sample){let output;for(let i=0;i<Math.round(processor.sampleRate*seconds);i++)output=processor.processStereo(sample,-sample);return output;}
test('the gate rejects sustained low noise and passes speech with hold and gradual closing',()=>{
 const processor=new GateLimiter(48000,{gateEnabled:true,gateThresholdDb:-45,gateRangeDb:70,gateAttackMs:5,gateHoldMs:80,gateReleaseMs:30,limitEnabled:false});
 advance(processor,.5,.0001);assert.ok(Math.abs(processor.output[0])<1e-6);assert.equal(processor.open,false);
 advance(processor,.1,.1);assert.ok(processor.output[0]>.095);assert.equal(processor.open,true);
 advance(processor,.04,.0001);assert.equal(processor.open,true);advance(processor,.4,.0001);assert.equal(processor.open,false);assert.ok(Math.abs(processor.output[0])<1e-6);
});
test('the linked stereo limiter holds its ceiling after makeup, handles NaNs and releases smoothly',()=>{
 const processor=new GateLimiter(48000,{ceilingDb:-3,makeupDb:18,limitReleaseMs:80});
 for(const value of [.2,4,-10,Infinity,NaN]){const out=advance(processor,.01,value);assert.ok([...out].every(v=>Number.isFinite(v)&&Math.abs(v)<=10**(-3/20)+1e-10));}
 const held=processor.limitGain;advance(processor,.01,.01);assert.ok(processor.limitGain>=held&&processor.limitGain<1);advance(processor,1,.01);assert.ok(processor.limitGain>.999);
});
test('compressor ratio and soft knee have an explicit dB transfer and no automatic makeup',()=>{
 const hard={compThresholdDb:-24,compRatio:4,compKneeDb:0};assert.equal(compressorReduction(-30,hard),0);assert.equal(compressorReduction(-12,hard),9);
 const soft={...hard,compKneeDb:12};assert.equal(compressorReduction(-30,soft),0);assert.equal(compressorReduction(-24,soft),1.125);assert.equal(compressorReduction(-18,soft),4.5);
 const processor=new GateLimiter(48000,{...hard,compress:true,limitEnabled:false,compAttackMs:5,compReleaseMs:80,makeupDb:0});advance(processor,.8,.4);const ratio=processor.output[0]/.4,expected=10**(-compressorReduction(20*Math.log10(.4),hard)/20);assert.ok(Math.abs(ratio-expected)<.0001);
});
test('sustained tonal prominence is required before suggesting a feedback filter',()=>{
 const detector=new TonalDetector(),spectrum=new Float32Array(4096).fill(-70),index=Math.round(1800/(48000/8192));spectrum[index]=-15;
 const options={autoNotchThresholdDb:-25,autoNotchProminenceDb:15,autoNotchHoldMs:700,autoNotchQ:20,autoNotchDepthDb:-9};
 assert.equal(detector.inspect(spectrum,48000,8192,2000,options),null);assert.equal(detector.inspect(spectrum,48000,8192,2500,options),null);
 const found=detector.inspect(spectrum,48000,8192,2800,options);assert.ok(Math.abs(found.frequency-1800)<10);assert.equal(found.Q,20);assert.equal(found.depthDb,-9);
 spectrum.fill(-20);assert.equal(detector.inspect(spectrum,48000,8192,5000,options),null);
});
test('manual duck mode respects predelay and a smooth envelope independently of input sound',()=>{
 const gate=new DuckEnvelope(1000,{enabled:true,triggerMode:'manual',manualActive:true,preDelayMs:100,attackMs:100,releaseMs:200,holdMs:0,curve:'smooth',depthDb:20});
 for(let i=0;i<99;i++)gate.step(0);assert.equal(gate.gain,1);for(let i=0;i<101;i++)gate.step(0);assert.ok(Math.abs(gate.gain-.1)<1e-9);
 gate.setOptions({manualActive:false});for(let i=0;i<200;i++)gate.step(1);assert.ok(Math.abs(gate.gain-1)<1e-9);
});
test('the actual four-input worklet takes the deepest duck, then preserves the remaining channel after disconnect',async()=>{
 assert.equal(minimumDuck([-.75,-.5]),-.75);assert.equal(minimumDuck([0,-.5]),-.5);
 let Processor;const source=(await fs.readFile(new URL('../public/duck-mixer-worklet.js',import.meta.url),'utf8')).replace("import {minimumDuck} from './live-dsp.mjs';",'');
 vm.runInNewContext(source,{sampleRate:48000,Math,Number,AudioWorkletProcessor:class{constructor(){this.port={postMessage(){}};}},registerProcessor(_id,klass){Processor=klass;}});
 const processor=new Processor(),a=new Float32Array(128).fill(-.75),b=new Float32Array(128).fill(-.5),out=new Float32Array(128);
 for(let i=0;i<10;i++)processor.process([[a],[b],[],[]],[[out]]);assert.ok(Math.abs(out[127]+.75)<1e-6);assert.ok(out.every(v=>v>=-1&&v<=0));
 for(let i=0;i<10;i++)processor.process([[],[b],[],[]],[[out]]);assert.ok(Math.abs(out[127]+.5)<1e-6);
});
