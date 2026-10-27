import test from 'node:test';
import assert from 'node:assert/strict';
import {camelotKey,keyLabel,harmonicCompatibility,tempoCompatibility,trackEnergy,rankCandidates,selectNextTrack,sortTracks} from '../public/dj-library.mjs';
const song=(id,bpm=120,root=0,mode='major')=>({id,title:id,bpm,keyRoot:root,keyMode:mode,keyConfidence:.85,rms:.13,confidence:'manual'});

test('all 24 Camelot mappings preserve relative major/minor and wheel neighbors',()=>{
 const major=[8,3,10,5,12,7,2,9,4,11,6,1],minor=[5,12,7,2,9,4,11,6,1,8,3,10];
 for(let root=0;root<12;root++){
  assert.equal(camelotKey(song('major',120,root)).label,major[root]+'B');
  assert.equal(camelotKey(song('minor',120,root,'minor')).label,minor[root]+'A');
  assert.equal(harmonicCompatibility(song('major',120,root),song('relative',120,(root+9)%12,'minor')).relation,'Tonalité relative');
  assert.equal(harmonicCompatibility(song('major',120,root),song('fifth',120,(root+7)%12)).compatible,true);
 }
 assert.equal(harmonicCompatibility(song('C'),song('Db',120,1)).compatible,false);
});

test('uncertain or incomplete analysis never masquerades as a harmonic match',()=>{
 for(const patch of [{keyConfidence:0},{keyConfidence:.35},{keyConfidence:undefined},{keyRoot:-1},{keyRoot:12},{keyMode:undefined}]){
  const uncertain={...song('unknown'),...patch};assert.equal(camelotKey(uncertain),null);assert.equal(keyLabel(uncertain),'Clé incertaine');
  assert.equal(harmonicCompatibility(song('C'),uncertain).known,false);assert.equal(harmonicCompatibility(song('C'),uncertain).compatible,false);
 }
 assert.equal(keyLabel(song('Am',120,9,'minor')),'Am · 8A');
});

test('tempo ranking recognizes half/double pulse but reports uncertain grids',()=>{
 const normal=tempoCompatibility(song('one',80),song('two',160));
 assert.equal(normal.octave,.5);assert.equal(normal.ratio,1);assert.equal(normal.compatible,true);assert.equal(normal.reliable,true);
 assert.equal(tempoCompatibility(song('one',160),song('two',80)).octave,2);
 assert.equal(tempoCompatibility(song('one'),song('two',124)).compatible,true);
 assert.equal(tempoCompatibility(song('one'),song('two',132)).compatible,false);
 assert.equal(tempoCompatibility(song('one'),{...song('two'),confidence:'estimated',tempoConfidence:.9,beatStability:.4}).reliable,false);
 assert.equal(tempoCompatibility(song('one'),{bpm:NaN}).known,false);
});

test('recommendations rank key, pulse and energy while excluding played/current/duplicates',()=>{
 const current=song('playing'),relative=song('relative',122,9,'minor'),remote=song('remote',144,1),same=song('same',120),played=song('played');
 const ranked=rankCandidates(current,[current,remote,relative,same,same,played],{played:['played'],exclude:['same']});
 assert.deepEqual(ranked.map(item=>item.track.id),['relative','remote']);assert.match(ranked[0].reason,/Tonalité relative/);
 assert.equal(selectNextTrack(current,[same,relative],{recent:['same']}).id,'relative');
 assert.equal(trackEnergy({envelope:new Float32Array([.1,.1])}).toFixed(1),'0.4');
 assert.equal(trackEnergy({}),null);
});

test('random mode exhausts a folder exactly once and never silently restarts it',()=>{
 const tracks=[song('a'),song('b'),song('c'),song('d')],played=['a'];let current=tracks[0];
 for(let i=0;i<3;i++){const next=selectNextTrack(current,tracks,{mode:'shuffle',played,random:()=>.99999});assert.ok(next);assert.equal(played.includes(next.id),false);played.push(next.id);current=next;}
 assert.equal(new Set(played).size,4);assert.equal(selectNextTrack(current,tracks,{mode:'shuffle',played}),null);
 assert.ok(selectNextTrack(current,tracks,{mode:'shuffle',played,allowRepeat:true}));
 assert.equal(selectNextTrack(tracks[0],tracks,{mode:'shuffle',random:()=>1}).id,'d');
});

test('folder order, explicit exclusions and injected randomness are reproducible',()=>{
 const tracks=[song('a'),song('b'),song('c'),song('d')];
 assert.equal(selectNextTrack(tracks[0],tracks,{mode:'order',played:['b'],exclude:[tracks[2]]}).id,'d');
 assert.equal(selectNextTrack(tracks[0],tracks,{mode:'shuffle',recent:['b','c'],random:()=>0}).id,'d');
 assert.equal(selectNextTrack(tracks[0],tracks,{mode:'shuffle',random:()=>NaN}).id,'b');
});

test('key sorting follows Camelot, leaves unknown keys last, and does not mutate source',()=>{
 const unknown={id:'unknown',title:'unknown'},c=song('C'),b=song('B',120,11),am=song('Am',120,9,'minor'),tracks=[unknown,c,b,am];
 assert.deepEqual(sortTracks(tracks,'key').map(t=>t.id),['B','Am','C','unknown']);
 assert.deepEqual(sortTracks(tracks,'key',-1).map(t=>t.id),['C','Am','B','unknown']);
 assert.deepEqual(tracks.map(t=>t.id),['unknown','C','B','Am']);
 assert.deepEqual(sortTracks([song('10',110),song('2',100),{id:'?',title:'?'}],'bpm').map(t=>t.id),['2','10','?']);
});
