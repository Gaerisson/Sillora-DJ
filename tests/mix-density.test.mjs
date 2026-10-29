import test from 'node:test';import assert from 'node:assert/strict';
import {densityWindow,assessOverlap,dryOverlapBeats,overlapSummary} from '../public/mix-density.mjs';
import {resolveTransition,faderCurves} from '../public/transition-design.mjs';
import {editPhraseCues} from '../public/phrase-cues.mjs';
const song=(id,bpm=120,density=.75)=>({id,bpm,confidence:'generated',keyRoot:0,keyMode:'major',keyConfidence:1,buffer:{duration:180},audibleEnd:180,mixIn:40,mixOut:100,manualRegions:true,envelope:Array(1800).fill(.15),structure:Array.from({length:Math.ceil(180*bpm/240)},(_,i)=>({time:i*240/bpm,rms:.15,density}))});
const options={style:'auto',profile:'musical',sync:true,tempoBlend:true,beats:16,intensity:.55};
test('density windows weight only intersecting native-file intervals and report real coverage',()=>{
 const t={bpm:120,buffer:{duration:10},structure:[.1,.8,.2,.9].map((density,i)=>({time:i*2,density}))};const w=densityWindow(t,1,4);assert.equal(w.known,true);assert.equal(w.coverage,1);assert.ok(Math.abs(w.value-.475)<1e-10);assert.equal(w.start,1);assert.equal(w.end,5);
});
test('sparse, missing, duplicated or invalid measurements cannot masquerade as a fully measured busy window',()=>{
 for(const structure of [[],[{density:.9}],[{time:0,density:NaN}],[{time:0,density:1},{time:0,density:1}]]){const w=densityWindow({bpm:120,buffer:{duration:10},structure},0,8);assert.equal(w.known,false);assert.equal(w.value,null);assert.ok(w.coverage<=.25);}assert.equal(densityWindow(song('a'),179,8).known,false);
});
test('actual selected regions replace the unrelated head and tail density shortcut',()=>{
 const a=song('a'),b=song('b');for(const row of a.structure)if(row.time>=96&&row.time<120)row.density=.1;const p=resolveTransition({track:a},{track:b},options);assert.equal(p.overlap.busy,false);assert.equal(p.overlap.applied,false);assert.ok(p.overlap.source.value<.2);assert.ok(a.structure.at(-2).density>.7);
});
test('two loaded zones receive a shorter dry relay and a gradual shared tempo instead of a full-length dry overlap',()=>{
 const a=song('a',98),b=song('b',110),off=resolveTransition({track:a},{track:b},{...options,protectOverlap:false}),on=resolveTransition({track:a},{track:b},options);assert.equal(off.overlap.busy,true);assert.equal(off.overlap.applied,false);assert.equal(on.overlap.applied,true);assert.equal(on.score.harmonicGuard,true);assert.equal(on.beats,16);assert.equal(on.outPoint,a.mixOut);assert.equal(on.inPoint,b.mixIn);assert.ok(dryOverlapBeats(on)<=2);assert.ok(dryOverlapBeats(on)<dryOverlapBeats(off));assert.equal(on.seconds,off.seconds);
 const curves=faderCurves(0,1,on.style,on.seconds,1024,on.score);for(let i=0;i<1024;i++)assert.ok(Math.abs(curves[0][i]**2+curves[1][i]**2-1)<1e-6);assert.ok(on.score.texture);assert.match(overlapSummary(on.overlap),/raccourci/);
});
test('unsupported modes, unreliable grids and existing short or separated passes are not silently rewritten',()=>{
 const a=song('a'),b=song('b');for(const mode of [{style:'riser',profile:'musical'},{style:'auto',profile:'varied'}]){const on=resolveTransition({track:a},{track:b},{...options,...mode}),off=resolveTransition({track:a},{track:b},{...options,...mode,protectOverlap:false});assert.equal(on.style,off.style);assert.equal(on.seconds,off.seconds);assert.equal(on.overlap.applied,false);}
 const poor={...a,confidence:'low',tempoConfidence:.7,beatStability:.3};assert.equal(resolveTransition({track:poor},{track:b},options).overlap.applied,false);
 const clash={...b,keyRoot:1};const p=resolveTransition({track:a},{track:clash},options);assert.equal(p.overlap.applied,false);assert.equal(p.overlap.alreadyShort,true);
});
test('prepared entry and exit points remain the musical relay while the protective score changes',()=>{
 const a=song('a',98),b=song('b',110);a.manualRegions=b.manualRegions=false;for(const [t,id,time,role]of [[a,'out',48*240/a.bpm,'exit'],[b,'in',16*240/b.bpm,'entry']]){t.phraseCues=editPhraseCues(t,{type:'add',id,time,label:id});t.phraseCues=editPhraseCues(t,{type:'assign',id,role});}const p=resolveTransition({track:a},{track:b},options);assert.equal(p.overlap.applied,true);assert.ok(Math.abs(p.handoffPosition-a.phraseCues.points[0].time)<1e-8);assert.equal(p.incomingLanding.origin,'manual');assert.equal(p.incomingLanding.time,b.phraseCues.points[0].time);
});
test('target measurement follows its native rate integral and does not read only its beginning',()=>{
 const a=song('a',110),b=song('b',98);const m=assessOverlap(a,b,{outPoint:100,inPoint:40,seconds:8,sourceSpanSeconds:8,rate:110/98,tempoBlend:true,tempoShape:'late'});assert.ok(m.target.end>48);assert.equal(m.target.start,40);assert.equal(m.known,true);
});

test('zero FX retains only the short dry relay without synthetic air, filter sweep or echo',()=>{const p=resolveTransition({track:song('a',98)},{track:song('b',110)},{...options,intensity:0});assert.equal(p.overlap.applied,true);assert.equal(p.score.texture.amount,0);assert.equal(p.score.echo,null);assert.ok(p.score.parameters.outHighpass.every(p=>p[1]===18));assert.ok(p.score.parameters.echoSend.every(p=>p[1]===0));assert.ok(p.score.parameters.inLow.every(p=>p[1]===0));});
