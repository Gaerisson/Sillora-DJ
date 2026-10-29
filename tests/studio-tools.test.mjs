import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePreferences,restorePreparation,trackPreparation,fileKey,moveQueueItem,smoothQueue,TapTempo,csvTracklist} from '../public/studio-tools.mjs';

test('stored preferences accept silence and reject invalid or obsolete values',()=>{
  assert.equal(sanitizePreferences().alignArrival,true);assert.equal(sanitizePreferences({alignArrival:false}).alignArrival,false);
  assert.equal(sanitizePreferences({master:0}).master,0);
  const result=sanitizePreferences({master:Infinity,style:'unknown',beats:-4,view:'waves',zoom:'8'});
  assert.equal(result.master,0.7);assert.equal(result.style,'auto');assert.equal(result.beats,16);assert.equal(result.view,'waves');assert.equal(result.zoom,'8');
  assert.equal(sanitizePreferences(null).beats,16);
  const dj=sanitizePreferences({style:'riser',intensity:0,profile:'peak'});assert.equal(dj.style,'riser');assert.equal(dj.intensity,0);assert.equal(dj.profile,'peak');
});

test('key-lock profile persistence only restores supported processing modes',()=>{
 assert.equal(sanitizePreferences({keyLockProfile:'rhythm'}).keyLockProfile,'rhythm');
 assert.equal(sanitizePreferences({keyLockProfile:'__proto__'}).keyLockProfile,'standard');
});
test('track preparation round-trips without audio and bounds all cue and region positions',()=>{
  const track={id:'a',fileKey:fileKey({name:'track.wav',size:100,lastModified:42}),bpm:120,buffer:{duration:10},mixIn:0,mixOut:8};
  restorePreparation(track,{bpm:128,mixIn:3,mixOut:1,downbeat:2,hotCues:[0,500,-2,null],favorite:true,confidence:'manual'});
  assert.equal(track.mixOut,3.1);assert.deepEqual(track.hotCues,[0,9.98,0,null]);assert.equal(track.favorite,true);assert.equal(track.bpm,128);
  const saved=JSON.parse(JSON.stringify(trackPreparation(track)));assert.equal(saved.buffer,undefined);assert.equal(saved.confidence,'manual');
  const short={buffer:{duration:0.04},mixIn:0,mixOut:0.04};restorePreparation(short,{mixIn:5,mixOut:5});assert.ok(short.mixOut<=0.04);
});
test('queue edits and tempo organization preserve duplicate entries and unknown tempos',()=>{
  assert.deepEqual(moveQueueItem(['a','b','a'],0,2),['b','a','a']);assert.deepEqual(moveQueueItem(['a'],1,0),['a']);
  const result=smoothQueue(['a','x','b','a','c'],[{id:'a',bpm:120},{id:'b',bpm:124},{id:'c',bpm:126},{id:'x'}],124);
  assert.deepEqual(result,['b','c','a','a','x']);
});

test('manual key corrections survive newer analysis without restoring obsolete automatic grid or regions',()=>{
 const previous={analysisVersion:2,buffer:{duration:180},manualKey:true,keyRoot:9,keyMode:'minor',key:'wrong stale label',keyConfidence:.1,bpm:120,mixIn:4,mixOut:160,hotCues:[12,null,24],favorite:true};
 const saved=JSON.parse(JSON.stringify(trackPreparation(previous)));
 assert.equal(saved.manualKey,true);assert.equal(saved.key,'Am');assert.equal(saved.keyConfidence,1);
 const fresh={analysisVersion:3,buffer:{duration:180},keyRoot:0,keyMode:'major',key:'C',keyConfidence:.5,bpm:125,mixIn:8,mixOut:170};
 restorePreparation(fresh,saved);
 assert.equal(fresh.keyRoot,9);assert.equal(fresh.keyMode,'minor');assert.equal(fresh.key,'Am');assert.equal(fresh.keyConfidence,1);assert.equal(fresh.manualKey,true);
 assert.equal(fresh.bpm,125);assert.equal(fresh.mixIn,8);assert.equal(fresh.mixOut,170);assert.deepEqual(fresh.hotCues,[12,null,24,null]);assert.equal(fresh.favorite,true);
});

test('automatic or malformed saved keys never overwrite a fresh analysis',()=>{
 for(const patch of [{manualKey:false},{manualKey:undefined},{manualKey:'true'},{keyRoot:-1},{keyRoot:12},{keyRoot:4.5},{keyMode:'dorian'}]){
  const obsolete={analysisVersion:2,manualKey:true,keyRoot:9,keyMode:'minor',key:'Am',keyConfidence:1,...patch};
  const saved=trackPreparation(obsolete);assert.equal(saved.manualKey,false);assert.equal(saved.keyRoot,undefined);
  const fresh={analysisVersion:3,buffer:{duration:180},keyRoot:2,keyMode:'major',key:'D',keyConfidence:.64,mixIn:2,mixOut:172};
  restorePreparation(fresh,obsolete);assert.equal(fresh.key,'D');assert.equal(fresh.keyRoot,2);assert.equal(fresh.keyConfidence,.64);assert.equal(fresh.manualKey,false);
 }
});

test('correcting BPM does not preserve obsolete automatic IN/OUT, while explicit manual markers survive',()=>{
 const saved={analysisVersion:2,regionAnalysisVersion:0,manualGrid:true,manualRegions:false,confidence:'manual',bpm:128,mixIn:3,mixOut:100};
 const fresh=()=>({analysisVersion:2,regionAnalysisVersion:1,buffer:{duration:180},bpm:125,mixIn:8,mixOut:170});
 for(const value of [saved,{...saved,manualRegions:undefined}]){const automatic=fresh();restorePreparation(automatic,value);assert.equal(automatic.bpm,128);assert.equal(automatic.mixIn,8);assert.equal(automatic.mixOut,170);assert.equal(automatic.manualRegions,false);}
 const persisted=trackPreparation({...fresh(),manualGrid:true,confidence:'manual'});assert.equal(persisted.manualRegions,false);
 const manual=fresh();restorePreparation(manual,{...saved,manualRegions:true});assert.equal(manual.mixIn,3);assert.equal(manual.mixOut,100);assert.equal(manual.manualRegions,true);
});
test('tap tempo tolerates timing jitter and resets after a long pause',()=>{
  const tap=new TapTempo();assert.equal(tap.tap(0),null);assert.equal(tap.tap(500),null);assert.equal(tap.tap(1000),120);
  assert.ok(Math.abs(tap.tap(1502)-120)<0.5);assert.equal(tap.tap(5000),null);assert.equal(tap.tap(5100),null);assert.equal(tap.tap(5500),null);assert.equal(tap.tap(6000),120);
});
test('CSV export quotes metadata and neutralizes spreadsheet formulas',()=>{
  const csv=csvTracklist([{title:'=HYPERLINK("x")',artist:'A;B',bpm:120,buffer:{duration:10.4}}]);
  assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"A;B"/);
});
import * as regionTools from '../public/studio-tools.mjs';

test('saved corrections identify the audio independently of cache versions and reject changed bytes',()=>{
 const key='sha256:'+'a'.repeat(64),old={buffer:{duration:100},contentKey:key+':2:wave2:region1',analysisVersion:2,regionAnalysisVersion:1,manualGrid:true,confidence:'manual',bpm:127,manualRegions:true,mixIn:3.41,mixOut:80.23,hotCues:[2,10],favorite:true},saved=trackPreparation(old);
 assert.equal(saved.contentKey,old.contentKey);const fresh={buffer:{duration:100},contentKey:key+':3:wave2:region2',analysisVersion:3,regionAnalysisVersion:2,mixIn:0,mixOut:90,bpm:120};restorePreparation(fresh,saved);assert.equal(fresh.bpm,127);assert.equal(fresh.mixIn,3.41);assert.equal(fresh.mixOut,80.23);assert.equal(fresh.favorite,true);
 const changed={buffer:{duration:100},contentKey:'sha256:'+'b'.repeat(64)+':2:wave2:region2',mixIn:0,mixOut:90,bpm:120};restorePreparation(changed,saved);assert.equal(changed.mixIn,0);assert.equal(changed.bpm,120);assert.equal(changed.manualRegions,undefined);
});

test('arrangement preparation validates an IN or OUT patch without mutating the playing track',()=>{
 assert.equal(typeof regionTools.mixRegionPatch,'function');const t={buffer:{duration:100},mixIn:4,mixOut:80,manualGrid:true};
 assert.deepEqual(regionTools.mixRegionPatch(t,'in',16),{manualRegions:true,mixIn:16});assert.deepEqual(regionTools.mixRegionPatch(t,'out',64),{manualRegions:true,mixOut:64});assert.equal(t.mixIn,4);assert.equal(t.manualRegions,undefined);
 for(const [kind,at]of [['in',81],['out',3],['out',101],['in',NaN],['other',20]])assert.throws(()=>regionTools.mixRegionPatch(t,kind,at));
});
