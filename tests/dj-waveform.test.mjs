import test from 'node:test';
import assert from 'node:assert/strict';
import {drawDJWaveform,rollingWaveRange} from '../public/dj-waveform.mjs';

test('arrival flags belong only to their prepared track and remain bounded',()=>{
 const labels=[],ctx={canvas:{width:600,height:94},save(){},restore(){},clearRect(){},fillRect(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},closePath(){},fill(){},fillText(text){labels.push(text);},measureText(s){return{width:s.length*5};}};
 const track={id:'target',bpm:120,buffer:{duration:40}},point={version:1,trackId:'target',time:16,label:'R1'};drawDJWaveform(ctx,{track,arrivalPoint:point});assert.ok(labels.includes('ARRIVÉE R1'));
 for(const patch of [{trackId:'old'},{time:-1},{time:40},{time:NaN}]){labels.length=0;drawDJWaveform(ctx,{track,arrivalPoint:{...point,...patch}});assert.ok(!labels.some(l=>l.startsWith('ARRIVÉE')));}
});

test('waveform arrangement flags use only confident in-range cached landmarks',()=>{
 const labels=[],rects=[],ctx={canvas:{width:600,height:94},save(){},restore(){},clearRect(){},fillRect(...r){rects.push(r);},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},closePath(){},fill(){},fillText(text,x,y){labels.push({text,x,y});},measureText(s){return{width:s.length*5};}};
 const track={bpm:120,buffer:{duration:20,getChannelData(){throw Error('No PCM in drawing');}},arrangement:{version:1,landmarks:[{time:4,confidence:.9,kind:'lift'},{time:12,confidence:.2,kind:'change'},{time:22,confidence:.95,kind:'release'}]}};
 drawDJWaveform(ctx,{track,from:0,to:20});assert.ok(labels.some(p=>p.text==='R1'&&p.x>=120&&p.x<140));assert.ok(!labels.some(p=>p.text==='R2'||p.text==='R3'));assert.ok(rects.every(r=>r.every(Number.isFinite)));
});

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
