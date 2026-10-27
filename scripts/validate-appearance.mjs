import assert from 'node:assert/strict';
import {skins,sanitizeAppearance,appearanceColors,contrast,exportLook,parseLook} from '../public/appearance-settings.mjs';
const results=[];
for(const skin of skins){const p=appearanceColors(sanitizeAppearance({skin:skin.id}));const ratios={text:contrast(p.text,p.panel),secondary:contrast(p.muted,p.panel),accentA:contrast(p.a,p.panel),accentB:contrast(p.b,p.panel)};assert.ok(Object.values(ratios).every(r=>r>=4.5));results.push({skin:skin.id,ratios});}
for(const skin of skins)for(const accent of ['#000000','#ffffff','#777777','#ff0000','#00ff00','#0000ff']){const p=appearanceColors(sanitizeAppearance({skin:skin.id,customColors:true,accentA:accent,accentB:accent}));assert.ok(contrast(p.a,p.panel)>=4.5);assert.ok(contrast(p.b,p.panel)>=4.5);}
const valid=sanitizeAppearance({skin:'neon',glow:0,radius:0,motion:false,customColors:true,accentA:'#123abc'});assert.deepEqual(parseLook(exportLook(valid)),valid);
const bad=sanitizeAppearance({skin:'javascript:alert(1)',glow:Infinity,radius:-100,layout:'whatever',accentA:'url(https://evil.example)',customColors:true});assert.equal(bad.skin,'obsidian');assert.equal(bad.radius,0);assert.equal(bad.accentA,'#86dfeb');
for(const input of ['null','{}','{"format":"sillage-look","version":2,"appearance":{}}','{"format":"sillage-look","version":1,"appearance":[]}'])assert.throws(()=>parseLook(input));
console.log(JSON.stringify({passed:true,skins:results,customColorCombinations:36,malformedImportRejected:true},null,2));
