import test from 'node:test';
import assert from 'node:assert/strict';
import {drawDJWaveform,rollingWaveRange} from '../public/dj-waveform.mjs';

test('rolling view preserves its playhead at one quarter before the first beat and near the end',()=>{
  for(const bpm of [98,110,128])for(const position of [0,1,100,239]){
    const [from,to]=rollingWaveRange(position,bpm,16);
    assert.ok(Math.abs((position-from)/(to-from)-.25)<1e-12);
    assert.ok(Math.abs((to-from)*bpm/60-16)<1e-10);
  }
  assert.ok(rollingWaveRange(0,120)[0]<0,'missing audio before the first beat stays empty');
});

test('spectral waveform reads only cached analysis, keeps coordinates finite and leaves absent audio empty',()=>{
  const paths=[],coordinates=[];let current=[];
  const context={canvas:{width:800,height:90},save(){},restore(){},clearRect(){},fillRect(...args){coordinates.push(args);},beginPath(){current=[];},rect(){},clip(){},moveTo(x,y){current.push([x,y]);},lineTo(x,y){current.push([x,y]);},closePath(){},fill(){paths.push(current);},fillText(){},measureText(s){return{width:s.length*5};},createLinearGradient(){return{addColorStop(){}};}};
  const track={bpm:120,peaks:[.2,.7,1,.4],buffer:{duration:2,getChannelData(){throw Error('Drawing must never scan decoded music');}},waveBands:{low:[.7,.2,.1,.5],mid:[.2,.6,.2,.3],high:[.1,.2,.7,.2]}};
  drawDJWaveform(context,{track,position:0,from:-1,to:3});
  const spectral=paths.filter(path=>path.length>10);
  assert.equal(spectral.length,3);
  for(const path of spectral)for(const point of path)assert.ok(point.every(Number.isFinite));
  for(const rect of coordinates)assert.ok(rect.every(Number.isFinite));
  // Negative time is silence rather than a repeated first sample.
  for(const path of spectral){const preRoll=path.filter(([x])=>x<190);assert.ok(preRoll.length>0);assert.ok(preRoll.every(([,y])=>y===48));}
});
