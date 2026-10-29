import {readPhraseCues} from './phrase-cues.mjs';
import {transitionSourceOffset} from './transition-score.mjs';
const peakCache = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

// A scrolling range can extend beyond the beginning/end. Keeping that space
// empty lets the playhead stay fixed while the first beat approaches it.
export function rollingWaveRange(position, bpm = 120, beats = 16, anchor = .25) {
  const span = 60 / Math.max(20, finite(bpm, 120)) * clamp(finite(beats, 16), 4, 64);
  const from = Math.max(0, finite(position)) - span * clamp(finite(anchor, .25), 0, 1);
  return [from, from + span];
}

function lightSurface(color) {
  const match = /^#([\da-f]{6})$/i.exec(color.trim());
  if (!match) return false;
  const rgb = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16));
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > 155;
}

function spectralLayers(ctx, track, levels, {from, span, duration, width, height, panel, deckColor}) {
  const step = Math.max(1.5, width / 1800), columns = Math.ceil(width / step);
  const samplesPerColumn = span / duration * levels[0].length / columns;
  const levelIndex = clamp(Math.floor(Math.log2(Math.max(1, samplesPerColumn))), 0, levels.length - 1);
  const peaks = levels[levelIndex], half = Math.max(3, (height - 30) / 2), center = height / 2 + 3;
  const layers = [[], [], []], bands = track.waveBands, bandCount = bands?.low?.length || 0;
  for (let column = 0; column <= columns; column++) {
    const x = Math.min(width, column * step), at = from + x / width * span;
    let amplitude = 0, low = 0, mid = 0, high = 0;
    if (at >= 0 && at <= duration) {
      const first = clamp(Math.floor(at / duration * peaks.length), 0, peaks.length - 1);
      const last = clamp(Math.ceil((at + span / columns) / duration * peaks.length), first + 1, peaks.length);
      let peak = 0;
      for (let i = first; i < last; i++) peak = Math.max(peak, peaks[i]);
      amplitude = Math.min(1, Math.max(0, peak)) * half;
      if (bandCount) {
        const band = clamp(at / duration * (bandCount - 1), 0, bandCount - 1);
        const index = Math.floor(band), blend = band - index;
        const sample = values => Math.max(0, finite(values?.[index]) * (1 - blend) + finite(values?.[Math.min(index + 1, bandCount - 1)]) * blend);
        low = sample(bands.low); mid = sample(bands.mid); high = sample(bands.high);
      }
    }
    const total = Math.max(.00001, low + mid + high);
    const middle = bandCount ? amplitude * (.38 + .48 * Math.sqrt((mid + low * .15) / total)) : amplitude * .67;
    const bass = bandCount ? middle * (.32 + .52 * Math.sqrt(low / total)) : amplitude * .36;
    layers[0].push([x, amplitude]); layers[1].push([x, middle]); layers[2].push([x, bass]);
  }
  const light = lightSurface(panel), palette = bandCount ? light ? ['#188cbb', '#745bb2', '#cb465f'] : ['#42cce6', '#a17ce7', '#f06679'] : [deckColor, deckColor, deckColor];
  for (let layer = 0; layer < layers.length; layer++) {
    const points = layers[layer];
    const fill = ctx.createLinearGradient(0, center - half, 0, center + half);
    fill.addColorStop(0, palette[layer]); fill.addColorStop(.5, light ? palette[layer] : layer === 2 ? '#ffb08f' : palette[layer]); fill.addColorStop(1, palette[layer]);
    ctx.globalAlpha = layer === 0 ? .76 : layer === 1 ? .88 : .96;
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(points[0][0], center - points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], center - points[i][1]);
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i][0], center + points[i][1]);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = .38; ctx.fillStyle = light ? '#ffffff' : '#e4ecff'; ctx.fillRect(0, center, width, .65);
  ctx.globalAlpha = 1;
}

// Pool once when the analyzed track changes; drawing never scans decoded audio.
function pooledPeaks(track) {
  const peaks = track.peaks;
  if (!peaks?.length) return null;
  let cached = peakCache.get(track);
  if (cached?.source === peaks && cached.length === peaks.length) return cached.levels;
  const levels = [Float32Array.from(peaks, value => Math.max(0, finite(value)))];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1), next = new Float32Array(Math.ceil(previous.length / 2));
    for (let i = 0; i < next.length; i++) next[i] = Math.max(previous[i * 2], previous[i * 2 + 1] || 0);
    levels.push(next);
  }
  peakCache.set(track, { source: peaks, length: peaks.length, levels });
  return levels;
}

function label(ctx, text, x, y, color, width, background, align = 'left') {
  ctx.font = 'bold 9px Consolas, monospace';
  const size = ctx.measureText(text).width + 8;
  const left = clamp(align === 'right' ? x - size : x, 1, Math.max(1, width - size - 1));
  ctx.fillStyle = background;
  ctx.fillRect(left, y - 10, size, 13);
  ctx.fillStyle = color;
  ctx.fillText(text, left + 4, y);
}

/** Draw an overview or zoomed deck waveform. All positions and ranges are seconds.
 * transitionPlan is supplied only for the outgoing deck, using its track time.
 */
export function drawDJWaveform(ctx, {
  track, position = 0, from = 0, to, width = ctx.canvas.width,
  height = ctx.canvas.height, colors = {}, deckColor = colors.a || '#5bd9e7',
  transitionPlan = null, loop = null, arrivalPoint = null,
} = {}) {
  if (!(width > 0 && height > 0)) return;
  const text = colors.text || '#eef3f8', dim = colors.dim || '#8996a8';
  const grid = colors.grid || '#36404e', panel = colors.inset || '#11151b';
  const green = colors.green || '#99dfb1', warm = colors.warm || '#f4bf80';
  const duration = Math.max(.001, finite(track?.buffer?.duration ?? track?.duration, 1));
  from = finite(from);
  to = Math.max(from + .001, finite(to, duration));
  const span = Math.max(.001, to - from), xAt = seconds => (seconds - from) / span * width;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  if (!track) {
    ctx.fillStyle = grid; ctx.fillRect(0, height / 2, width, 1);
    ctx.restore(); return;
  }

  const beat = 60 / Math.max(20, finite(track.bpm, 120));
  const offset = finite(track.downbeat, finite(track.beatOffset));
  const beatPixels = beat / span * width;
  const rangeShade = (start, end, color, alpha) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= from || start >= to || end <= start) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    const left = Math.max(0, xAt(start)), right = Math.min(width, xAt(end));
    ctx.fillRect(left, 0, right - left, height); ctx.globalAlpha = 1;
  };
  rangeShade(finite(track.mixIn), finite(track.introEnd, finite(track.mixIn) + beat * 16), deckColor, .035);
  rangeShade(finite(track.mixOut, duration), duration, warm, .045);
  if (loop) rangeShade(loop.start, loop.end, green, .16);

  // Phrase lines stay readable in an overview; individual beats appear on zoom.
  const step = beatPixels >= 8 ? 1 : beatPixels * 4 >= 10 ? 4 : beatPixels * 16 >= 12 ? 16 : 32;
  const startBeat = Math.floor((from - offset) / beat / step) * step;
  for (let index = startBeat; offset + index * beat <= to; index += step) {
    const x = Math.round(xAt(offset + index * beat)) + .5;
    const phrase = index % 16 === 0, bar = index % 4 === 0;
    ctx.globalAlpha = phrase ? .35 : bar ? .27 : .13;
    ctx.fillStyle = phrase ? deckColor : grid;
    ctx.fillRect(x, phrase ? 0 : 16, 1, height - (phrase ? 0 : 16));
    ctx.globalAlpha = 1;
    if (phrase && index >= 0 && beatPixels * 16 >= 55) {
      ctx.fillStyle = dim; ctx.font = '9px Consolas, monospace';
      ctx.fillText(`${Math.floor(index / 4) + 1}`, clamp(x + 4, 3, width - 19), 10);
    }
  }

  const levels = pooledPeaks(track);
  if (levels) {
    spectralLayers(ctx, track, levels, {from, span, duration, width, height, panel, deckColor});
    // The played region is subdued without hiding transient detail ahead.
    rangeShade(0, Math.min(duration, position), panel, .22);
  } else {
    ctx.fillStyle = grid; ctx.fillRect(0, height / 2, width, 1);
  }

  if (loop && Number.isFinite(loop.start) && Number.isFinite(loop.end) && loop.end > from && loop.start < to) {
    const left = clamp(xAt(loop.start), 0, width), right = clamp(xAt(loop.end), 0, width);
    if (right > left) {
      rangeShade(loop.start, loop.end, green, .08);
      ctx.fillStyle = green; ctx.fillRect(left, height - 3, right - left, 3);
      if (right - left > 45) label(ctx, 'LOOP', left + 2, height - 8, green, width, panel);
    }
  }

  const planStart = transitionPlan?.outPoint ?? transitionPlan?.startPosition;
  const planSeconds = transitionPlan?.seconds ?? transitionPlan?.duration;
  if (Number.isFinite(planStart) && Number.isFinite(planSeconds) && planSeconds > 0) {
    const planEnd = planStart + transitionSourceOffset(transitionPlan,1);
    rangeShade(planStart, planEnd, deckColor, .1);
    const left = clamp(xAt(planStart), 0, width), right = clamp(xAt(planEnd), 0, width);
    if (right > left) {
      ctx.fillStyle = deckColor; ctx.fillRect(left, height - 3, right - left, 3);
      if (right - left > 82) label(ctx, 'TRANSITION', left + 2, height - 8, deckColor, width, panel);
    }
    for (const stage of transitionPlan.stages || []) {
      const value = planStart + transitionSourceOffset(transitionPlan,finite(stage.at));
      if (value < from || value > to) continue;
      const x = xAt(value);
      ctx.fillStyle = deckColor; ctx.beginPath(); ctx.moveTo(x, height - 4);
      ctx.lineTo(x - 3, height - 10); ctx.lineTo(x + 3, height - 10); ctx.fill();
    }
  }

  let lastArrangementLabel=-40;
  for(const [index,point] of (track.arrangement?.landmarks||[]).entries()){
    if(!Number.isFinite(point.time)||point.time<0||point.time>=duration||point.time<from||point.time>to||!(point.confidence>=.55)||!['lift','release','change'].includes(point.kind))continue;
    const x=xAt(point.time),color=point.kind==='lift'?green:point.kind==='release'?warm:deckColor;
    ctx.globalAlpha=.25;ctx.fillStyle=color;ctx.fillRect(x,28,1,Math.max(0,height-28));ctx.globalAlpha=1;
    if(height>=70&&x-lastArrangementLabel>=32){label(ctx,'R'+(index+1),x+2,39,color,width,panel);lastArrangementLabel=x;}
  }
  const phrases=readPhraseCues(track);let lastPhrase=-40;for(const [index,p]of phrases.points.entries()){if(p.time<from||p.time>to)continue;const x=xAt(p.time),role=p.id===phrases.entryId?' ↗':p.id===phrases.exitId?' ↘':'';ctx.globalAlpha=.7;ctx.fillStyle=warm;ctx.fillRect(x,0,2,height);ctx.globalAlpha=1;if(height>=70&&x-lastPhrase>=35){label(ctx,'P'+(index+1)+role,x+3,Math.min(height-8,53),warm,width,panel);lastPhrase=x;}}
  const cueColors = colors.cues || [deckColor, '#c1adff', warm, green];
  const markers = [
    ...(transitionPlan?.score&&Number.isFinite(planStart)?[[planStart+(transitionPlan.sourceSpanSeconds??planSeconds)*transitionPlan.score.handoffFraction,'RELAIS',deckColor]]:[]),
    [finite(track.mixIn), 'IN', green], [finite(transitionPlan?.outPoint,finite(track.mixOut,duration)), 'OUT', warm],
    ...(track.hotCues || []).map((value, index) => [value, String(index + 1), cueColors[index % cueColors.length]]),
  ];
  for (const [value, name, color] of markers) {
    if (!Number.isFinite(value) || value < from || value > to) continue;
    const x = clamp(xAt(value), .5, width - 1);
    ctx.globalAlpha = .65; ctx.fillStyle = color; ctx.fillRect(x, 14, 1, height - 14); ctx.globalAlpha = 1;
    label(ctx, name, x + 2, 23, color, width, panel, x > width - 34 ? 'right' : 'left');
  }
  if(arrivalPoint?.version===1&&typeof arrivalPoint.trackId==='string'&&arrivalPoint.trackId===track.id&&Number.isFinite(arrivalPoint.time)&&arrivalPoint.time>=0&&arrivalPoint.time<duration&&arrivalPoint.time>=from&&arrivalPoint.time<=to){
    const x=xAt(arrivalPoint.time);ctx.fillStyle=deckColor;ctx.globalAlpha=.8;ctx.fillRect(x,0,1,height);ctx.globalAlpha=1;label(ctx,'ARRIVÉE '+arrivalPoint.label,x+2,Math.min(height-8,56),deckColor,width,panel,x>width-80?'right':'left');
  }
  if (position >= from && position <= to) {
    const x = clamp(xAt(position), 1, width - 2);
    ctx.globalAlpha = .12; ctx.fillStyle = '#ff6474'; ctx.fillRect(x - 4, 0, 9, height); ctx.globalAlpha = 1;
    ctx.fillStyle = lightSurface(panel) ? '#b82e49' : '#ff8791'; ctx.fillRect(x, 0, 1.5, height);
    ctx.beginPath(); ctx.moveTo(x - 4, 0); ctx.lineTo(x + 5, 0); ctx.lineTo(x + .75, 6); ctx.fill();
  }
  ctx.restore();
}
