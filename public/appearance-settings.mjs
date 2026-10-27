export const appearanceKey='sillage:appearance:v1';
export const skins=[
  {
    "id": "obsidian",
    "name": "Obsidienne",
    "tag": "STUDIO",
    "description": "Charbon mat, cyan & champagne.",
    "glow": 0.18,
    "palette": {
      "bg": "#0c0f15",
      "panel": "#171d27",
      "panel2": "#202937",
      "inset": "#101722",
      "raised": "#2a374a",
      "line": "#3c4b60",
      "text": "#edf3fb",
      "muted": "#b4c1d4",
      "dim": "#97abc5",
      "a": "#86dfeb",
      "b": "#f0bc8b",
      "warm": "#d9c5a6",
      "green": "#a2dfba",
      "violet": "#c9b7ef",
      "shadow": "#000000",
      "scheme": "dark"
    }
  },
  {
    "id": "aurora",
    "name": "Aurora",
    "tag": "ATMOSPHÈRE",
    "description": "Violet profond, lavande & menthe.",
    "glow": 0.24,
    "palette": {
      "bg": "#100f1b",
      "panel": "#1d1b2d",
      "panel2": "#28233e",
      "inset": "#151222",
      "raised": "#352d4c",
      "line": "#514563",
      "text": "#f0ebff",
      "muted": "#c3b7da",
      "dim": "#ad9bc5",
      "a": "#c7b3ff",
      "b": "#86e3d5",
      "warm": "#d8c5f5",
      "green": "#a9dfc2",
      "violet": "#d8b5f6",
      "shadow": "#090310",
      "scheme": "dark"
    }
  },
  {
    "id": "neon",
    "name": "Néon Club",
    "tag": "NIGHT SHIFT",
    "description": "Bleu nuit, électrique & rose poudré.",
    "glow": 0.3,
    "palette": {
      "bg": "#080d17",
      "panel": "#121c2c",
      "panel2": "#19263c",
      "inset": "#0c1423",
      "raised": "#233655",
      "line": "#3c5577",
      "text": "#e8f3ff",
      "muted": "#adc3e0",
      "dim": "#92afd2",
      "a": "#70e5f0",
      "b": "#f0a9d6",
      "warm": "#b4caff",
      "green": "#9be7c2",
      "violet": "#c1b8ff",
      "shadow": "#020614",
      "scheme": "dark"
    }
  },
  {
    "id": "ember",
    "name": "Braise",
    "tag": "GOLDEN HOUR",
    "description": "Bordeaux fumé, ambre & rose.",
    "glow": 0.17,
    "palette": {
      "bg": "#171112",
      "panel": "#271d20",
      "panel2": "#34272a",
      "inset": "#1d1519",
      "raised": "#493235",
      "line": "#654b4d",
      "text": "#f9efea",
      "muted": "#d8bdb5",
      "dim": "#c3a39a",
      "a": "#ffc28c",
      "b": "#efa9be",
      "warm": "#e9bb85",
      "green": "#c0d6ad",
      "violet": "#dfb5db",
      "shadow": "#100405",
      "scheme": "dark"
    }
  },
  {
    "id": "graphite",
    "name": "Graphite",
    "tag": "ESSENTIEL",
    "description": "Acier, contrastes doux & retenue.",
    "glow": 0.04,
    "palette": {
      "bg": "#121314",
      "panel": "#202225",
      "panel2": "#2b2d30",
      "inset": "#17191b",
      "raised": "#373b40",
      "line": "#52565e",
      "text": "#f0f1ee",
      "muted": "#c4c8cc",
      "dim": "#acb2b9",
      "a": "#c4dddd",
      "b": "#dbc7a8",
      "warm": "#d0d5cf",
      "green": "#bad5c3",
      "violet": "#c9c6da",
      "shadow": "#020203",
      "scheme": "dark"
    }
  },
  {
    "id": "porcelain",
    "name": "Porcelaine",
    "tag": "DAYLIGHT",
    "description": "Ivoire, pétrole & terre cuite.",
    "glow": 0.08,
    "palette": {
      "bg": "#eaece8",
      "panel": "#fafbf7",
      "panel2": "#e8edeb",
      "inset": "#f1f4f0",
      "raised": "#dce5e2",
      "line": "#b3c4c0",
      "text": "#1b3036",
      "muted": "#405d66",
      "dim": "#526d75",
      "a": "#006a78",
      "b": "#a94c27",
      "warm": "#a16a2d",
      "green": "#286e4e",
      "violet": "#69509a",
      "shadow": "#233d47",
      "scheme": "light"
    }
  }
];
export const defaultAppearance={version:1,skin:'obsidian',glow:0.18,radius:12,density:'comfortable',layout:'studio',motion:true,ambient:true,customColors:false,accentA:'#86dfeb',accentB:'#f0bc8b',showSession:true,showTextures:true};
const finite=(v,min,max,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function color(value,fallback){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;}
export function sanitizeAppearance(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const skin=skins.find(s=>s.id===value.skin)||skins[0],p=skin.palette;
  return{version:1,skin:skin.id,glow:finite(value.glow,0,0.45,skin.glow),radius:Math.round(finite(value.radius,0,22,12)),density:value.density==='compact'?'compact':'comfortable',layout:['studio','focus','wide'].includes(value.layout)?value.layout:'studio',motion:value.motion!==false,ambient:value.ambient!==false,customColors:value.customColors===true,accentA:color(value.accentA,p.a),accentB:color(value.accentB,p.b),showSession:value.showSession!==false,showTextures:value.showTextures!==false};
}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
export function mixColor(a,b,amount){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*amount).toString(16).padStart(2,'0')).join('');}
export function luminance(hex){return rgb(hex).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
export function readableAccent(value,background){const target=luminance(background)>0.45?'#000000':'#ffffff';for(let step=0;step<=100;step++){const candidate=mixColor(value,target,step/100);if(contrast(candidate,background)>=4.5)return candidate;}return target;}
export function appearanceColors(settings){
  const skin=skins.find(s=>s.id===settings.skin)||skins[0],p=skin.palette,a=readableAccent(settings.customColors?settings.accentA:p.a,p.panel),b=readableAccent(settings.customColors?settings.accentB:p.b,p.panel),light=p.scheme==='light';
  const foreground=bg=>contrast('#ffffff',bg)>contrast('#0b1620',bg)?'#ffffff':'#0b1620';
  return{...p,a,b,onA:foreground(a),onB:foreground(b),onWarm:foreground(p.warm),waveA:mixColor(a,p.panel,0.3),waveB:mixColor(b,p.panel,0.3),grid:mixColor(p.dim,p.inset,0.5),cues:light?['#006b80','#6b499b','#96520b','#236e43']:['#83e0ed','#c1adff','#f4c18a','#aae0b5']};
}
export function parseLook(text){let data;try{data=JSON.parse(text);}catch{throw new Error('Ce fichier ne contient pas un look JSON valide.');}if(data?.format!=='sillage-look'||data.version!==1||!data.appearance||typeof data.appearance!=='object'||Array.isArray(data.appearance))throw new Error('Choisissez un look Sillage exporté depuis Apparence.');return sanitizeAppearance(data.appearance);}
export function exportLook(appearance){return JSON.stringify({format:'sillage-look',version:1,appearance:sanitizeAppearance(appearance)},null,2);}

export function sanitizeLooks(value){return Array.isArray(value)?value.slice(0,6).filter(item=>item&&typeof item.name==='string'&&item.appearance).map(item=>({name:item.name.slice(0,32),appearance:sanitizeAppearance(item.appearance)})):[];}
