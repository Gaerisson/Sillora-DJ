import test from 'node:test';import assert from 'node:assert/strict';
import {scheduleReferenceFx,stopReferenceFx,referenceFxIds} from '../public/reference-fx.mjs';
import {resolveTransition,transitionIds,faderCurves} from '../public/transition-design.mjs';
import {tempoFraction} from '../public/tempo-automation.mjs';
import {stemNames,prepareStems} from '../public/stems.mjs';
import {NodeStemWorker} from './helpers/stem-worker-adapter.mjs';

class Param{
 constructor(value=0){this.value=value;this.events=[];}
 cancelScheduledValues(time){this.events.push({kind:'cancel',time});}
 cancelAndHoldAtTime(time){this.events.push({kind:'hold',time});}
 setValueAtTime(value,time){this.value=value;this.events.push({kind:'value',value,time});}
 linearRampToValueAtTime(value,time){this.value=value;this.events.push({kind:'linear',value,time});}
 exponentialRampToValueAtTime(value,time){this.value=value;this.events.push({kind:'exp',value,time});}
 setTargetAtTime(value,time,duration){this.value=value;this.events.push({kind:'target',value,time,duration});}
 setValueCurveAtTime(values,time,duration){this.events.push({kind:'curve',values,time,duration});}
}
class Node{
 gain=new Param(1);frequency=new Param();Q=new Param();delayTime=new Param();playbackRate=new Param(1);edges=[];disconnected=[];
 connect(node){this.edges.push(node);return node;}disconnect(node){this.disconnected.push(node);}
 start(time){this.startTime=time;}stop(time){this.stopTime=time;}
}
class Context{
 currentTime=0;sampleRate=22050;
 createGain(){return new Node();}createBiquadFilter(){return new Node();}createDelay(){return new Node();}createConvolver(){return new Node();}createChannelSplitter(){return new Node();}createChannelMerger(){return new Node();}createBufferSource(){return new Node();}
 createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return{numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:index=>data[index]};}
}
const deck=()=>({gain:new Node(),transitionLow:new Node(),transitionHighpass:new Node(),transitionLowpass:new Node(),stemTransitionGains:Object.fromEntries(['vocals','drums','bass','other'].map(name=>[name,new Node()])),track:{bpm:110,autoGain:1},offset:0,rate:1,volume:.85});
const configure=(style,{level=.45,duration=9.230769}={})=>{
 const context=new Context(),a=deck(),b=deck(),start=.4,t={outPoint:0,voices:[]},plan={style,bpmA:110,bpmB:98,tempoBlend:true};
 if(style==='stemsustain'){a.track.stemBuffer=context.createBuffer(8,context.sampleRate*12,context.sampleRate);for(let ch=0;ch<8;ch++){const name=stemNames[Math.floor(ch/2)],channel=a.track.stemBuffer.getChannelData(ch);for(let i=0;i<channel.length;i++)channel[i]=name==='other'?.1*Math.sin(i*2*Math.PI*220/context.sampleRate):.9;}}
 return{context,a,b,t,plan,start,duration,level,musicBus:new Node(),at:p=>start+tempoFraction(p,110,98,duration)};
};

test('reference effect families have real distinct fader paths and stem-only fallback',()=>{
 for(const style of referenceFxIds)assert.ok(transitionIds.includes(style));
 const curves=referenceFxIds.map(style=>faderCurves(0,1,style,8)[0]);
 for(let a=0;a<curves.length;a++)for(let b=a+1;b<curves.length;b++)assert.ok(curves[a].some((value,i)=>Math.abs(value-curves[b][i])>.01));
 const track={bpm:120,buffer:{duration:180}};
 const fallback=resolveTransition({track},{track},{style:'stemsustain',stemsAvailable:false});assert.equal(fallback.style,'bass');assert.match(fallback.reason,/Stems indisponibles/);
});

test('effect schedules remain finite across short endings, tempo ramps and every intensity',()=>{
 for(const style of referenceFxIds)for(const duration of [.05,2,9.230769,32])for(const level of [0,.45,1]){
  const input=configure(style,{duration,level}),handle=scheduleReferenceFx(input.context,input);assert.ok(handle);
  assert.ok(handle.diagnostics.feedbackMax<=.38);assert.ok(handle.tailSeconds<=2.8);
  for(const node of handle.nodes)for(const name of ['gain','frequency','Q','delayTime','playbackRate'])for(const event of node[name]?.events||[]){
   assert.ok(Number.isFinite(event.time));if(event.value!==undefined)assert.ok(Number.isFinite(event.value));
   if(event.values)for(const value of event.values)assert.ok(Number.isFinite(value));
  }
  handle.dispose();
 }
});

test('harmonic hold samples only instrument channels, at native pitch, with bounded overlap voices',()=>{
 const input=configure('stemsustain'),buffer=input.a.track.stemBuffer,read=buffer.getChannelData.bind(buffer),channels=[];buffer.getChannelData=index=>{channels.push(index);return read(index);};
 assert.deepEqual(stemNames,['drums','bass','other','vocals']);
 const handle=scheduleReferenceFx(input.context,input);assert.deepEqual(channels,[4,5]);assert.deepEqual(handle.diagnostics.instrumentChannels,[4,5]);assert.equal(handle.diagnostics.stemOnly,true);assert.ok(handle.diagnostics.grainCount>1&&handle.diagnostics.grainCount<=48);
 const grains=handle.nodes.filter(node=>node.buffer?.numberOfChannels===2&&Number.isFinite(node.startTime));assert.equal(grains.length,handle.diagnostics.grainCount);
 for(const node of grains){assert.equal(node.playbackRate.value,1);let energy=0;for(const value of node.buffer.getChannelData(0)){assert.ok(Math.abs(value)<.102);energy+=value*value;}assert.ok(energy>1);}
 handle.dispose();
 const missing=configure('stemsustain');missing.a.track.stemBuffer=null;assert.equal(scheduleReferenceFx(missing.context,missing),null);
});

test('vocal and drum-only signals cannot leak into the held instrumental grain',()=>{
 const input=configure('stemsustain'),buffer=input.a.track.stemBuffer;
 for(let channel=0;channel<8;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]=channel<2?.6*Math.sin(i*2*Math.PI*65/input.context.sampleRate):channel>=6?.8*Math.sin(i*2*Math.PI*523/input.context.sampleRate):0;}
 const handle=scheduleReferenceFx(input.context,input),grains=handle.nodes.filter(node=>node.buffer?.numberOfChannels===2&&Number.isFinite(node.startTime));
 assert.ok(grains.length>1);for(const grain of grains)for(let channel=0;channel<2;channel++)assert.ok(grain.buffer.getChannelData(channel).every(value=>value===0));
 handle.dispose();
});

test('the real stem loader packing contract feeds the instrument grain, excluding the independently labelled vocal file',async()=>{
 const input=configure('stemsustain'),ctx=input.context,length=ctx.sampleRate*4,files={};
 for(const [name,frequency,amplitude]of [['drums',70,.6],['bass',55,.5],['other',220,.1],['vocals',523,.8]]){
  const buffer=ctx.createBuffer(2,length,ctx.sampleRate);for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<length;i++)data[i]=amplitude*Math.sin(i*2*Math.PI*frequency/ctx.sampleRate);}files[name]=buffer;
 }
 ctx.decodeAudioData=async name=>files[name];const track={buffer:ctx.createBuffer(2,length,ctx.sampleRate),bpm:110,autoGain:1};
 const desktop={stemAvailability:async()=>({available:true}),prepareStems:async()=>({id:'layout-test',state:'done',manifest:{model:'known-labelled-fixtures'}}),readStem:async(_id,name)=>name};
 await prepareStems(track,ctx,desktop,()=>{},undefined,{}, {createWorker:()=>new NodeStemWorker()});input.a.track=track;
 const handle=scheduleReferenceFx(ctx,input),grains=handle.nodes.filter(node=>node.buffer?.numberOfChannels===2&&Number.isFinite(node.startTime));
 const first=Math.round(handle.diagnostics.capturePosition*ctx.sampleRate),expected=files.other.getChannelData(0).subarray(first,first+grains[0].buffer.length),mean=expected.reduce((sum,value)=>sum+value,0)/expected.length;
 const actual=grains[0].buffer.getChannelData(0);assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-(expected[i]-mean))<1e-8,'The held signal matches the separately labelled instrument file');
 handle.dispose();
});

test('cancellation silences pending returns, disconnects only owned taps and Panic stops preserved tails',()=>{
 const input=configure('lunarecho'),manualDestination=new Node();input.a.gain.connect(manualDestination);const handle=scheduleReferenceFx(input.context,input),tap=input.a.gain.edges.at(-1);
 handle.stop({tail:true});assert.equal(handle.state,'tail');input.context.currentTime=.8;stopReferenceFx(input.context);assert.equal(handle.state,'hard');
 const clock=handle.nodes.find(node=>node.loop===true);assert.ok(Math.abs(clock.stopTime-.85)<1e-9);clock.onended();assert.equal(handle.state,'disposed');
 assert.deepEqual(input.a.gain.disconnected,[tap]);assert.ok(!input.a.gain.disconnected.includes(manualDestination));handle.dispose();stopReferenceFx(input.context);
});

test('a manually muted instrument stem is not reintroduced by the harmonic hold',()=>{
 for(const useLiveGain of [false,true]){
  const input=configure('stemsustain');input.a.track.stemLevels={other:useLiveGain?1:0};
  if(useLiveGain)input.a.stemGains={other:{gain:{value:0}}};
  const handle=scheduleReferenceFx(input.context,input),grains=handle.nodes.filter(node=>node.buffer?.numberOfChannels===2&&Number.isFinite(node.startTime));
  assert.ok(grains.length);assert.equal(handle.diagnostics.instrumentLevel,0);
  for(const source of grains)assert.equal(source.edges[0].edges[0].gain.value,0,'All captured grains feed a muted instrumental return');
  assert.equal(input.a.track.stemLevels.other,useLiveGain?1:0,'The effect leaves the stored manual settings intact');handle.dispose();
 }
});
