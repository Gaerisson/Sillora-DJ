import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {DuckEnvelope,duckOptions} from '../public/duck-math.mjs';
import {AudioIO} from '../public/audio-io.js';
import {LiveMixer} from '../public/live-mixer.js';

const advance=(gate,seconds,power)=>{for(let frame=0;frame<Math.round(seconds*gate.sampleRate);frame++)gate.step(power);return gate.gain;};
test('voice ducking has bounded attack, hold, release and noise hysteresis',()=>{
 const gate=new DuckEnvelope(48000,{enabled:true,thresholdDb:-36,depthDb:12,attackMs:20,holdMs:200,releaseMs:200});
 advance(gate,.3,1e-5);assert.equal(gate.voicing,false);assert.equal(gate.gain,1);
 advance(gate,.15,.01);assert.equal(gate.voicing,true);assert.ok(Math.abs(gate.gain-10**(-12/20))<.002);
 const ducked=gate.gain;advance(gate,.1,0);assert.equal(gate.voicing,true);assert.ok(gate.gain<=ducked+.001);
 advance(gate,.4,0);assert.equal(gate.voicing,false);assert.ok(gate.gain>.7&&gate.gain<1);
 advance(gate,1.5,0);assert.ok(gate.gain>.999);
});
test('disabled ducking never attenuates and invalid configuration/samples stay finite',()=>{
 const gate=new DuckEnvelope(44100,{enabled:false,depthDb:24});advance(gate,.5,1);assert.equal(gate.gain,1);
 gate.setOptions({enabled:true,attackMs:NaN,depthDb:Infinity,releaseMs:-1,holdMs:NaN});
 for(let i=0;i<20000;i++){const value=gate.step(i%2?NaN:Infinity);assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}
 assert.equal(duckOptions({depthDb:100}).depthDb,60);assert.equal(duckOptions({attackMs:0}).attackMs,5);
});
test('the real duck worklet emits a DC gain control, reports meter values and releases after speech',async()=>{
 let Processor;const code=(await fs.readFile(new URL('../public/duck-worklet.js',import.meta.url),'utf8')).replace("import {DuckEnvelope} from './duck-math.mjs';",'');
 vm.runInNewContext(code,{DuckEnvelope,sampleRate:48000,Math,Number,AudioWorkletProcessor:class{constructor(){this.messages=[];this.port={postMessage:message=>this.messages.push(message)};}},registerProcessor(_name,klass){Processor=klass;}});
 const processor=new Processor();processor.port.onmessage({data:{type:'options',value:{enabled:true,depthDb:18,attackMs:10,holdMs:0,releaseMs:50}}});
 const input=new Float32Array(128).fill(.1),out=new Float32Array(128);
 for(let block=0;block<150;block++)processor.process([[input]],[[out]]);
 assert.ok(out.every(sample=>Number.isFinite(sample)&&sample<=0&&sample>=-1));assert.ok(Math.abs(out[127]+1-10**(-18/20))<.001);
 assert.ok(processor.messages.some(message=>message.voicing&&message.reductionDb>17));
 input.fill(0);for(let block=0;block<250;block++)processor.process([[input]],[[out]]);assert.ok(Math.abs(out[127])<.0001);
});

class Param{value=1;events=[];setTargetAtTime(value,time,tau){this.value=value;this.events.push({value,time,tau});}setValueAtTime(value,time){this.value=value;this.events.push({value,time});}cancelScheduledValues(){}}
class Node{gain=new Param();frequency=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();connections=[];connect(target){this.connections.push(target);return target;}disconnect(){this.disconnected=true;this.connections=[];}}
class Worklet extends Node{constructor(){super();this.messages=[];this.port={postMessage:message=>this.messages.push(message),close:()=>{this.closed=true;}};}}
class Track extends EventTarget{stopped=0;stop(){this.stopped++;}}
class Media extends EventTarget{
 constructor(){super();this.calls=[];this.track=new Track();this.stream={getTracks:()=>[this.track]};this.devices=[{kind:'audioinput',deviceId:'mic',label:'Micro USB'},{kind:'audiooutput',deviceId:'speakers',label:'Casque USB'}];}
 async enumerateDevices(){return this.devices;}
 async getUserMedia(options){this.calls.push(options);return this.stream;}
}
function fixture(saved={}){
 const media=new Media(),store=new Map([['sillage:audio-io-v11',JSON.stringify(saved)]]),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const context={currentTime:0,sampleRate:48000,sinkId:'',audioWorklet:{addModule:async()=>{}},createGain:()=>new Node(),createBiquadFilter:()=>new Node(),createDynamicsCompressor:()=>new Node(),createMediaStreamSource:()=>new Node(),createAnalyser:()=>new Node(),async setSinkId(id){if(id==='missing')throw Error('NotFound');this.sinkId=id;}};
 const engine={context,musicBus:new Node(),master:new Node(),async init(){return context;}};
 return{io:new AudioIO(engine,{mediaDevices:media,storage,window:null}),media,engine,store};
}
globalThis.AudioWorkletNode=Worklet;

test('startup never captures or monitors; armed analysis is silent until talk and monitor are explicit',async()=>{
 const {io,media,engine}=fixture({monitor:true,duckEnabled:true,inputDeviceId:'mic'});
 assert.equal(media.calls.length,0);assert.equal(io.state.armed,false);assert.equal(io.state.monitor,false);assert.equal(io.state.talking,false);
 await io.startInput();assert.equal(media.calls[0].audio.deviceId.exact,'mic');assert.equal(media.calls[0].video,false);
 assert.equal(io.graph.send.gain.value,0);assert.equal(io.graph.duck.messages.at(-1).value.enabled,false);
 assert.throws(()=>io.setTalk(true,{remote:true}),/localement/);
 io.setTalk(true);assert.equal(io.graph.send.gain.value,0);
 io.setOptions({monitor:true});assert.equal(io.graph.send.gain.value,1);assert.equal(io.graph.duck.messages.at(-1).value.enabled,true);
 assert.ok(io.graph.duck.connections.includes(engine.musicBus.gain));assert.ok(io.graph.send.connections.includes(engine.master));
 io.setTalk(false);assert.equal(io.graph.send.gain.value,0);assert.equal(io.graph.duck.messages.at(-1).value.enabled,false);
 io.dispose();assert.equal(media.track.stopped,1);
});
test('stopping and device-ended events close every node/track and restore only the musical gain',async()=>{
 const {io,media,engine}=fixture();await io.startInput();const graph=io.graph;io.reductionDb=12;
 media.track.dispatchEvent(new Event('ended'));
 assert.equal(io.armed,false);assert.equal(io.graph,null);assert.equal(media.track.stopped,1);
 assert.ok(Object.values(graph).every(node=>node.disconnected));assert.equal(graph.duck.closed,true);assert.equal(engine.musicBus.gain.value,1);assert.equal(engine.master.gain.events.length,0);
});
test('a pending permission result is stopped if the user cancels or changes input before it resolves',async()=>{
 const {io,media}=fixture();let resolveCapture;media.getUserMedia=()=>new Promise(resolve=>{resolveCapture=resolve;});
 const starting=io.startInput();while(!resolveCapture)await new Promise(resolve=>setImmediate(resolve));
 io.setOptions({inputDeviceId:'other'});resolveCapture(media.stream);
 assert.equal(await starting,false);assert.equal(io.armed,false);assert.equal(io.starting,false);assert.equal(media.track.stopped,1);
});
test('line mode bypasses the voice HP filter and selects uncompressed processing',async()=>{
 const {io}=fixture();await io.startInput();io.setOptions({mode:'line'});
 assert.equal(io.graph.highpass.type,'allpass');assert.equal(io.options.compress,false);assert.equal(io.graph.dry.gain.value,1);assert.equal(io.graph.compressed.gain.value,0);io.dispose();
});
test('output selection persists only on success and unplugging confirms a fallback to Windows',async()=>{
 const {io,engine,media,store}=fixture();await io.refreshDevices();await io.selectOutput('speakers');
 assert.equal(io.actualOutputId,'speakers');assert.equal(JSON.parse(store.get('sillage:audio-io-v11')).outputDeviceId,'speakers');
 await assert.rejects(io.selectOutput('missing'),/non appliquée/);assert.equal(io.actualOutputId,'speakers');assert.equal(engine.context.sinkId,'speakers');
 media.devices=media.devices.filter(device=>device.kind!=='audiooutput');await io.refreshDevices({deviceChange:true});
 assert.equal(engine.context.sinkId,'');assert.equal(io.actualOutputId,'');assert.match(io.notice,/débranchée/);io.dispose();
});
test('capture denial remains visible and cannot arm a remote microphone',async()=>{
 const {io,media}=fixture();media.getUserMedia=async()=>{throw Error('Permission refusée');};
 await assert.rejects(io.startInput(),/Permission/);assert.equal(io.starting,false);assert.equal(io.armed,false);assert.match(io.error,/Permission refusée/);assert.throws(()=>io.setTalk(true,{remote:true}),/localement/);io.dispose();
});

test('four live inputs share a duck combiner and stopping one never resets another input or the musical gain',async()=>{
 const {media,engine}=fixture(),tracks=[];media.getUserMedia=async()=>{const track=new Track();tracks.push(track);return{getTracks:()=>[track]};};
 const mixer=new LiveMixer(engine,{mediaDevices:media,storage:{getItem:()=>null,setItem(){}},window:null});
 await mixer.start(0);await mixer.start(1);mixer.configure(0,{monitor:true,duckEnabled:true});mixer.configure(1,{monitor:true,duckEnabled:true});mixer.talk(0,true);mixer.talk(1,true);
 assert.equal(mixer.inputs.length,4);assert.equal(mixer.state.activeInputs,2);assert.ok(mixer.inputs.every(input=>input.duckSink));
 assert.ok(mixer.inputs[0].graph.duck.connections.includes(mixer.duckNode));assert.ok(mixer.inputs[1].graph.duck.connections.includes(mixer.duckNode));
 mixer.stop(0);assert.equal(tracks[0].stopped,1);assert.equal(tracks[1].stopped,0);assert.equal(mixer.state.inputs[1].talking,true);assert.equal(engine.musicBus.gain.events.length,0);
 mixer.muteAll();assert.equal(mixer.state.inputs[1].armed,true);assert.equal(mixer.state.inputs[1].talking,false);mixer.dispose();assert.equal(tracks[1].stopped,1);
});
