export function drawLiveWave(canvas,state={},duck=0){
 const box=canvas.getBoundingClientRect(),width=Math.max(1,box.width),height=Math.max(1,box.height),dpr=Math.min(2,devicePixelRatio||1);
 if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 const color=getComputedStyle(canvas).getPropertyValue('--a').trim()||'#62d8c4',wave=state.waveform||[],mid=height*.38,range=height*.28;
 ctx.strokeStyle='#8193a433';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,height*i/4);ctx.lineTo(width,height*i/4);ctx.stroke();}
 ctx.strokeStyle=state.talking?color:'#96a8b8';ctx.lineWidth=1.6;ctx.beginPath();for(let i=0;i<wave.length;i++){const x=i/Math.max(1,wave.length-1)*width,y=mid-Math.max(-1,Math.min(1,wave[i]))*range;(i?ctx.lineTo(x,y):ctx.moveTo(x,y));}ctx.stroke();
 ctx.fillStyle='#8193a433';ctx.fillRect(0,height-17,width,6);ctx.fillStyle=color;ctx.fillRect(0,height-17,width*10**(-Math.min(60,duck)/20),6);
 ctx.font='9px Segoe UI';ctx.fillStyle='#9baebc';ctx.fillText('MIC',5,11);ctx.fillText('MUSIQUE −'+duck.toFixed(1)+' dB',5,height-23);
}
