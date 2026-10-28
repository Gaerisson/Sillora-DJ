import {transitionIds,profiles} from './transition-design.mjs';
import { clamp } from './audio-math.mjs';
import {audioContentId} from './audio-identity.mjs';

export function mixRegionPatch(track,kind,time){
 const duration=track?.buffer?.duration??track?.duration;
 if(!['in','out'].includes(kind)||!Number.isFinite(time)||!Number.isFinite(duration)||time<0||time>duration)throw Error('Repère de transition invalide.');
 if(kind==='in'&&time>=(track.mixOut??duration)-.1)throw Error('IN doit précéder OUT.');
 if(kind==='out'&&time<=(track.mixIn??0)+.1)throw Error('OUT doit suivre IN.');
 return {manualRegions:true,[kind==='in'?'mixIn':'mixOut']:time};
}

export const transitionPresets = {
  dynamic: {label:'DJ dynamique',style:'auto',profile:'musical',beats:32,sync:true,tempoBlend:true,quantize:true},
  rise: {label:'Whoosh rise',style:'riser',beats:16,sync:true,tempoBlend:true,quantize:true},
  smooth: { label: 'Velours', style: 'blend', beats: 32, sync: true, tempoBlend: false, quantize: true },
  club: { label: 'Club', style: 'bass', beats: 16, sync: true, tempoBlend: false, quantize: true },
  quick: { label: 'Écho court', style: 'echo', beats: 4, sync: false, tempoBlend: false, quantize: true },
  filter: { label: 'Montée filtrée', style: 'filter', beats: 16, sync: true, tempoBlend: true, quantize: true }
};

export function sanitizePreferences(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    keyLockProfile:value.keyLockProfile==='rhythm'?'rhythm':'standard',
    view: value.view === 'waves' ? 'waves' : 'decks',
    zoom: ['full', '16', '8'].includes(value.zoom) ? value.zoom : 'full',
    master: Number.isFinite(value.master) ? clamp(value.master, 0, 1) : 0.7,
    style: transitionIds.includes(value.style) ? value.style : 'auto',
    intensity: Number.isFinite(value.intensity)?clamp(value.intensity,0,1):0.45,
    profile: profiles[value.profile]?value.profile:'musical',
    beats: [4, 8, 16, 32].includes(value.beats) ? value.beats : 16,
    sync: value.sync !== false, tempoBlend: value.tempoBlend !== false, quantize: value.quantize !== false
  };
}

export function trackKey(track) { return track.fileKey || track.id; }
export function fileKey(file) { return JSON.stringify(file.fileId?[file.fileId,file.name,file.size,file.lastModified]:[file.name,file.size,file.lastModified]); }

const keyNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const validManualKey=value=>value.manualKey===true&&Number.isInteger(value.keyRoot)&&value.keyRoot>=0&&value.keyRoot<12&&['major','minor'].includes(value.keyMode);
const manualKeyFields=value=>({manualKey:true,keyRoot:value.keyRoot,keyMode:value.keyMode,key:keyNames[value.keyRoot]+(value.keyMode==='minor'?'m':''),keyConfidence:1});

export function trackPreparation(track) {
  return { contentKey:track.contentKey,regionAnalysisVersion:track.regionAnalysisVersion,analysisVersion:track.analysisVersion,manualGrid:Boolean(track.manualGrid),manualRegions:Boolean(track.manualRegions), bpm: track.bpm, downbeat: track.downbeat, beatOffset: track.beatOffset, mixIn: track.mixIn, mixOut: track.mixOut, hotCues: track.hotCues || [], confidence: track.confidence, favorite: Boolean(track.favorite),...(validManualKey(track)?manualKeyFields(track):{manualKey:false}) };
}

export function restorePreparation(track, saved) {
  if (!saved || typeof saved !== 'object') return track;
  if(saved.contentKey&&track.contentKey&&audioContentId(saved.contentKey)!==audioContentId(track.contentKey))return track;
  const end = track.buffer.duration;
  const grid=saved.manualGrid||saved.confidence==='manual'||saved.analysisVersion===track.analysisVersion;
  const legacyManualRegions=saved.manualRegions===undefined&&saved.manualGrid!==true&&saved.confidence==='manual';
  const regions=saved.manualRegions===true||legacyManualRegions||saved.analysisVersion===track.analysisVersion&&saved.regionAnalysisVersion===track.regionAnalysisVersion;track.manualGrid=Boolean(saved.manualGrid||saved.confidence==='manual');track.manualRegions=Boolean(saved.manualRegions||legacyManualRegions);

  if (grid && Number.isFinite(saved.bpm) && saved.bpm >= 40 && saved.bpm <= 240) track.bpm = saved.bpm;
  for (const key of ['beatOffset', 'downbeat']) if (grid && Number.isFinite(saved[key])) track[key] = clamp(saved[key], 0, end);
  const entry = regions && Number.isFinite(saved.mixIn) ? clamp(saved.mixIn, 0, Math.max(0, end - 0.1)) : track.mixIn || 0;
  const exit = regions && Number.isFinite(saved.mixOut) ? clamp(saved.mixOut, Math.min(end,entry + 0.1), end) : track.mixOut ?? end;
  track.mixIn = entry; track.mixOut = Math.max(entry, exit);
  track.hotCues = Array.from({ length: 4 }, (_, i) => Number.isFinite(saved.hotCues?.[i]) ? clamp(saved.hotCues[i], 0, Math.max(0, end - 0.02)) : null);
  // Only an explicit user correction overrides fresh automatic key analysis.
  track.manualKey=validManualKey(saved);if(track.manualKey)Object.assign(track,manualKeyFields(saved));
  if (saved.confidence === 'manual') track.confidence = 'manual';
  track.favorite = saved.favorite === true;
  return track;
}

export function moveQueueItem(ids, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= ids.length || to < 0 || to >= ids.length) return [...ids];
  const result = [...ids], [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
}

export function smoothQueue(ids, tracks, startingBpm = 120) {
  const lookup = new Map(tracks.map(track => [track.id, track]));
  const remaining = ids.map((id, index) => ({ id, index, bpm: lookup.get(id)?.bpm })), result = [];
  let bpm = startingBpm || 120;
  while (remaining.length) {
    let best = 0, distance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const delta = remaining[i].bpm ? Math.abs(Math.log2(remaining[i].bpm / bpm)) : Infinity;
      if (delta < distance) { best = i; distance = delta; }
    }
    const [next] = remaining.splice(best, 1); result.push(next.id); bpm = next.bpm || bpm;
  }
  return result;
}

export class TapTempo {
  times = [];
  tap(now) {
    if (this.times.length && now - this.times.at(-1) > 2000) this.times = [];
    if (this.times.length && now - this.times.at(-1) < 200) return null;
    this.times.push(now); this.times = this.times.slice(-9);
    if (this.times.length < 3) return null;
    const intervals = this.times.slice(1).map((t, i) => t - this.times[i]).sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const stable = intervals.filter(interval => Math.abs(interval - median) < median * 0.25);
    return Math.round(clamp(60000 / (stable.reduce((a, b) => a + b, 0) / stable.length), 40, 240) * 10) / 10;
  }
}

export function csvTracklist(items) {
  const cell = value => '"' + ((typeof value==='string'&&/^[=+\-@\t\r]/.test(value)?"'":'')+String(value ?? '')).replace(/"/g, '""') + '"';
  return '\ufeff' + [['Ordre', 'Titre', 'Artiste', 'BPM', 'Durée (s)'], ...items.map((t, i) => [i + 1, t.title, t.artist, t.bpm || '', Math.round(t.buffer?.duration || t.duration || 0)])].map(row => row.map(cell).join(';')).join('\r\n');
}
