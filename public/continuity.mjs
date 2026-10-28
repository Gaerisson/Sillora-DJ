// A bounded emergency hold is only used while another title is being prepared.
// It never replays an exhausted set, or replaces a user loop.
export function continuityWindow(track,position){
 const duration=track?.buffer?.duration;if(!Number.isFinite(duration)||duration<1)return null;
 const beat=60/(track.bpm||120),offset=track.downbeat??track.beatOffset??0;
 const limit=Math.min(duration-.03,Number.isFinite(track.audibleEnd)?track.audibleEnd:duration-.03);
 let end=offset+Math.floor((limit-offset)/beat)*beat;
 if(end<position+.15)end=limit;if(end<position+.1)return null;
 const start=Math.max(0,end-Math.min(8*beat,end));if(end-start<.5)return null;
 return{start,end,kind:'continuity'};
}
