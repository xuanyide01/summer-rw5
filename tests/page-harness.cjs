const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const moduleSource=name=>fs.readFileSync(path.join(root,'src/common',name+'.js'),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'');
const names=['catalog','names','dialogue','auto-reader','title-progress','engine','saves','gallery','assets'];
const api=new Function(names.map(moduleSource).join('\n')+'\nreturn {catalog,visibleText,textFont,formatDialogue,autoSpeeds,autoWait,PROGRESS_KEY,FLOW_ENDINGS,HEROINE_ENDINGS,CLEAR_FLAGS,emptyProgress,decodeProgress,normalizeProgress,progressFromState,withProgress,titleActions,titleRows,heroineCount,newState,restore,checkpoint,readFrame,readChapterSkip,next,nextChapter,choose,previous,previewMap,SLOT_COUNT,LEGACY_KEY,slotKey,decodeSave,createSave,slotRow,imagePath,groupGallery,stepVariant};')();
const pageSource=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8').split('<script>')[1].split('</script>')[0].replace(/^import[^\n]*\n/gm,'').replace('export default','globalThis.page=');
function model(settings={},progress){
 let now=0,id=0;const timers=new Map(),saved=new Map([['summer_rw5_settings_v1',JSON.stringify({soundEnabled:false,...settings})]]),messages=[];
 if(progress!==undefined)saved.set(api.PROGRESS_KEY,typeof progress==='string'?progress:JSON.stringify(progress));
 class ClockDate extends Date{static now(){return now;}}
 const audio={plays:0,stops:0,play(){this.plays++;if(this.onloadeddata)this.onloadeddata();if(this.onplay)this.onplay();},stop(){this.stops++;if(this.onstop)this.onstop();}};
 const context=vm.createContext({...api,audio,Date:ClockDate,
  setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+Number(ms||0)});return key;},clearTimeout(key){timers.delete(key);},
  file:{readText(o){context.setTimeout(()=>o.success({text:fs.readFileSync(path.join(root,'src',o.uri),'utf8')}),2);}},
  storage:{get(o){o.success(saved.get(o.key)||'');},set(o){saved.set(o.key,o.value);if(o.success)o.success();}},
  prompt:{showToast(){}},console:{log:(...args)=>messages.push(args.join(' ')),error:(...args)=>messages.push(args.join(' '))}});
 vm.runInContext(moduleSource('title-music')+'\n'+pageSource,context);
 const p=context.page;Object.assign(p,JSON.parse(JSON.stringify(p.private)));p.$element=()=>({scrollTo(){}});p.$app={$def:{},exit(){p.onHide();}};p.onInit();
 function tick(ms){const end=now+ms;let count=0;while(true){const item=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!item)break;assert(++count<30000,'timer loop');now=item[1].at;timers.delete(item[0]);item[1].fn();}now=end;}
 function start(){p.textSpeed=0;p.startNew();tick(30);assert.equal(p.mode,'play');assert.equal(p.displayText,p.fullText);}
 function enable(){p.showMenu();p.toggleAuto();p.resume();assert.equal(p.autoEnabled,true);}
 return {p,tick,timers,saved,messages,audio,start,enable,position:()=>p.session.chapter+':'+p.session.cursor};
}
module.exports={api,model,moduleSource,pageSource,root};
