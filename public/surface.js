import {drawProgramVisual,sanitizeVisualSettings,resizeVisualCanvas} from './visual-renderer.mjs';
import {sanitizeBranding,sanitizeLogo} from './branding.js';
import {appearanceKey,sanitizeAppearance,appearanceColors,readableAccent} from './appearance-settings.mjs';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
export function mergeSurfaceState(current={},message={}){
 const incoming=message.state||message;
 const next={...current,...incoming};
 if(Array.isArray(incoming.decks))next.decks=incoming.decks.slice(0,2).map((deck,index)=>{
  const previous=current.decks?.[index]||{};
  return {...(deck.id!==undefined&&previous.id!==undefined&&deck.id!==previous.id?{}:previous),...deck};
 });
 next.brand=sanitizeBranding(incoming.brand||current.brand||{});
 next.visual=sanitizeVisualSettings(incoming.visual||current.visual||next.brand);
 return next;
}
function time(value){const seconds=Math.max(0,Number(value)||0);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;}
export function startSurface(){
 const $=selector=>document.querySelector(selector),desktop=window.sillageDesktop,mode=new URLSearchParams(location.search).get('mode')||desktop?.surfaceMode||'visuals';
 document.body.dataset.mode=['visuals','media','sound'].includes(mode)?mode:'visuals';
 const canvas=$('#program-visual'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let surfacePalette=null;
 function applyTheme(skin){let appearance={};try{appearance=JSON.parse(localStorage.getItem(appearanceKey)||'{}');}catch{}const settings=sanitizeAppearance({...appearance,...(skin?{skin}:{})});surfacePalette=appearanceColors(settings);document.documentElement.dataset.skin=settings.skin;document.documentElement.style.colorScheme=surfacePalette.scheme;for(const key of ['bg','panel','panel2','inset','raised','line','text','muted','dim'])if(surfacePalette[key])document.documentElement.style.setProperty('--'+key,surfacePalette[key]);}
 applyTheme();window.addEventListener('storage',event=>{if(event.key===appearanceKey)applyTheme();});
 $('#surface-mode-label').textContent=mode==='media'?'INFOS MÉDIA':mode==='sound'?'CONSOLE SON':'VISUELS';
 $('#surface-media').hidden=mode!=='media';$('#surface-sound').hidden=mode!=='sound';$('#surface-signature').hidden=mode!=='visuals';canvas.hidden=mode==='sound';
 let state={},lastFrame=0,lastDraw=0,channel=null,signature='',lastCover=null,lastLogo=null,fullscreen=false,top=false,destroyed=false;
 const status=text=>$('#surface-status').textContent=text;
 function receive(message){
  if(!message||!['metadata','frame','state'].includes(message.type)&&!message.decks)return;
  state=mergeSurfaceState(state,message);if(state.skin&&state.skin!==document.documentElement.dataset.skin)applyTheme(state.skin);if(message.type==='frame'||message.decks)lastFrame=performance.now();
  const brand=state.brand,active=state.active===1?1:0,deck=state.decks?.[active]||{},key=[brand.name,brand.accentA,brand.accentB,active,deck.id,deck.title,deck.artist,deck.album,deck.bpm,deck.key].join('\u0000');
  if(key!==signature||deck.cover!==lastCover||brand.logo!==lastLogo){signature=key;lastCover=deck.cover;lastLogo=brand.logo;document.title=brand.name+' · '+(mode==='media'?'Infos média':mode==='sound'?'Console son':'Visuels');$('#surface-brand').textContent=brand.name;$('#surface-name').textContent=brand.name;document.documentElement.style.setProperty('--a',readableAccent(brand.accentA,surfacePalette?.panel||'#111923'));document.documentElement.style.setProperty('--b',readableAccent(brand.accentB,surfacePalette?.panel||'#111923'));
   const logo=$('#surface-logo');if(brand.logo){logo.src=brand.logo;logo.hidden=false;}else{logo.removeAttribute('src');logo.hidden=true;}
   $('#media-title').textContent=deck.title||'Aucun morceau';$('#media-artist').textContent=deck.artist||'';$('#media-album').textContent=deck.album||'';$('#media-bpm').textContent=Number(deck.bpm)>0?Number(deck.bpm).toFixed(1)+' BPM':'— BPM';$('#media-key').textContent=deck.key||'Clé inconnue';$('#media-deck').textContent=active?'DECK B · PROGRAMME':'DECK A · PROGRAMME';
   const cover=$('#media-cover'),safeCover=sanitizeLogo(deck.cover);cover.hidden=!safeCover;$('#media-cover-empty').hidden=!!safeCover;if(safeCover)cover.src=safeCover;else cover.removeAttribute('src');
  }
  $('#media-position').textContent=time(deck.position);$('#media-duration').textContent=time(deck.duration);$('#media-progress-fill').style.width=`${clamp(deck.position/Math.max(1,deck.duration)*100,0,100)}%`;
  status('');
 }
 try{channel=new BroadcastChannel('sillage-program-v13');channel.onmessage=event=>receive(event.data);channel.postMessage({type:'ready',mode});}catch{}
 desktop?.surfaceState?.().then(snapshot=>{if(snapshot)receive(snapshot);}).catch(()=>status('Ouvrez le programme dans le studio.'));
 const setWindow=async options=>{try{if(!desktop?.surfaceWindow)throw new Error('Commande disponible dans l’application Windows.');await desktop.surfaceWindow(options);}catch(error){status(error.message);throw error;}};
 $('#surface-top').onclick=async()=>{try{await setWindow({alwaysOnTop:!top});top=!top;$('#surface-top').setAttribute('aria-pressed',String(top));}catch{}};
 $('#surface-fullscreen').onclick=async()=>{try{if(desktop?.surfaceWindow){await setWindow({fullscreen:!fullscreen});fullscreen=!fullscreen;}else{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();fullscreen=!!document.fullscreenElement;}$('#surface-fullscreen').setAttribute('aria-pressed',String(fullscreen));}catch(error){status(error.message);}};
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&fullscreen){fullscreen=false;desktop?.surfaceWindow?.({fullscreen:false}).catch(()=>{});$('#surface-fullscreen').setAttribute('aria-pressed','false');}});
 function resize(){resizeVisualCanvas(canvas);}
 resize();window.addEventListener('resize',resize);
 function draw(now){if(destroyed)return;const interval=state.visual?.quality==='low'?50:33;if(now-lastDraw>=interval){lastDraw=now;const stale=now-lastFrame>2500,{width,height}=resizeVisualCanvas(canvas);drawProgramVisual(ctx,{width,height,bands:stale?[]:state.bands||[],level:stale?0:state.level||0,time:now,visual:state.visual||{},accentA:state.brand?.accentA,accentB:state.brand?.accentB,background:surfacePalette?.bg,reducedMotion:reduced.matches});if(stale&&lastFrame)status('Le programme est en pause ou la fenêtre principale est fermée.');}requestAnimationFrame(draw);}
 if(mode!=='sound')requestAnimationFrame(draw);
 const disconnect=()=>{destroyed=true;channel?.close();};window.addEventListener('pagehide',disconnect,{once:true});
 window.dispatchEvent(new CustomEvent('sillage:surface-ready',{detail:{mode,root:$('#surface-sound-root'),receive}}));
 return {get state(){return state;},receive,destroy:disconnect};
}
if(typeof document!=='undefined')window.sillageSurface=startSurface();
