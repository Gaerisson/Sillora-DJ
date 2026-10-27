import test from 'node:test';
import assert from 'node:assert/strict';
import {eqEnvelope} from '../public/transition-envelopes.mjs';
test('EQ automation hands bass over asymmetrically and resolves mid/high bands at the incoming edge',()=>{
 const halfway=eqEnvelope('bass',.5),end=eqEnvelope('bass',1);
 assert.ok(Math.abs(halfway.out[0]+18*.03/.13)<1e-9);
 assert.ok(Math.abs(halfway.in[0]+18*.03/.13)<1e-9);
 assert.equal(halfway.out[1],2);assert.equal(halfway.in[1],2);
 assert.deepEqual(end.out,[-18,-9,-12]);assert.deepEqual(end.in,[0,0,0]);
});
test('Dissolve withdraws both spectral extremes while its mid-band boost rises and falls',()=>{
 assert.deepEqual(eqEnvelope('dissolve',0),{out:[0,0,0],in:[-24,-24,0]});
 assert.equal(eqEnvelope('dissolve',.55).out[1],3);
 assert.deepEqual(eqEnvelope('dissolve',1),{out:[-24,0,-24],in:[0,0,0]});
 for(const style of ['bass','dissolve'])for(let i=0;i<=1000;i++)for(const value of Object.values(eqEnvelope(style,i/1000)).flat())assert.ok(Number.isFinite(value)&&value>=-24&&value<=3);
});
