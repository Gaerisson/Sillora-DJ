import test from 'node:test';import assert from 'node:assert/strict';import {KickPumping} from '../public/pumping-dsp.mjs';
const sr=48000;
function render(options,{steady=false,antiphase=false}={}){
 const length=sr*3,input=[new Float32Array(length),new Float32Array(length)],output=input.map(x=>new Float32Array(x.length));
 for(let i=0;i<length;i++){const t=i/sr,p=t%.5,kick=steady?.45:.65*Math.exp(-p*35)*(p<.16?1:0),value=kick*Math.sin(2*Math.PI*55*t)+.12*Math.sin(2*Math.PI*1500*t);input[0][i]=value;input[1][i]=antiphase?-value:value;}
 const dsp=new KickPumping(sr,options);let reduction=0;for(let at=0;at<length;at+=128){const end=Math.min(length,at+128);dsp.process(input.map(x=>x.subarray(at,end)),output.map(x=>x.subarray(at,end)));reduction=Math.max(reduction,dsp.stats.reductionDb);}
 return{input,output,dsp,reduction};
}
function amplitude(samples,hz,from,to){let re=0,im=0;const start=Math.round(from*sr),end=Math.round(to*sr);for(let i=start;i<end;i++){re+=samples[i]*Math.cos(2*Math.PI*hz*i/sr);im+=samples[i]*Math.sin(2*Math.PI*hz*i/sr);}return 2*Math.hypot(re,im)/(end-start);}
test('disabled pumping is sample-exact bypass, including stereo kick transients',()=>{const r=render({pumpEnabled:false});assert.deepEqual(r.output,r.input);assert.equal(r.reduction,0);});
test('kick pumping is gentle, retains bass and ducks the upper band with a linked stereo gain',()=>{
 const r=render({pumpEnabled:true});assert.ok(r.reduction>1&&r.reduction<=2.5);assert.ok(r.dsp.kicks>=5&&r.dsp.kicks<=7);
 const high=amplitude(r.output[0],1500,1.51,1.60)/amplitude(r.input[0],1500,1.51,1.60),low=amplitude(r.output[0],55,1.51,1.60)/amplitude(r.input[0],55,1.51,1.60);
 assert.ok(low>high+.04,`Kick bass retained (${low}) more than upper band (${high})`);assert.ok(high>.70&&high<.95);assert.deepEqual(r.output[0],r.output[1]);
 let error=0;for(let i=sr*2.4;i<sr*2.48;i++)error=Math.max(error,Math.abs(r.output[0][i]-r.input[0][i]));assert.ok(error<.001,'Release restores the music before the next kick');
});
test('detector resists a sustained bass and still detects opposite-phase stereo kicks',()=>{
 const steady=render({pumpEnabled:true},{steady:true});assert.ok(steady.dsp.kicks<=2,'Sustained sub is not treated as repeated kicks');
 const r=render({pumpEnabled:true},{antiphase:true});assert.ok(r.reduction>1);let difference=0;for(let i=0;i<r.output[0].length;i++)difference=Math.max(difference,Math.abs(r.output[0][i]+r.output[1][i]));assert.ok(difference<1e-7);
});
test('off, zero depth and reset release attenuation without non-finite audio or stuck gain',()=>{
 const dsp=new KickPumping(sr,{pumpEnabled:true,pumpDepth:99});assert.equal(dsp.options.pumpDepth,6);const input=[new Float32Array(128).fill(.2)],out=[new Float32Array(128),new Float32Array(128)];
 dsp.process(input,out);dsp.set({pumpEnabled:false});for(let i=0;i<100;i++)dsp.process(input,out);assert.ok(out.every(ch=>ch.every(x=>Number.isFinite(x)&&Math.abs(x-.2)<1e-6)));dsp.reset();assert.equal(dsp.stats.reductionDb,0);
 const zero=render({pumpEnabled:true,pumpDepth:0});assert.deepEqual(zero.output,zero.input);
});
