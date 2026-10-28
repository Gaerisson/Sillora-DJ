import {resolveTransition} from './transition-design.mjs';
import {analyzeTrack,ANALYSIS_VERSION} from './audio-analysis.mjs';
import {musicalEntry,musicalExit} from './musical-plan.mjs';
import {analyzeWaveDetail} from './wave-colors.mjs';
import {arrangementFor} from './arrangement.mjs';
export {analyzeArrangement,arrangementFor} from './arrangement.mjs';
export {ANALYSIS_VERSION};
export const REGION_ANALYSIS_VERSION=2;
// Keep one measured IN/OUT baseline in the library, worker and decoded cache.
// Pair-specific transition lengths can move OUT; manually edited markers win.
export function prepareAnalysisRegions(analysis,duration){
 const track={...analysis,buffer:{duration}},arrangement=arrangementFor(track);
 if(analysis.manualRegions||analysis.regionAnalysisVersion===REGION_ANALYSIS_VERSION)return {...analysis,arrangement,regionAnalysisVersion:REGION_ANALYSIS_VERSION};
 track.arrangement=arrangement;const beat=60/(analysis.bpm||120);
 const mixIn=musicalEntry(track),mixOut=Math.max(mixIn,musicalExit(track,16*beat));
 return {...analysis,arrangement,mixIn,mixOut,introEnd:Math.min(mixOut,Math.max(mixIn+4*beat,analysis.introEnd||0)),outroEnd:analysis.audibleEnd??duration,regionAnalysisVersion:REGION_ANALYSIS_VERSION};
}
export function analyzeAudio(input,sampleRate){const channels=Array.isArray(input)?input:[input];return {...prepareAnalysisRegions(analyzeTrack(channels,sampleRate),channels[0].length/sampleRate),...analyzeWaveDetail(channels,sampleRate)};}
export function nextMusicalTime(position,bpm,offset=0,beats=4){const grid=60/(bpm||120)*beats;return offset+Math.ceil((position-offset-1e-8)/grid)*grid;}
export const makeTransitionPlan=resolveTransition;
