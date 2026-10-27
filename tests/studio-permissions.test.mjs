import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {allowStudioPermission}=createRequire(import.meta.url)('../desktop/studio-permissions.cjs');
const origin='http://127.0.0.1:43822',webContents={mainFrame:{url:origin+'/'},isDestroyed:()=>false},mainWindow={webContents};
const check=(patch={})=>allowStudioPermission({webContents,mainWindow,origin,permission:'media',requestingOrigin:origin,details:{isMainFrame:true,requestingUrl:origin+'/',mediaType:'audio'},...patch});
test('only audio and speaker selection are granted to the exact trusted main frame',()=>{
 assert.equal(check(),true);assert.equal(check({request:true,details:{isMainFrame:true,requestingUrl:origin+'/',mediaTypes:['audio']}}),true);
 assert.equal(check({permission:'speaker-selection',details:{isMainFrame:true,requestingUrl:origin+'/'}}),true);
 for(const mediaType of ['video','unknown',undefined])assert.equal(check({details:{isMainFrame:true,requestingUrl:origin+'/',mediaType}}),false);
 for(const mediaTypes of [['video'],['audio','video'],[],undefined])assert.equal(check({request:true,details:{isMainFrame:true,requestingUrl:origin+'/',mediaTypes}}),false);
 for(const permission of ['display-capture','clipboard-read','geolocation','notifications'])assert.equal(check({permission}),false);
});
test('camera, subframes, other windows, stale origins and null web contents stay denied',()=>{
 assert.equal(check({webContents:null}),false);assert.equal(check({webContents:{...webContents}}),false);assert.equal(check({requestingOrigin:'https://other.example'}),false);
 for(const patch of [{isMainFrame:false},{requestingUrl:'http://127.0.0.1:43821/'},{securityOrigin:'https://other.example'},{embeddingOrigin:'https://other.example'},{requestingUrl:undefined}])assert.equal(check({details:{isMainFrame:true,requestingUrl:origin+'/',mediaType:'audio',...patch}}),false);
 assert.equal(check({webContents:{mainFrame:{url:'https://other.example'}}}),false);
});
