import test from 'node:test';import assert from 'node:assert/strict';
import {readPhraseCues,editPhraseCues,phraseRevision,phraseAnchor,phraseTime,newPhraseId} from '../public/phrase-cues.mjs';
import {trackPreparation,restorePreparation} from '../public/studio-tools.mjs';
import {makeTransitionPlan} from '../public/analysis.mjs';
import {runtimeIncomingLanding} from '../public/incoming-landing.mjs';
import {makeTransitionScore} from '../public/transition-score.mjs';
const track=(id,bpm=120)=>({id,bpm,confidence:'generated',downbeat:.25,beatOffset:.25,buffer:{duration:180},audibleStart:0,audibleEnd:180,mixIn:.25,mixOut:160,envelope:Array(1800).fill(.1),bassEnvelope:Array(1800).fill(.03),keyRoot:0,keyMode:'major',keyConfidence:1});
const add=(t,id,time,role)=>{t.phraseCues=editPhraseCues(t,{type:'add',id,time,label:id});if(role)t.phraseCues=editPhraseCues(t,{type:'assign',id,role});return t;};

test('LAN phrase identifiers work without secure-context UUID support',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'crypto');try{Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});const a=newPhraseId(),b=newPhraseId();assert.match(a,/^[A-Za-z0-9_.:-]{1,64}$/);assert.notEqual(a,b);}finally{if(previous)Object.defineProperty(globalThis,'crypto',previous);else delete globalThis.crypto;}
});

test('manual phrase points are sorted, bounded, copied, assigned and removed atomically',()=>{
 const t=track('a');add(t,'later',40.25,'exit');add(t,'first',16.25,'entry');const before=structuredClone(t.phraseCues),rev=phraseRevision(t);assert.deepEqual(readPhraseCues(t).points.map(p=>p.id),['first','later']);const next=editPhraseCues(t,{type:'update',id:'first',label:'Couplet',time:18.25},rev);assert.deepEqual(t.phraseCues,before);t.phraseCues=next;assert.notEqual(phraseRevision(t),rev);assert.throws(()=>editPhraseCues(t,{type:'remove',id:'first'},rev),/changé/);t.phraseCues=editPhraseCues(t,{type:'remove',id:'first'});assert.equal(t.phraseCues.entryId,null);assert.equal(t.phraseCues.exitId,'later');
});
test('invalid operations and corrupt saved values cannot invent points or mutate existing cues',()=>{
 const t=add(track('a'),'good',16.25,'entry'),before=JSON.stringify(t.phraseCues);for(const op of [{type:'add',id:'bad',time:NaN},{type:'add',id:'bad',time:180},{type:'add',id:'good',time:30},{type:'assign',id:'unknown',role:'entry'},{type:'update',id:'good',time:-1},{type:'remove',id:'missing'},{type:'update',id:'good',label:''}]){assert.throws(()=>editPhraseCues(t,op));assert.equal(JSON.stringify(t.phraseCues),before);}
 const clean=readPhraseCues({...t,phraseCues:{version:1,points:[null,{id:'x',time:Infinity},...t.phraseCues.points],entryId:'missing'}});assert.equal(clean.points.length,1);assert.equal(clean.entryId,null);
 const many=track('many');for(let i=0;i<32;i++)add(many,'p'+i,i*2+.25);assert.throws(()=>editPhraseCues(many,{type:'add',id:'extra',time:70.25}),/32/);
});
test('phrase times snap only by explicit request, preserve precision and reject an uncertain grid',()=>{
 const t=track('a',123.456),value=.25+12*240/t.bpm;assert.ok(Math.abs(phraseTime(t,value+.1,true)-value)<1e-10);assert.equal(phraseTime(t,3.123456789),3.123456789);assert.throws(()=>phraseTime({...t,confidence:'low',tempoConfidence:.4},20,true),/grille/);add(t,'off',value+.1,'entry');assert.equal(phraseAnchor(t,'entry'),null);assert.equal(phraseAnchor(t,'entry',{quantize:false}).time,value+.1);
});
test('phrase preparation survives analysis versions while content mismatch and invalid durations reject stale points',()=>{
 const t=add(track('a'),'point',16.25,'entry');t.analysisVersion=1;t.regionAnalysisVersion=2;const saved=trackPreparation(t),fresh=track('a');fresh.analysisVersion=99;restorePreparation(fresh,saved);assert.deepEqual(fresh.phraseCues,t.phraseCues);fresh.buffer.duration=10;assert.deepEqual(readPhraseCues(fresh).points,[]);const other=track('other');other.contentKey='sha256:'+'b'.repeat(64);restorePreparation(other,{...saved,contentKey:'sha256:'+'a'.repeat(64)});assert.equal(other.phraseCues,undefined);
});
test('prepared target arrivals take priority and retain their native position through curves and a shortened Next score',()=>{
 for(const shape of ['linear','smooth','early','late'])for(const [a,b]of [[110,98],[98,110]]){
  const A=track('a',a),B=add(track('b',b),'entry',.25+16*240/b,'entry'),p=makeTransitionPlan({track:A},{track:B},{style:'auto',profile:'musical',sync:true,tempoBlend:true,tempoShape:shape,beats:16,alignArrival:true});assert.equal(p.incomingLanding?.origin,'manual');assert.equal(p.incomingLanding.time,B.phraseCues.points[0].time);assert.equal(p.incomingLanding.label,'P1');assert.equal(p.inPoint+p.incomingLanding.leadSeconds,p.incomingLanding.time);
  const score=makeTransitionScore(p,{seconds:p.seconds/4}),short=runtimeIncomingLanding(B,p,score,p.seconds/4);assert.ok(short.cue>p.inPoint);assert.equal(short.cue+short.leadSeconds,short.time);
 }
});
test('source phrase exits target the actual handoff while expired, unsafe and explicit IN/OUT retain the original safeguards',()=>{
 const A=add(track('a'),'exit',144.25,'exit'),B=track('b');const options={style:'auto',profile:'musical',sync:true,tempoBlend:true,beats:16};const p=makeTransitionPlan({track:A},{track:B},options);assert.ok(Math.abs(p.handoffPosition-144.25)<1e-9);assert.notEqual(makeTransitionPlan({track:A},{track:B},{...options,alignArrival:false}).handoffPosition,144.25);assert.notEqual(makeTransitionPlan({track:A},{track:B},{...options,position:145}).handoffPosition,144.25);
 A.manualRegions=true;A.mixOut=120.123;assert.equal(makeTransitionPlan({track:A},{track:B},options).outPoint,120.123);B.manualRegions=true;add(B,'entry',32.25,'entry');assert.equal(makeTransitionPlan({track:A},{track:B},options).incomingLanding,null);
});

test('prepared phrase exits are opt-in to Auto musical and do not silently move an explicit effect or another Auto profile',()=>{
 for(const [style,profile]of [['riser','musical'],['bass','musical'],['blend','musical'],['auto','varied']]){const A=add(track('a'),'out',120.25,'exit'),B=track('b'),options={style,profile,sync:true,tempoBlend:true,beats:16};const p=makeTransitionPlan({track:A},{track:B},options);const plain=makeTransitionPlan({track:{...A,phraseCues:undefined}},{track:B},options);assert.equal(p.outPoint,plain.outPoint);}
});
