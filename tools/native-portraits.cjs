const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
const catalogText=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8');
const catalog=JSON.parse(catalogText.replace(/^export const catalog=/,'').trim().slice(0,-1));
const uri=t=>'data:text/javascript;base64,'+Buffer.from(t).toString('base64');
const engine=import(uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(uri(catalogText)))));
const paths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(500);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const part=logs().slice(n);if(re.test(part))return part;await sleep(150);}throw Error('Timeout '+re);}
async function shot(name){await sleep(700);const r=await fetch('http://127.0.0.1:43125/screen');fs.writeFileSync(path.join(dest,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function title(){await expected(216,477,/SUMMER_RW5 menu/);await click(216,443);await sleep(300);}
async function firstPortrait(scene){const e=await engine,s=e.newState(scene);let texts=0;for(let i=0;i<1000;i++){const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story',s.chapter+'.json'),'utf8'));const f=e.readFrame(ops,s);if(f.type==='jump'||f.type==='yield')continue;if(f.type==='text'){texts++;if(s.body)return {chapter:s.chapter,cursor:s.cursor,body:s.body,texts};e.next(s);continue;}return null;}throw Error('Portrait probe exceeded budget');}
(async()=>{
 const begin=logs().length,manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),report={version:manifest.versionName,result:'passed',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.summer.rw5.debug.'+manifest.versionName+'.rpk'))).digest('hex'),portraits:[]};
 // Enter with a playing frame. Sampling does not save/overwrite any slot.
 for(const route of [1,2,3,4,5,6,7,8]){
  const chapters=catalog.chapters.filter(x=>x.route===route);let target=null,chapterIndex=0;
  for(;chapterIndex<chapters.length;chapterIndex++){target=await firstPortrait(chapters[chapterIndex].id);if(target)break;}
  assert.ok(target,'Route must have a portrait: '+catalog.routes[route].name);
  await title();await click(216,482);for(let page=0;page<Math.floor(route/4);page++)await click(348,474);
  if(route===4)await shot('v013-route-name-font');
  await click(216,126+(route%4)*92);for(let page=0;page<Math.floor(chapterIndex/4);page++)await click(348,474);
  let part=await expected(216,126+(chapterIndex%4)*92,/SUMMER_RW5 frame/),m=/SUMMER_RW5 frame (\d+) (\d+)/.exec(part);
  for(let n=1;n<target.texts;n++){part=await expected(366,477,/SUMMER_RW5 frame/);m=/SUMMER_RW5 frame (\d+) (\d+)/.exec(part);}
  assert.deepEqual(m.slice(1).map(Number),[target.chapter,target.cursor]);assert.ok(paths[target.body].startsWith('portrait_'));
  const file='v013-portrait-route-'+route;await shot(file);report.portraits.push({route:catalog.routes[route].name,...target,file:file+'.png',resource:paths[target.body]});console.log('PORTRAIT_NATIVE',route,paths[target.body]);
 }
 // The SR02 entry was formerly rendered as a small facial patch.
 await title();const cached=/SUMMER_RW5 gallery ready 155 856/.test(logs().slice(logs().lastIndexOf('SUMMER_RW5 title ready')));
 if(cached){await click(216,446);for(let p=0;p<38;p++)await click(56,474);}else await expected(216,446,/SUMMER_RW5 gallery ready 155 856/);
 report.gallery={groups:155,variants:856};for(let p=0;p<4;p++)await click(348,474);await expected(114,350,/SUMMER_RW5 cg 19 1 i1089/);await shot('v013-cg-complete-canvas');
 for(let i=0;i<11;i++)await expected(216,216,new RegExp('SUMMER_RW5 cg 19 '+(((i+1)%11)+1)+' '));await shot('v013-cg-difference-cycled');report.cgCompleteCanvas=true;report.cgDifferenceCycle=true;await click(216,487);await click(216,474);await sleep(250);
 // Keep the user's existing virtual saves untouched. Slot 30 contains the map
 // checkpoint used by the original native test and the before/after screenshot.
 await expected(216,410,/SUMMER_RW5 slots ready load/);for(let page=0;page<7;page++)await click(348,474);
 await expected(216,218,/SUMMER_RW5 slot loaded 30 281 10/);await sleep(900);
 await expected(216,89,/SUMMER_RW5 frame 95 4/);await shot('v013-after-portrait');report.oldMapSlotAndBranchRestored=true;
 assert.ok(!/SUMMER_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(begin)));fs.writeFileSync(path.join(dest,'v013-visual-report.json'),JSON.stringify(report,null,2));console.log('NATIVE_PORTRAITS_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
