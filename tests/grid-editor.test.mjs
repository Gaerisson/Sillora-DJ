import test from 'node:test';import assert from 'node:assert/strict';
import {checkedGrid,readGrid,retimeGrid,shiftGrid,calibrateGrid,automaticGrid,gridRevision} from '../public/grid-editor.mjs';
const grid={bpm:120,downbeat:.25,beatOffset:.25};
test('tempo edits keep the nearest beat and its bar phase fixed at the chosen pivot',()=>{
 for(const bpm of [40,98.76,180,240])for(const pivot of [0,17.87,130,179.99]){
  const r=retimeGrid(grid,bpm,pivot,180),i=Math.round((pivot-.25)*2),fixed=.25+i*.5;
  const j=(fixed-r.downbeat)*bpm/60;assert.ok(Math.abs(j-Math.round(j))<1e-9);assert.ok(Math.abs((j-i)/4-Math.round((j-i)/4))<1e-9);assert.equal(r.beatOffset,r.downbeat);
 }
});
test('millisecond shifts wrap by whole bars only at file bounds and never clamp away phase',()=>{
 const r=shiftGrid({...grid,downbeat:0},-.005,180);assert.ok(Math.abs(r.downbeat-1.995)<1e-9);
 assert.ok(Math.abs(shiftGrid(grid,.001,180).downbeat-.251)<1e-9);
 assert.equal(shiftGrid({...grid,downbeat:179.9},.2,180).downbeat.toFixed(3),'0.100');
});
test('two-point calibration requires an explicit integer beat distance and rejects impossible grids',()=>{
 assert.deepEqual(calibrateGrid(10.123,42.123,64,180),{bpm:120,downbeat:10.123,beatOffset:10.123});
 for(const args of [[10,10,32,180],[20,10,32,180],[0,2,32,180],[0,179,2,180],[0,12,4.5,180],[0,181,32,180]])assert.throws(()=>calibrateGrid(...args));
});
test('automatic restore reads the measured baseline without modifying corrections or confidence',()=>{
 const t={...grid,bpm:128,manualGrid:true,confidence:'manual',buffer:{duration:180},analysis:{...grid,confidence:'low'}};
 assert.deepEqual(automaticGrid(t),{...grid,manualGrid:false,confidence:'low'});assert.equal(t.bpm,128);assert.equal(t.analysis.bpm,120);
 assert.throws(()=>automaticGrid({...t,analysis:null}));const before=gridRevision(t);t.downbeat+=.001;assert.notEqual(gridRevision(t),before);
});
test('grid validation rejects non-finite metadata and retains native precision',()=>{
 for(const patch of [{bpm:NaN},{bpm:241},{bpm:0},{downbeat:-1},{downbeat:Infinity},{downbeat:181}])assert.throws(()=>checkedGrid({...grid,...patch},180));
 assert.deepEqual(readGrid({bpm:123.4567,beatOffset:.1234567,duration:180}),{bpm:123.4567,downbeat:.1234567,beatOffset:.1234567});
});
