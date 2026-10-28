// Constant-tempo grid edits are preparation metadata, independent of deck speed.
const durationOf=track=>track?.buffer?.duration??track?.duration;
export function checkedGrid(grid,duration){
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(grid?.bpm)||grid.bpm<40||grid.bpm>240||!Number.isFinite(grid.downbeat)||grid.downbeat<0||grid.downbeat>duration)throw Error('Grille invalide : BPM 40–240 et premier temps dans le morceau.');
 return {bpm:grid.bpm,downbeat:grid.downbeat,beatOffset:grid.downbeat};
}
export function readGrid(track){return checkedGrid({bpm:track?.bpm,downbeat:track?.downbeat??track?.beatOffset??0},durationOf(track));}
export function gridRevision(track){return JSON.stringify([track?.bpm,track?.downbeat,track?.beatOffset,Boolean(track?.manualGrid),track?.confidence,track?.analysisVersion]);}
function equivalentAnchor(anchor,bpm,duration){
 if(anchor>=0&&anchor<=duration)return anchor;
 const bar=240/bpm,wrapped=((anchor%bar)+bar)%bar;
 if(wrapped>duration)throw Error('Morceau trop court pour ce décalage.');
 return wrapped;
}
export function retimeGrid(grid,bpm,pivot,duration){
 checkedGrid({...grid,bpm},duration);
 if(!Number.isFinite(pivot)||pivot<0||pivot>duration)throw Error('Curseur hors du morceau.');
 const index=Math.round((pivot-grid.downbeat)*grid.bpm/60),fixed=grid.downbeat+index*60/grid.bpm;
 return checkedGrid({bpm,downbeat:equivalentAnchor(fixed-index*60/bpm,bpm,duration)},duration);
}
export function shiftGrid(grid,seconds,duration){
 if(!Number.isFinite(seconds))throw Error('Décalage invalide.');
 return checkedGrid({...grid,downbeat:equivalentAnchor(grid.downbeat+seconds,grid.bpm,duration)},duration);
}
export function calibrateGrid(start,end,beats,duration){
 if(!Number.isInteger(beats)||beats<1||beats>4096||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration||end<=start)throw Error('Placez deux repères croissants et indiquez leur distance en temps.');
 return checkedGrid({bpm:60*beats/(end-start),downbeat:start},duration);
}
export function automaticGrid(track){
 const analysis=track?.analysis;
 if(!analysis)throw Error('Analyse automatique indisponible.');
 return {...checkedGrid({bpm:analysis.bpm,downbeat:analysis.downbeat??analysis.beatOffset??0},durationOf(track)),manualGrid:false,confidence:analysis.confidence||'low'};
}
