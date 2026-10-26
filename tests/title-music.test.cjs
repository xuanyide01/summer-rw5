const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {model,moduleSource}=require('./page-harness.cjs');
function player(){
 let now=0,id=0;const timers=new Map(),changes=[];
 const audio={plays:0,stops:0,play(){this.plays++;this.onloadeddata();this.onplay();},stop(){this.stops++;this.onstop();}};
 const context=vm.createContext({console:{log(){},error(){}},setTimeout(fn,ms){const k=++id;timers.set(k,{fn,at:now+ms});return k;},clearTimeout(k){timers.delete(k);}});
 vm.runInContext(moduleSource('title-music')+';globalThis.make=makeTitleMusic;globalThis.duration=TITLE_CONTENT_MS;globalThis.gap=TITLE_RESTART_GAP_MS;',context);
 const music=context.make(audio,x=>changes.push(x));
 function tick(ms){const end=now+ms;for(;;){const t=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!t)break;now=t[1].at;timers.delete(t[0]);t[1].fn();}now=end;}
 return {audio,music,timers,changes,tick,context,duration:context.duration,gap:context.gap};
}
test('1000 full guarded WAV replays keep one timer and release before each new stream',()=>{
 const m=player();m.music.update(true);assert.equal(m.audio.loop,false);
 for(let i=0;i<1000;i++){assert.equal(m.audio.plays,i+1);assert.equal(m.timers.size,1);m.tick(m.duration);assert.equal(m.audio.stops,i+1);assert.equal(m.audio.plays,i+1);m.tick(m.gap);assert.equal(m.audio.plays,i+2);}
 m.music.destroy();assert.equal(m.timers.size,0);assert.equal(m.audio.onplay,null);
});
test('cancelled player callbacks cannot restart a replacement stream or bypass disabled playback',()=>{
 const m=player();m.music.update(true);const stale=[...m.timers.values()][0].fn;m.music.stop();stale();m.tick(m.duration+m.gap);assert.equal(m.audio.plays,1);m.music.update(true);stale();assert.equal(m.audio.plays,2);assert.equal(m.timers.size,1);
 m.audio.onended();assert.equal(m.changes.at(-1),false);assert.equal(m.timers.size,0);m.music.update(true);assert.equal(m.audio.plays,2);
 m.music.retry();m.music.update(true);assert.equal(m.audio.plays,3);m.music.destroy();
});
test('synchronous decoder failure remains failed and does not leave a replay timer',()=>{
 const m=player();m.audio.play=function(){this.plays++;this.onerror('unsupported PCM',1);};m.music.update(true);assert.equal(m.changes.at(-1),false);assert.equal(m.timers.size,0);assert.equal(m.audio.stops,1);m.music.destroy();
});
test('actual page cancels delayed music on navigation, background and destroy',()=>{
 const m=model({soundEnabled:true});m.tick(1799);assert.equal(m.audio.plays,0);m.p.startNew();m.tick(2000);assert.equal(m.audio.plays,0);m.p.toTitle();m.tick(1800);assert.equal(m.audio.plays,1);m.p.onHide();assert.equal(m.audio.stops,1);m.tick(500000);assert.equal(m.audio.plays,1);m.p.onShow();m.tick(1800);assert.equal(m.audio.plays,2);m.p.onDestroy();m.tick(500000);assert.equal(m.audio.plays,2);assert.equal(m.timers.size,0);
});

test('source setter failure releases the partially acquired stream',()=>{
 const m=player();Object.defineProperty(m.audio,'src',{set(){throw Error('src failed after acquisition');}});
 m.music.update(true);assert.equal(m.audio.stops,1);assert.equal(m.audio.plays,0);assert.equal(m.timers.size,0);assert.equal(m.changes.at(-1),false);m.music.destroy();
});
test('onplay without loaded audio times out and never restarts over another application',()=>{
 const m=player();m.audio.play=function(){this.plays++;this.onplay();};m.music.update(true);assert.equal(m.timers.size,2);
 m.tick(10000);assert.equal(m.audio.stops,1);assert.equal(m.timers.size,0);assert.equal(m.changes.at(-1),false);m.tick(500000);assert.equal(m.audio.plays,1);
});
test('native stop or focus pause cancels the pending title replay',()=>{
 for(const event of ['onstop','onpause']){const m=player();m.music.update(true);m.audio[event]();assert.equal(m.timers.size,0);m.tick(500000);assert.equal(m.audio.plays,1);m.music.destroy();}
});
test('idle stop/destroy do not stop another application or change volume',()=>{
 const m=player();for(const key of ['volume','muted','currentTime','duration'])Object.defineProperty(m.audio,key,{get(){throw Error('native getter');},set(){throw Error('system property write');}});
 m.music.stop();assert.equal(m.audio.stops,0);m.music.update(true);m.music.stop();assert.equal(m.audio.stops,1);m.music.stop();m.music.destroy();assert.equal(m.audio.stops,1);
});
test('application destroy also stops the currently owned title stream',()=>{
 const fs=require('node:fs'),path=require('node:path');const m=model({soundEnabled:true});m.tick(1800);const src=fs.readFileSync(path.join(__dirname,'../src/app.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace('export default','globalThis.app=');const ctx=vm.createContext({console:{log(){}}});vm.runInContext(src,ctx);ctx.app.onDestroy.call(m.p.$app.$def);assert.equal(m.audio.stops,1);m.tick(500000);assert.equal(m.audio.plays,1);
});

test('title, LOAD, gallery, CG variants and return share the same uninterrupted stream',()=>{
 const m=model({soundEnabled:true});m.tick(1800);assert.equal(m.audio.plays,1);
 m.p.titleAction('load');assert.equal(m.p.mode,'slots');m.p.nextSlotPage();m.p.previousSlotPage();m.p.closeSlots();
 m.p.titleAction('gallery');m.tick(2);assert.equal(m.p.mode,'gallery');m.p.nextGalleryPage();m.p.previousGalleryPage();m.p.viewCg(0);m.p.cycleCg();m.p.nextCg();m.p.previousCg();m.p.backToGallery();m.p.toTitle();
 assert.equal(m.audio.plays,1);assert.equal(m.audio.stops,0);
 m.p.openGallery();m.p.viewCg(0);m.tick(237000);assert.equal(m.audio.stops,1);m.tick(1200);assert.equal(m.audio.plays,2);assert.equal(m.p.mode,'cg');m.p.onDestroy();
});
test('opening LOAD or CG before the initial delay does not cancel or restart that delay',()=>{
 for(const target of ['load','cg']){
  const m=model({soundEnabled:true});m.tick(500);
  if(target==='load')m.p.continueGame();else{m.p.openGallery();m.tick(2);m.p.viewCg(0);}
  m.tick(target==='load'?1299:1297);assert.equal(m.audio.plays,0);m.tick(1);assert.equal(m.audio.plays,1);assert.equal(m.audio.stops,0);m.p.onDestroy();
 }
});
test('in-game LOAD plays menu music, but cancel, SAVE and loading a game release it',()=>{
 const {api}=require('./page-harness.cjs'),m=model({soundEnabled:true});m.start();m.p.showMenu();
 m.p.loadGame();m.tick(1800);assert.equal(m.audio.plays,1);m.p.closeSlots();assert.equal(m.p.mode,'menu');assert.equal(m.audio.stops,1);
 m.p.saveGame();m.tick(2000);assert.equal(m.audio.plays,1);m.p.closeSlots();
 m.saved.set(api.slotKey(0),JSON.stringify(api.createSave(m.p.session,'play',Date.now())));
 m.p.loadGame();m.tick(1800);assert.equal(m.audio.plays,2);m.p.selectSlot(0);assert.equal(m.audio.stops,2);m.tick(500000);assert.equal(m.audio.plays,2);assert.equal(m.p.mode,'play');m.p.onDestroy();
});
test('background, disabled sound and errors remain silent in LOAD and CG screens',()=>{
 for(const screen of ['load','gallery','cg']){
  const m=model({soundEnabled:true});m.tick(1800);
  if(screen==='load')m.p.continueGame();else{m.p.openGallery();m.tick(2);if(screen==='cg')m.p.viewCg(0);}
  m.p.onHide();m.tick(500000);assert.equal(m.audio.plays,1);assert.equal(m.audio.stops,1);
  m.p.onShow();m.tick(1800);assert.equal(m.audio.plays,2);m.p.fail('test failure');m.tick(500000);assert.equal(m.audio.plays,2);assert.equal(m.audio.stops,2);m.p.onDestroy();
  const muted=model();muted.p.continueGame();muted.tick(2000);muted.p.closeSlots();muted.p.openGallery();muted.tick(2);muted.p.viewCg(0);muted.tick(500000);assert.equal(muted.audio.plays,0);muted.p.onDestroy();
 }
});
