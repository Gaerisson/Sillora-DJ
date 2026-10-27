import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeWaveDetail} from '../public/wave-colors.mjs';
test('detailed waveform retains single-sample stereo transients, opposite phases and silent bounds',()=>{
 const left=new Float32Array(32768),right=new Float32Array(32768);left[12345]=.9;right[12345]=-.9;right[32767]=.6;
 const result=analyzeWaveDetail([left,right],44100);
 assert.equal(result.waveformVersion,2);assert.equal(result.peaks.length,16384);assert.equal(result.peaks[0],0);
 assert.ok(result.peaks[6172]>.89);assert.ok(result.peaks.at(-1)>.59);
 assert.ok(result.waveBands.high.some(x=>x>0));assert.equal(result.waveBands.version,2);
});
