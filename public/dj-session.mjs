import {rankCandidates,selectNextTrack,selectionModes} from './dj-library.mjs';

export class DJSession{
 constructor(){this.clear();}
 get mode(){return this._mode;}
 set mode(value){this._mode=Object.hasOwn(selectionModes,value)?value:'compatible';}
 start({scope=null,tracks=[],current=null,mode='compatible'}={}){
  this.clear();this.enabled=true;this.mode=mode;
  this.scope=scope?{id:scope.id,path:scope.path,name:scope.name}:null;
  const seen=new Set();this.tracks=tracks.filter(track=>{if(!track||track.id===undefined||track.id===null||seen.has(track.id))return false;seen.add(track.id);return true;});
  if(current)this.markPlayed(current);
  return this;
 }
 markPlayed(track){
  if(!this.enabled||track?.id===undefined||track?.id===null)return;
  this.played.add(track.id);this.recent=this.recent.filter(id=>id!==track.id);this.recent.push(track.id);this.recent=this.recent.slice(-4);
 }
 next(current,{exclude=[],random,transition}={}){
  if(!this.enabled)return null;
  return selectNextTrack(current,this.tracks,{mode:this.mode,played:[...this.played],recent:this.recent,exclude,random,transition});
 }
 recommendations(current,{exclude=[],transition}={}){
  return this.enabled?rankCandidates(current,this.tracks,{played:[...this.played],recent:this.recent,exclude,transition}):[];
 }
 remaining(current){
  if(!this.enabled)return 0;
  return this.tracks.filter(track=>track.id!==current?.id&&!this.played.has(track.id)).length;
 }
 clear(){this.enabled=false;this.scope=null;this.tracks=[];this.played=new Set();this.recent=[];this.mode='compatible';return this;}
}
