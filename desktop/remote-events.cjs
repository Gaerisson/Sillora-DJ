class RemoteEvents{
 constructor(){this.clients=new Set();}
 subscribe(req,res,initial){
  if(this.clients.size>=12){res.writeHead(429);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.flushHeaders?.();
  this.clients.add(res);res.write('event: state\ndata: '+JSON.stringify(initial)+'\n\n');
  const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': alive\n\n');},15000);heartbeat.unref?.();
  const close=()=>{clearInterval(heartbeat);this.clients.delete(res);};req.on('close',close);res.on('close',close);
 }
 publish(state){if(!this.clients.size)return;const data='event: state\ndata: '+JSON.stringify(state)+'\n\n';for(const res of this.clients){if(res.destroyed){this.clients.delete(res);continue;}if(res.writableLength>512*1024){res.destroy();this.clients.delete(res);continue;}res.write(data);}}
 close(){for(const res of this.clients)res.end();this.clients.clear();}
}
module.exports={RemoteEvents};
