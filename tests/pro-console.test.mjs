import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeLogo,sanitizeBranding,parseBrandLook,exportBrandLook} from '../public/branding.js';
import {sanitizeVisualSettings,visualBins,drawProgramVisual} from '../public/visual-renderer.mjs';
import {rangeFraction,quantizedRangeValue} from '../public/dj-controls.js';
import {mergeSurfaceState} from '../public/surface.js';

test('personal branding round trips while rejecting remote, active and oversized logo sources',()=>{
 const logo='data:image/png;base64,aGVsbG8=';
 const original=sanitizeBranding({name:'Mon set',logo,accentA:'#abcdef',accentB:'#fedcba',logoSize:55,visualMode:'waves',visualMin:.1,visualMax:.8});
 assert.deepEqual(parseBrandLook(exportBrandLook(original)),original);
 assert.equal(sanitizeLogo('https://example.com/logo.png'),'');
 assert.equal(sanitizeLogo('data:image/svg+xml;base64,PHN2Zz4='),'');
 assert.equal(sanitizeLogo('data:image/png;base64,'+'a'.repeat(700001)),'');
 assert.throws(()=>parseBrandLook('{"application":"Other","brand":{}}'));
 assert.throws(()=>parseBrandLook('a'.repeat(1000001)));
 assert.equal(sanitizeBranding(null).name,'SILLORA');
});

test('invalid styling cannot escape color or image constraints and all visual ranges remain usable',()=>{
 const state=sanitizeBranding({name:'a'.repeat(100),logo:'javascript:alert(1)',accentA:'red;display:none',logoSize:900,visualMin:.95,visualMax:.05,visualIntensity:99,visualSensitivity:-4,visualMode:'script'});
 assert.equal(state.name.length,36);assert.equal(state.logo,'');assert.equal(state.accentA,'#75e5ce');assert.equal(state.logoSize,80);
 assert.equal(state.visualMin,.95);assert.equal(state.visualMax,1);assert.equal(state.visualIntensity,1);assert.equal(state.visualSensitivity,.2);assert.equal(state.visualMode,'rings');
 assert.equal(sanitizeVisualSettings(null).mode,'rings');
});

test('surface position updates keep metadata, while a new track cannot retain an old cover or title',()=>{
 const first=mergeSurfaceState({}, {type:'metadata',decks:[{id:'a',title:'Première',cover:'data:image/png;base64,aGVsbG8='}],brand:{name:'SET'}});
 const next=mergeSurfaceState(first,{type:'frame',decks:[{id:'a',position:12,duration:180}],level:.3});
 assert.equal(next.decks[0].title,'Première');assert.equal(next.decks[0].position,12);assert.equal(next.brand.name,'SET');
 const changed=mergeSurfaceState(next,{type:'frame',decks:[{id:'b',position:0}]});assert.equal(changed.decks[0].title,undefined);assert.equal(changed.decks[0].cover,undefined);
});

test('knob normalization preserves bipolar center, clamped endpoints and fractional steps',()=>{
 assert.equal(rangeFraction({min:'-18',max:'18',value:'0'}),.5);
 assert.equal(rangeFraction({min:'-24',max:'12',value:'0'}),.5);
 assert.equal(rangeFraction({min:'0',max:'1',value:'2'}),1);
 assert.equal(quantizedRangeValue(-25,-18,18,.5),-18);
 assert.equal(quantizedRangeValue(.36,-1,1,.05),.35);
});

function drawing(){
 const commands=[];const coordinates=(name,...values)=>{assert.ok(values.every(Number.isFinite));commands.push([name,...values]);};
 const ctx={canvas:{width:800,height:600},save(){},restore(){},clearRect:(...v)=>coordinates('clear',...v),fillRect:(...v)=>coordinates('rect',...v),beginPath(){},moveTo:(...v)=>coordinates('move',...v),lineTo:(...v)=>coordinates('line',...v),stroke(){},arc:(...v)=>coordinates('arc',...v),fill(){}};return {ctx,commands};
}
test('visuals use bounded measured bands and every mode remains finite, including a silent programme',()=>{
 assert.deepEqual([...visualBins([NaN,Infinity,-1,9],{},4)],[0,0,0,1]);
 for(const mode of ['spectrum','rings','particles','waves']){
  const silentA=drawing(),silentB=drawing();drawProgramVisual(silentA.ctx,{visual:{mode},time:0});drawProgramVisual(silentB.ctx,{visual:{mode},time:100000});assert.deepEqual(silentA.commands,silentB.commands,'Silence does not create fake audio motion');
  const signal=drawing();drawProgramVisual(signal.ctx,{bands:Array.from({length:64},(_,i)=>i/63),level:.7,time:10000,visual:{mode}});assert.ok(signal.commands.length>10);
  const reducedA=drawing(),reducedB=drawing();for(const [target,time] of [[reducedA,0],[reducedB,10000]])drawProgramVisual(target.ctx,{bands:[.4,.6,.3],level:.6,time,visual:{mode},reducedMotion:true});assert.deepEqual(reducedA.commands,reducedB.commands);
 }
});
