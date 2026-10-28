import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {AudioMeterBank,emptyMeterFrame} from '../public/audio-meters.mjs';
const filled=value=>new Float32Array(128).fill(value);
function feed(bank,inputs,blocks=20,start=0){for(let i=0;i<blocks;i++)bank.process(inputs,128,start+(i+1)*128/48000);return bank.state;}
test('stereo meters preserve anti-phase audio and distinct left/right levels on every bus',()=>{
 const bank=new AudioMeterBank(48000),frame=feed(bank,[[filled(.5),filled(-.5)],[filled(.125),filled(.25)],[filled(0),filled(.75)]]);
 assert.ok(Math.abs(frame.master.left.rmsDb+6.0206)<.001);assert.equal(frame.master.left.rmsDb,frame.master.right.rmsDb);
 assert.ok(Math.abs(frame.decks[0].left.rmsDb+18.0618)<.001);assert.ok(Math.abs(frame.decks[0].right.rmsDb+12.0412)<.001);
 assert.equal(frame.decks[1].left.rmsDb,-100);assert.ok(frame.decks[1].right.rmsDb>-3);assert.ok(frame.available);assert.ok(frame.windowSamples>=2400);
});
test('a transient between UI refreshes retains its sample peak and clip latch independently per channel',()=>{
 const bank=new AudioMeterBank(48000),left=filled(0);left[41]=1.2;bank.process([[left,filled(.1)]],128,128/48000);const frame=feed(bank,[[filled(0),filled(.1)]],19,128/48000);
 assert.ok(frame.master.left.peakDb>1.5);assert.equal(frame.master.left.clipSamples,1);assert.equal(frame.master.left.clipped,true);assert.equal(frame.master.right.clipped,false);
 feed(bank,[[filled(0),filled(0)]],20,.06);assert.equal(frame.master.left.peakDb,-100);assert.ok(frame.master.left.holdDb>1.5);assert.equal(frame.master.left.clipped,true);
 feed(bank,[],20,2.5);assert.equal(frame.master.left.clipped,false);assert.ok(frame.master.left.holdDb<1.5);
 bank.reset();assert.equal(frame.master.left.holdDb,-100);assert.equal(frame.master.left.clipSamples,0);
});
test('missing/mono buses and invalid samples never invent signal or poison the measurement',()=>{
 const bank=new AudioMeterBank(48000),bad=filled(.25);bad[0]=NaN;bad[1]=Infinity;const frame=feed(bank,[[],[filled(.25)],[bad,filled(0)]]);
 assert.equal(frame.master.left.rmsDb,-100);assert.equal(frame.master.right.rmsDb,-100);assert.equal(frame.decks[0].left.rmsDb,frame.decks[0].right.rmsDb);
 assert.equal(frame.decks[1].left.invalidSamples,38);assert.ok(Number.isFinite(frame.decks[1].left.rmsDb));assert.equal(frame.decks[1].right.invalidSamples,0);assert.equal(emptyMeterFrame().available,false);
});
test('meter worklet is a passive silent tap and publishes the measured stereo frame',async()=>{
 let Processor;const messages=[],scope={AudioMeterBank,sampleRate:48000,currentTime:0,AudioWorkletProcessor:class{constructor(){this.port={postMessage:data=>messages.push(structuredClone(data))};}},registerProcessor:(name,type)=>{assert.equal(name,'sillora-meter');Processor=type;}};
 const source=(await readFile(new URL('../public/meter-worklet.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');vm.runInNewContext(source,scope);
 const processor=new Processor(),output=[[filled(0),filled(0)]];for(let i=0;i<20;i++){scope.currentTime=i*128/48000;assert.equal(processor.process([[filled(.25),filled(-.5)]],output),true);}
 assert.equal(messages.length,1);assert.ok(messages[0].master.right.rmsDb>messages[0].master.left.rmsDb+5.9);assert.ok(output.flat().every(channel=>channel.every(value=>value===0)));
});
