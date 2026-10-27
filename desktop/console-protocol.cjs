const ranges={gainDb:[-24,24],thresholdDb:[-70,-6],depthDb:[0,60],attackMs:[5,2000],holdMs:[0,5000],releaseMs:[50,5000],preDelayMs:[0,2000],hysteresisDb:[0,18],highpassHz:[20,500],eqLowDb:[-18,18],eqMidDb:[-18,18],eqHighDb:[-18,18],eqMidHz:[180,8000],eqMidQ:[.2,10],gateThresholdDb:[-80,-6],gateRangeDb:[0,90],gateAttackMs:[1,100],gateHoldMs:[0,2000],gateReleaseMs:[10,2000],compThresholdDb:[-60,0],compRatio:[1,20],compKneeDb:[0,40],compAttackMs:[.1,500],compReleaseMs:[10,3000],makeupDb:[-12,24],ceilingDb:[-18,-.1],limitReleaseMs:[10,1500],autoNotchThresholdDb:[-70,-3],autoNotchProminenceDb:[6,40],autoNotchHoldMs:[300,5000],autoNotchQ:[3,40],autoNotchDepthDb:[-24,-1]};
const booleans=['monitor','compress','duckEnabled','hpEnabled','gateEnabled','limitEnabled','autoNotchEnabled'];
const enums={mode:['mic','line'],triggerMode:['auto','manual'],curve:['exp','linear','smooth']};
const fail=()=>{throw Object.assign(new Error('Réglage de console invalide.'),{code:'INVALID'});};
const device=v=>typeof v==='string'&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
function audioPatch(value){if(!value||typeof value!=='object'||Array.isArray(value))fail();const result={};for(const [key,v]of Object.entries(value)){
 if(key in ranges){if(!Number.isFinite(v)||v<ranges[key][0]||v>ranges[key][1])fail();result[key]=v;}
 else if(booleans.includes(key)){if(typeof v!=='boolean')fail();result[key]=v;}
 else if(key in enums){if(!enums[key].includes(v))fail();result[key]=v;}
 else if(key==='inputDeviceId'){if(!device(v))fail();result[key]=v;}
 else if(key==='notches'){if(!Array.isArray(v)||v.length!==3)fail();result[key]=v.map(n=>{if(!n||typeof n.enabled!=='boolean'||!Number.isFinite(n.frequency)||n.frequency<100||n.frequency>12000||!Number.isFinite(n.Q)||n.Q<1||n.Q>40||!Number.isFinite(n.depthDb)||n.depthDb<-30||n.depthDb>0)fail();return{enabled:n.enabled,frequency:n.frequency,Q:n.Q,depthDb:n.depthDb};});}
 else fail();
 }return result;}
function audioState(value={}){const options={};for(const key of [...Object.keys(ranges),...booleans,...Object.keys(enums),'inputDeviceId','notches']){if(key in (value.options||{}))try{Object.assign(options,audioPatch({[key]:value.options[key]}));}catch{}}
 return{inputDb:bound(value.inputDb,-100,-100,12),waveform:(value.waveform||[]).slice(0,128).map(x=>bound(x,0,-1,1)),outputDb:bound(value.outputDb,-100,-100,12),peakDb:bound(value.peakDb,-100,-100,12),armed:value.armed===true,starting:value.starting===true,talking:value.talking===true,monitor:value.monitor===true,levelDb:bound(value.levelDb,-100,-100,6),reductionDb:bound(value.reductionDb,0,0,60),options,autoNotches:(value.autoNotches||[]).slice(0,3).map(n=>({frequency:bound(n.frequency,1000,100,12000),Q:bound(n.Q,18,1,40),depthDb:bound(n.depthDb,-9,-30,0)})),dynamics:{gateOpen:value.dynamics?.gateOpen===true,compressionDb:bound(value.dynamics?.compressionDb,0,0,60),limitReductionDb:bound(value.dynamics?.limitReductionDb,0,0,60)},error:typeof value.error==='string'?value.error.slice(0,220):''};
}
function bound(v,f,min,max){return Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;}
const programRanges={highpass:[20,160],low:[-12,12],mid:[-12,12],high:[-12,12],balance:[-1,1],dimDb:[6,36],ceilingDb:[-12,-.1],pumpDepth:[0,6],pumpRelease:[60,450],pumpThreshold:[-48,-12],pumpCrossover:[80,220]};
function programPatch(value){if(!value||typeof value!=='object'||Array.isArray(value))fail();const result={};for(const [key,v]of Object.entries(value)){if(key in programRanges){if(!Number.isFinite(v)||v<programRanges[key][0]||v>programRanges[key][1])fail();result[key]=v;}else if(['mono','dim','muted','pumpEnabled'].includes(key)){if(typeof v!=='boolean')fail();result[key]=v;}else fail();}return result;}
module.exports={audioPatch,audioState,programPatch};
