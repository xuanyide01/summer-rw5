// Run after native-name-upgrade.cjs leaves the app on a playing frame.
// Changes only the emulator's display settings and test slot 30. Keep a backup.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const catalogText=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8'),catalog=JSON.parse(catalogText.replace(/^export const catalog=/,'').trim().slice(0,-1));
const engine=import(uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(uri(catalogText)))));
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(300);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const part=logs().slice(n);if(re.test(part))return part;await sleep(150);}throw Error('Timeout '+re);}
async function shot(name){await sleep(900);const r=await fetch('http://127.0.0.1:43125/screen');assert.ok(r.ok);fs.writeFileSync(path.join(dest,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const begin=logs().length,manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8'));
 const report={version:manifest.versionName,result:'passed',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.summer.rw5.debug.'+manifest.versionName+'.rpk'))).digest('hex')};
 await expected(216,477,/SUMMER_RW5 menu/);await click(216,443);await shot('v015-title');
 await click(216,482);await click(348,474);await shot('v015-route-name');
 await click(216,126);await shot('v015-chapter-name');
 const chapterIndex=21,scene=catalog.routes[4].scenes[chapterIndex],e=await engine,state=e.newState(scene);let count=0,target;
 for(let i=0;i<2000;i++){
  const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story',state.chapter+'.json'),'utf8')),f=e.readFrame(ops,state);
  if(f.type==='jump'||f.type==='yield')continue;
  if(f.type!=='text')throw Error('Name sample encountered '+f.type);
  count++;if(f.speaker==='紬'&&/紬/.test(f.text)){target=[state.chapter,state.cursor];break;}e.next(state);
 }
 assert.ok(target,'Name-bearing dialogue sample must exist');
 for(let p=0;p<Math.floor(chapterIndex/4);p++)await click(348,474);
 await expected(216,126+(chapterIndex%4)*92,/SUMMER_RW5 frame/);
 // Existing native-test settings use instant text. Keep their speed setting.
 for(let i=1;i<count;i++){
  const part=await expected(366,477,/SUMMER_RW5 frame/);
  if(i===count-1)assert.match(part,new RegExp('SUMMER_RW5 frame '+target.join(' ')));
 }
 await shot('v015-name-dialogue');
 await expected(216,477,/SUMMER_RW5 menu/);await click(216,327);await click(216,385);await shot('v015-name-large-font');
 await expected(216,477,/SUMMER_RW5 menu/);await expected(216,95,/SUMMER_RW5 slots ready save/);
 for(let p=0;p<7;p++)await click(348,474);await expected(216,218,/SUMMER_RW5 overwrite 30/);await shot('v015-overwrite-name');
 await expected(216,210,/SUMMER_RW5 slot saved 30 /);await sleep(1700);
 await expected(216,477,/SUMMER_RW5 menu/);await expected(216,153,/SUMMER_RW5 slots ready load/);for(let p=0;p<7;p++)await click(348,474);await shot('v015-save-name');
 await expected(216,218,new RegExp('SUMMER_RW5 slot loaded 30 '+target.join(' ')));await shot('v015-reloaded-name');
 await expected(216,477,/SUMMER_RW5 menu/);await click(216,443);await expected(216,446,/SUMMER_RW5 gallery ready 155 856/);await expected(114,170,/SUMMER_RW5 cg 1 1 /);await expected(216,216,/SUMMER_RW5 cg 1 2 /);await shot('v015-cg');
 assert.ok(!/SUMMER_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(begin)));
 report.sample={position:target,visibleFrames:count};report.checked=['route name','chapter name','Chinese speaker and dialogue','large font','save preview','overwrite confirmation','reload','CG variant'];
 fs.writeFileSync(path.join(dest,'v015-name-report.json'),JSON.stringify(report,null,2));console.log('NAME_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
