import test from 'node:test';
import assert from 'node:assert/strict';
import { crossfadeGains, transitionSeconds, quantizedDelay, estimateTempo, waveformPeaks } from '../public/audio-math.mjs';

test('constant power across the entire transition, including endpoints', () => {
  for (let i = 0; i <= 1000; i++) {
    const [a, b] = crossfadeGains(i / 1000);
    assert.ok(Math.abs(a * a + b * b - 1) < 1e-12);
  }
  assert.deepEqual(crossfadeGains(-5), [1, 0]);
  assert.ok(crossfadeGains(7)[0] < 1e-12);
  assert.deepEqual(crossfadeGains(0.25, 'linear'), [0.75, 0.25]);
});
test('transition duration follows effective BPM and beat count', () => {
  assert.equal(transitionSeconds(120, 16), 8);
  assert.equal(transitionSeconds(128, 32), 15);
  assert.equal(transitionSeconds(null, 8), 4);
});
test('quantization follows beat offset and never schedules in the past', () => {
  assert.equal(quantizedDelay(1, 120), 0);
  assert.ok(Math.abs(quantizedDelay(1.13, 120) - 0.37) < 1e-9);
  assert.ok(Math.abs(quantizedDelay(0, 120, 0.2) - 0.2) < 1e-9);
});
test('BPM analysis recovers generated percussive music at different tempos', () => {
  const sampleRate = 44100;
  for (const bpm of [90, 120, 128, 150]) {
    const samples = new Float32Array(sampleRate * 20);
    for (let beat = 0; beat * 60 / bpm < 20; beat++) {
      const start = Math.round(beat * 60 / bpm * sampleRate);
      for (let j = 0; j < 2000 && start + j < samples.length; j++) samples[start + j] = Math.sin(j * 0.1) * Math.exp(-j / 250);
    }
    const result = estimateTempo(samples, sampleRate);
    assert.ok(Math.abs(result.bpm - bpm) <= 1, `Expected ${bpm}, got ${result.bpm}`);
  }
  assert.equal(estimateTempo(new Float32Array(44100), sampleRate).bpm, null);
});
test('waveform includes negative transients and never produces NaN for short files', () => {
  const peaks = waveformPeaks(new Float32Array([0, -0.8, 0.2, 1]), 2);
  assert.ok(Math.abs(peaks[0] - 0.8) < 1e-6);
  assert.equal(peaks[1], 1);
  assert.ok([...waveformPeaks(new Float32Array([0.2]), 50)].every(Number.isFinite));
});
