import test from 'node:test';
import assert from 'node:assert/strict';
import {MixRecorder} from '../public/recording.mjs';

class Recorder {
  static isTypeSupported(type){return type.startsWith('audio/webm');}
  constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;}
  start(){this.started=true;}
  stop(){this.ondataavailable({data:new Blob(['encoded-audio'])});queueMicrotask(()=>this.onstop());}
}
const setup=()=>{
  const calls={connected:0,disconnected:0,stopped:0};
  const destination={stream:{getTracks:()=>[{stop:()=>calls.stopped++}]},disconnect(){}};
  const engine={init:async()=>({createMediaStreamDestination:()=>destination}),limiter:{connect(node){assert.equal(node,destination);calls.connected++;},disconnect(node){assert.equal(node,destination);calls.disconnected++;}}};
  return {engine,calls};
};
test('recording captures the limiter output, returns encoded audio and releases its graph',async()=>{
  globalThis.MediaRecorder=Recorder;const {engine,calls}=setup(),recorder=new MixRecorder();
  await recorder.start(engine);assert.equal(recorder.state,'recording');await assert.rejects(()=>recorder.start(engine),/déjà/);
  const first=recorder.stop();assert.equal(recorder.stop(),first);const result=await first;
  assert.equal(result.extension,'webm');assert.ok(result.blob.size>0);assert.equal(await result.blob.text(),'encoded-audio');
  assert.equal(recorder.state,'idle');assert.deepEqual(calls,{connected:1,disconnected:1,stopped:1});
});
test('an encoder startup failure restores the idle state and releases the stream',async()=>{
  globalThis.MediaRecorder=class extends Recorder{constructor(){super(null,{});throw new Error('Encoder unavailable');}};
  const {engine,calls}=setup(),recorder=new MixRecorder();await assert.rejects(()=>recorder.start(engine),/Encoder/);
  assert.equal(recorder.state,'idle');assert.equal(calls.stopped,1);assert.equal(calls.disconnected,1);
  globalThis.MediaRecorder=Recorder;
});
