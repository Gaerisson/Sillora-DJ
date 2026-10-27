const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(Number(n))?Number(n):lo));
export const visualDefaults=Object.freeze({mode:'rings',intensity:.55,speed:.6,quality:'balanced',sensitivity:1.2,min:0,max:1,palette:'brand',decks:true,waveforms:false,scale:1,rotation:0,mirror:false});
export function sanitizeVisualSettings(value={}){
 if(!value||typeof value!=='object')value={};
 const read=(key,fallback)=>value[key]??value['visual'+key[0].toUpperCase()+key.slice(1)]??fallback;
 const min=clamp(read('min',0),0,.95),max=clamp(read('max',1),min+.05,1);
 return {mode:['spectrum','rings','particles','waves','orbit','petals','tunnel','ribbon'].includes(read('mode'))?read('mode'):'rings',intensity:clamp(read('intensity',.55),0,1),speed:clamp(read('speed',.6),0,2),quality:['low','balanced','high'].includes(read('quality'))?read('quality'):'balanced',sensitivity:clamp(read('sensitivity',1.2),.2,3),min,max,palette:['brand','rainbow','mono','ice','sunset'].includes(read('palette'))?read('palette'):'brand',decks:read('decks',true)!==false,waveforms:read('waveforms',false)===true,scale:clamp(read('scale',1),.5,1.6),rotation:clamp(read('rotation',0),-180,180),mirror:read('mirror',false)===true};
}
/** Match the backing store to the CSS rectangle. Drawing uses CSS pixel coordinates. */
export function resizeVisualCanvas(canvas,ratio=globalThis.devicePixelRatio||1){
 const box=canvas.getBoundingClientRect(),width=Math.max(1,box.width),height=Math.max(1,box.height),dpr=clamp(ratio,1,2),pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,width,height};
}
export function visualBins(bands=[],settings=visualDefaults,count=64){
 const v=sanitizeVisualSettings(settings),result=new Float32Array(count);
 for(let i=0;i<count;i++){const at=Math.floor((v.min+i/Math.max(1,count-1)*(v.max-v.min))*Math.max(0,bands.length-1));result[i]=clamp(Number(bands[at]||0)*v.sensitivity,0,1);}
 return result;
}
/** Audio-reactive graphics: without measured signal all movement falls still. */
export function drawProgramVisual(ctx,{width=ctx.canvas.width,height=ctx.canvas.height,bands=[],level=0,time=0,visual={},accentA='#75e5ce',accentB='#efae64',reducedMotion=false,transparent=false,background='#080b11',centerX=width/2,centerY=height/2,baseRadius=null}={}){
 if(!(width>0&&height>0))return;
 const v=sanitizeVisualSettings(visual),count=v.quality==='low'?32:v.quality==='high'?96:64,bins=visualBins(bands,v,count),power=clamp(level*v.sensitivity,0,1),motion=reducedMotion?0:time*.00025*v.speed;
 ctx.save();ctx.clearRect(0,0,width,height);if(!transparent){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}
 ctx.globalAlpha=v.intensity;const base=(baseRadius??Math.min(width,height)*.24)*v.scale,rotation=v.rotation*Math.PI/180;
 const color=i=>v.palette==='rainbow'?`hsl(${i/count*260+140} 78% 66%)`:v.palette==='ice'?`hsl(${180+i/count*55} 78% 70%)`:v.palette==='sunset'?`hsl(${320+i/count*85} 90% 70%)`:v.palette==='mono'?accentA:i<count/2?accentA:accentB;
 if(v.mode==='spectrum'){
  const gap=width/count,mid=height*.72;
  for(let i=0;i<count;i++){const amplitude=bins[i]*height*.53;ctx.fillStyle=color(i);ctx.fillRect(i*gap,mid-amplitude,Math.max(1,gap*.72),Math.max(1,amplitude));ctx.globalAlpha=v.intensity*.15;ctx.fillRect(i*gap,mid+3,Math.max(1,gap*.72),amplitude*.25);ctx.globalAlpha=v.intensity;}
 }else if(v.mode==='rings'){
  ctx.lineWidth=Math.max(1,Math.min(width,height)*.005);
  for(let i=0;i<count;i++){const bin=v.mirror?bins[Math.min(count-1,Math.floor(Math.abs(i-count/2)*2))]:bins[i],angle=i/count*Math.PI*2-Math.PI/2+rotation+motion*power*.18,inner=base*(1+power*.025),outer=inner+bin*base*.28;ctx.strokeStyle=color(i);ctx.beginPath();ctx.moveTo(centerX+Math.cos(angle)*inner,centerY+Math.sin(angle)*inner);ctx.lineTo(centerX+Math.cos(angle)*outer,centerY+Math.sin(angle)*outer);ctx.stroke();}
  ctx.globalAlpha=v.intensity*.18;ctx.strokeStyle=accentA;ctx.beginPath();ctx.arc(centerX,centerY,base*.88,0,Math.PI*2);ctx.stroke();
 }else if(v.mode==='waves'){
  ctx.lineWidth=Math.max(1,height*.009);
  for(let line=0;line<3;line++){ctx.strokeStyle=line%2?accentB:accentA;ctx.globalAlpha=v.intensity*(1-line*.24);ctx.beginPath();for(let i=0;i<count;i++){const x=i/(count-1)*width,amplitude=bins[i]*height*.27,y=centerY+Math.sin(i/count*Math.PI*(4+line*2)+motion*power)*amplitude*(line%2?-1:1);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
 }else if(v.mode==='orbit'||v.mode==='petals'||v.mode==='tunnel'){
  ctx.lineWidth=Math.max(1,Math.min(width,height)*.004);
  if(v.mode==='tunnel')for(let ring=0;ring<7;ring++){const radius=base*(.3+ring*.19)*(1+power*.09),phase=rotation+motion*power*.1;ctx.strokeStyle=color(Math.floor(ring/7*count));ctx.globalAlpha=v.intensity*(.15+ring/10);ctx.beginPath();for(let i=0;i<=count;i++){const angle=i/count*Math.PI*2+phase,r=radius*(1+(bins[i%count]||0)*.12),x=centerX+Math.cos(angle)*r,y=centerY+Math.sin(angle)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
  else for(let i=0;i<count;i++){const signal=bins[i],phase=i/count*Math.PI*2+rotation+motion*power*.15,radius=base*(v.mode==='orbit'?1+.12*Math.sin(phase*3):1+signal*.28);ctx.strokeStyle=color(i);ctx.fillStyle=color(i);ctx.globalAlpha=v.intensity*(.25+signal*.75);if(v.mode==='orbit'){ctx.beginPath();ctx.arc(centerX+Math.cos(phase)*radius,centerY+Math.sin(phase)*radius,1+signal*4,0,Math.PI*2);ctx.fill();}else{const end=phase+.08;ctx.beginPath();ctx.moveTo(centerX+Math.cos(phase)*base,centerY+Math.sin(phase)*base);ctx.lineTo(centerX+Math.cos(end)*radius,centerY+Math.sin(end)*radius);ctx.stroke();}}
 }else if(v.mode==='ribbon'){
  ctx.lineWidth=Math.max(1,height*.003);for(let line=0;line<8;line++){ctx.strokeStyle=color(Math.floor(line/8*count));ctx.globalAlpha=v.intensity*(.2+line*.08);ctx.beginPath();for(let i=0;i<count;i++){const x=i/(count-1)*width,y=centerY+Math.sin(i/count*Math.PI*3+line*.3+motion*power)*bins[i]*height*.25+(line-3.5)*6;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
 }else{
  for(let i=0;i<count;i++){const signal=bins[i],phase=i*2.399963+motion*power*(.12+i%3*.04),radius=base*(.3+Math.sqrt(i/count))*(1+signal*.75);ctx.fillStyle=color(i);ctx.globalAlpha=v.intensity*(.12+signal*.85);ctx.beginPath();ctx.arc(centerX+Math.cos(phase)*radius,centerY+Math.sin(phase)*radius,1+signal*5,0,Math.PI*2);ctx.fill();}
 }
 ctx.restore();
}
