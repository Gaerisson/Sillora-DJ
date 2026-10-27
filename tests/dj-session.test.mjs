import test from 'node:test';
import assert from 'node:assert/strict';
import {DJSession} from '../public/dj-session.mjs';
const song=(id,bpm=120)=>({id,title:id,bpm,keyRoot:0,keyMode:'major',keyConfidence:.8,rms:.12,confidence:'manual'});
const scope={id:'folder-a',path:'D:\\Music\\A',name:'A',files:['not retained']};

test('session is isolated to passed folder tracks and retains actual references without duplicate ids',()=>{
 const a=song('a'),b=song('b'),foreign=song('foreign'),session=new DJSession();
 assert.equal(session.next(a),null);assert.equal(session.remaining(a),0);assert.deepEqual(session.recommendations(a),[]);
 session.start({scope,tracks:[a,b,a,null,{}],current:a});
 assert.equal(session.enabled,true);assert.deepEqual(session.scope,{id:scope.id,path:scope.path,name:'A'});assert.notEqual(session.scope,scope);
 assert.deepEqual(session.tracks,[a,b]);assert.equal(session.next(a),b);assert.equal(session.next(foreign),b);assert.equal(session.remaining(a),1);
 b.bpm=124;assert.equal(session.tracks[1].bpm,124);
});

test('next neither reserves nor marks a track and exhaustion requires an explicit restart',()=>{
 const tracks=[song('a'),song('b'),song('c')],session=new DJSession().start({scope,tracks,current:tracks[0],mode:'shuffle'});
 const first=session.next(tracks[0],{random:()=>0});assert.equal(first.id,'b');assert.equal(session.next(tracks[0],{random:()=>0}),first);assert.deepEqual([...session.played],['a']);
 session.markPlayed(first);const second=session.next(first,{random:()=>0});assert.equal(second.id,'c');session.markPlayed(second);
 assert.equal(session.next(second),null);assert.equal(session.remaining(second),0);assert.deepEqual(session.recommendations(second),[]);
 session.start({scope,tracks,current:second,mode:'order'});assert.equal(session.next(second).id,'a');assert.deepEqual([...session.played],['c']);
});

test('exclusions affect next and recommendations without changing history or folder membership',()=>{
 const tracks=[song('a'),song('b'),song('c',124)],session=new DJSession().start({scope,tracks,current:tracks[0]});
 assert.equal(session.next(tracks[0],{exclude:['b']}).id,'c');assert.deepEqual(session.recommendations(tracks[0],{exclude:[tracks[1]]}).map(item=>item.track.id),['c']);
 assert.deepEqual([...session.played],['a']);assert.equal(session.remaining(tracks[0]),2);assert.equal(session.next(tracks[0]).id,'b');
});

test('changing mode preserves played history and invalid modes safely use compatibility',()=>{
 const tracks=[song('a'),song('b',145),song('c',121)],session=new DJSession().start({scope,tracks,current:tracks[0],mode:'order'});
 assert.equal(session.next(tracks[0]).id,'b');session.mode='compatible';assert.equal(session.next(tracks[0]).id,'c');
 session.markPlayed(tracks[2]);session.mode='shuffle';assert.equal(session.next(tracks[2],{random:()=>0}).id,'b');
 assert.deepEqual([...session.played],['a','c']);session.mode='obsolete';assert.equal(session.mode,'compatible');assert.equal(session.next(tracks[2]).id,'b');
});

test('recent history stays unique, capped at four, and clear fully resets state',()=>{
 const tracks=Array.from({length:6},(_,i)=>song(String(i))),session=new DJSession().start({scope,tracks});
 tracks.forEach(track=>session.markPlayed(track));session.markPlayed(tracks[3]);assert.deepEqual(session.recent,['2','4','5','3']);assert.equal(session.played.size,6);
 session.clear();assert.equal(session.enabled,false);assert.equal(session.scope,null);assert.deepEqual(session.tracks,[]);assert.deepEqual(session.recent,[]);assert.equal(session.played.size,0);assert.equal(session.mode,'compatible');
 session.markPlayed(tracks[0]);assert.equal(session.played.size,0);
});
