export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function crossfadeGains(position, curve = 'equal') {
  const x = clamp(position, 0, 1);
  return curve === 'linear' ? [1 - x, x] : [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)];
}
export function transitionSeconds(bpm, beats) { return beats * 60 / clamp(bpm || 120, 40, 240); }
export function quantizedDelay(position, bpm, offset = 0) {
  const beat = 60 / bpm;
  return ((beat - ((position - offset) % beat + beat) % beat) % beat);
}
export function waveformPeaks(samples, count = 480) {
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * samples.length / count), to = Math.floor((i + 1) * samples.length / count);
    let max = 0;
    for (let j = from; j < to; j += Math.max(1, Math.floor((to - from) / 100))) max = Math.max(max, Math.abs(samples[j]));
    peaks[i] = max;
  }
  return peaks;
}
// Energy-onset interval histogram; an estimate, not a professional beat grid.
export function estimateTempo(samples, sampleRate) {
  const hop = 512, energy = [], maxSeconds = Math.min(samples.length, sampleRate * 100);
  for (let at = 0; at < maxSeconds; at += hop) {
    let sum = 0;
    for (let j = at; j < Math.min(at + hop, samples.length); j++) sum += samples[j] ** 2;
    energy.push(Math.sqrt(sum / hop));
  }
  const novelty = energy.map((v, i) => Math.max(0, v - (energy[i - 1] || 0)));
  const threshold = Math.max(...novelty) * 0.2, peaks = [];
  for (let i = 2; i < novelty.length - 2; i++) {
    if (novelty[i] > threshold && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1] && (peaks.length === 0 || i - peaks.at(-1) > sampleRate * 0.18 / hop)) peaks.push(i);
  }
  const histogram = new Map();
  for (let i = 0; i < peaks.length; i++) for (let j = i + 1; j < Math.min(i + 9, peaks.length); j++) {
    let bpm = 60 * sampleRate / ((peaks[j] - peaks[i]) * hop);
    while (bpm < 80) bpm *= 2;
    while (bpm > 160) bpm /= 2;
    const key = Math.round(bpm);
    histogram.set(key, (histogram.get(key) || 0) + 1 / (j - i));
  }
  const ranked = [...histogram].sort((a, b) => b[1] - a[1]);
  return { bpm: ranked.length ? ranked[0][0] : null, offset: peaks.length ? peaks[0] * hop / sampleRate : 0 };
}
