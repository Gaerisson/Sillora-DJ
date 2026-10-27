import test from 'node:test';import assert from 'node:assert/strict';import {programOptions,programMatrix} from '../public/program-bus.js';import {PeakLimiter} from '../public/peak-limiter.mjs';
test('mono sums both sources equally while balance attenuates only the chosen output',()=>{assert.deepEqual(programMatrix({mono:true}),[.5,.5,.5,.5]);assert.deepEqual(programMatrix({mono:true,balance:-.6}),[.5,.5,.2,.2]);assert.deepEqual(programMatrix({balance:1}),[0,0,0,1]);});
test('program parameters remain bounded under imported or remote settings',()=>{const o=programOptions({highpass:-10,ceilingDb:2,balance:99,low:Infinity,mid:-90,muted:'false'});assert.equal(o.highpass,20);assert.equal(o.ceilingDb,-.1);assert.equal(o.balance,1);assert.equal(o.low,0);assert.equal(o.mid,-12);assert.equal(o.muted,false);});

test('sidechain starts gently disabled and constrains imported settings to its musical range',()=>{
 const fresh=programOptions(null);assert.equal(fresh.pumpEnabled,false);assert.equal(fresh.pumpDepth,2.5);assert.equal(fresh.pumpRelease,180);assert.equal(fresh.pumpThreshold,-27);assert.equal(fresh.pumpCrossover,150);
 const imported=programOptions({pumpEnabled:'true',pumpDepth:40,pumpRelease:-100,pumpThreshold:-100,pumpCrossover:Infinity});
 assert.equal(imported.pumpEnabled,false);assert.equal(imported.pumpDepth,6);assert.equal(imported.pumpRelease,60);assert.equal(imported.pumpThreshold,-48);assert.equal(imported.pumpCrossover,150);
 const quiet=programOptions({pumpEnabled:true,pumpDepth:0,pumpRelease:450,pumpThreshold:-12,pumpCrossover:220});
 assert.equal(quiet.pumpEnabled,true);assert.equal(quiet.pumpDepth,0);assert.equal(quiet.pumpRelease,450);assert.equal(quiet.pumpThreshold,-12);assert.equal(quiet.pumpCrossover,220);
});
test('configurable stereo limiter obeys its ceiling with transient input',()=>{const limiter=new PeakLimiter(48000);limiter.setCeilingDb(-6);const input=[new Float32Array(48000).fill(4),new Float32Array(48000).fill(2)],out=input.map(c=>new Float32Array(c.length));limiter.process(input,out);assert.ok(out[0].every(v=>Math.abs(v)<=10**(-6/20)+1e-6));assert.ok(out[0].slice(1000).some(v=>v>.4));for(let i=2000;i<4000;i++)assert.ok(Math.abs(out[1][i]*2-out[0][i])<1e-6);});
