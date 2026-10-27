import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {waveForSeparation} from '../public/stems.mjs';
const {validateWave,StemService}=createRequire(import.meta.url)('../desktop/stem-service.cjs');
const signal={duration:1,length:22050,sampleRate:22050,numberOfChannels:1,getChannelData:()=>new Float32Array(22050).fill(.1)};
test('stem preparation preserves floating-point levels and duplicates mono without clipping',()=>{
 const bytes=waveForSeparation(signal),wave=validateWave(bytes),view=new DataView(bytes);
 assert.equal(wave.length,44+22050*8);assert.ok(Math.abs(view.getFloat32(44,true)-.1)<1e-8);assert.equal(view.getFloat32(44,true),view.getFloat32(48,true));
 const broken=wave.slice();broken.writeUInt32LE(400,40);assert.throws(()=>validateWave(broken));
 assert.throws(()=>waveForSeparation({...signal,duration:481}));
 assert.throws(()=>waveForSeparation({...signal,getChannelData:()=>new Float32Array(22050).fill(NaN)}));
});
test('stem jobs reject unknown identifiers and unprepared or arbitrary file reads',async()=>{
 const service=new StemService({cache:'unused',python:process.execPath});
 assert.throws(()=>service.status('../../anything'));await assert.rejects(()=>service.read('unknown','../settings.json'));
 service.jobs.set('job',{state:'done',folder:'unused'});await assert.rejects(()=>service.read('job','../settings.json'));
 service.close();await assert.rejects(()=>service.begin(waveForSeparation(signal)),/arrêté/);
});
