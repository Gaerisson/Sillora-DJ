import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {StudioEngine} from '../public/engine.js';

async function processor(channels,position=.1,sourceRate=48000){
  let Processor;
  const scope={sampleRate:48000,Float32Array,Math,Number,AudioWorkletProcessor:class{constructor(){this.messages=[];this.port={postMessage:value=>this.messages.push(value)};}},registerProcessor(name,klass){assert.equal(name,'sillage-scratch');Processor=klass;}};
  vm.runInNewContext(await fs.readFile(new URL('../public/scratch-worklet.js',import.meta.url),'utf8'),scope);
  return new Processor({processorOptions:{channels,position,sourceRate}});
}
function render(p,blocks){const audio=[];for(let i=0;i<blocks;i++){const output=[new Float32Array(128),new Float32Array(128)];p.process([], [output]);audio.push(...output[0]);}return audio;}

test('the scratch waveform actually traverses source samples forward and backward, then stops',async()=>{
  const ramp=Float32Array.from({length:20000},(_,index)=>index/20000);
  const p=await processor([ramp,ramp]);
  p.port.onmessage({data:{type:'move',position:.12,elapsedMs:16}});
  const forward=render(p,5);assert.ok(p.position>4800);assert.ok(forward[600]>forward[400]);
  const pivot=p.position;p.port.onmessage({data:{type:'move',position:.08,elapsedMs:16}});
  const backward=render(p,5);assert.ok(p.position<pivot);assert.ok(backward[600]<backward[400]);
  const resting=render(p,100);assert.ok(Math.max(...resting.slice(-128).map(Math.abs))<1e-5);
  assert.ok(Math.abs(p.position-.08*48000)<.1);
});

test('scratch interpolates stereo at a different source sample rate and remains finite at both ends',async()=>{
  const left=Float32Array.from({length:500},(_,i)=>i===4?NaN:Math.sin(i*.1)*4);
  const p=await processor([left,Float32Array.from(left,v=>-v)],.005,24000);
  for(const position of [2,-1,.005]){
    p.port.onmessage({data:{type:'move',position,elapsedMs:NaN}});
    const audio=render(p,20);assert.ok(audio.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));
    assert.ok(p.position>=0&&p.position<500);
  }
  p.port.onmessage({data:{type:'finish'}});render(p,20);
  assert.equal(p.messages.findLast(m=>m.type==='finished').position,p.position/24000);
});

test('a move followed immediately by release consumes the hand motion before acknowledging finish',async()=>{
  const ramp=Float32Array.from({length:100000},(_,i)=>Math.sin(i*.04)*.4),p=await processor([ramp,ramp],1);
  p.port.onmessage({data:{type:'move',position:1.9,elapsedMs:16}});
  p.port.onmessage({data:{type:'finish'}});
  assert.equal(p.messages.some(message=>message.type==='finished'),false);
  const audio=render(p,65),finished=p.messages.find(message=>message.type==='finished');
  assert.ok(finished);assert.ok(Math.abs(finished.position-1.9)<1e-5);
  assert.ok(audio.some(sample=>Math.abs(sample)>.01));assert.ok(audio.every(Number.isFinite));
});

class Param {value=1;cancelScheduledValues(){}setTargetAtTime(v){this.value=v;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}}
class Node {gain=new Param();playbackRate=new Param();connect(node){return node;}disconnect(){this.disconnected=true;}start(){}stop(){this.stopped=true;}}
class ScratchNode extends Node{
  constructor(context,name,options){super();assert.equal(name,'sillage-scratch');this.position=options.processorOptions.position;this.port={postMessage:data=>{if(data.type==='move')this.position=data.position;if(data.type==='finish')queueMicrotask(()=>this.port.onmessage?.({data:{type:'finished',position:this.position}}));},close:()=>{this.closed=true;}};}
}
function studio(){
  const engine=new StudioEngine();engine.context={currentTime:0,sampleRate:48000,audioWorklet:{addModule:async()=>{}},createBufferSource:()=>new Node(),createGain:()=>new Node()};engine.init=async()=>engine.context;
  const buffer={duration:10,sampleRate:48000,numberOfChannels:2,getChannelData:()=>new Float32Array(480000)};
  for(const d of engine.decks){d.input=new Node();d.track={id:`track-${d.id}`,buffer};}
  return engine;
}
globalThis.AudioWorkletNode=ScratchNode;

test('scratch release restores playing state and tempo at the actual reversed position',async()=>{
  const engine=studio();const d=engine.decks[0];d.rate=1.25;await engine.play(0);engine.context.currentTime=2;
  assert.equal(engine.position(0),2.5);const source=d.source;
  await engine.beginScratch(0);assert.equal(source.stopped,true);assert.equal(d.scratching,true);assert.equal(d.playing,false);
  engine.scratchBy(0,-.4,16);await engine.endScratch(0);
  assert.equal(d.scratching,false);assert.equal(d.playing,true);assert.equal(d.rate,1.25);assert.ok(Math.abs(engine.position(0)-2.1)<1e-10);
  engine.context.currentTime=3;assert.ok(Math.abs(engine.position(0)-3.35)<1e-10);
});

test('a paused deck remains paused; transport pause disposes scratch without restarting',async()=>{
  const engine=studio();const d=engine.decks[0];d.offset=3;
  await engine.beginScratch(0);engine.scratchBy(0,.5);await engine.endScratch(0);
  assert.equal(d.playing,false);assert.equal(engine.position(0),3.5);
  await engine.beginScratch(0);const session=d.scratchSession;
  session.position=4;engine.pause(0);await engine.endScratch(0);
  assert.equal(d.scratching,false);assert.equal(d.playing,false);assert.equal(d.offset,4);
});

test('loading/pausing during worklet initialization cannot resurrect the previous scratch',async()=>{
  const engine=studio();let ready;engine.context.audioWorklet.addModule=()=>new Promise(resolve=>{ready=resolve;});
  const begin=engine.beginScratch(0);await new Promise(resolve=>setImmediate(resolve));
  engine.pause(0);ready();assert.equal(await begin,false);assert.equal(engine.decks[0].scratching,false);
});

test('an unsupported audio context reports an explicit error and leaves playback intact',async()=>{
  const engine=studio();engine.context.audioWorklet=null;await engine.play(0);
  await assert.rejects(engine.beginScratch(0),/AudioWorklet/);assert.equal(engine.decks[0].playing,true);
});
