const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');fs.mkdirSync(results,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){const r=await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y);assert.ok(r.ok);await sleep(250);}
async function waitLog(start,re){for(let i=0;i<100;i++){const part=logs().slice(start);if(re.test(part))return part;await sleep(200);}throw new Error('Timeout '+re);}
async function expected(x,y,re){const b=logs().length;await click(x,y);return waitLog(b,re);}
async function shot(name){const r=await fetch('http://127.0.0.1:43125/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function menu(){await expected(216,477,/SUMMER_RW5 menu/);}
async function slots(role){await expected(216,role==='save'?95:155,new RegExp('SUMMER_RW5 slots ready '+role));}
async function chooseSlot(i,re){for(let p=0;p<Math.floor(i/4);p++)await click(348,474);return expected(216,126+(i%4)*92,re);}
(async()=>{
 const start=logs().length,report={version:'0.1.2',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.summer.rw5.debug.0.1.2.rpk'))).digest('hex')};
 if(process.argv.includes('--persist')){
  const prev=JSON.parse(fs.readFileSync(path.join(results,'slots-report.json'),'utf8'));
  await expected(216,410,/SUMMER_RW5 slots ready load/);
  for(let i=29;i>=0;i--){
   if(i!==29){await menu();await slots('load');}
   await chooseSlot(i,new RegExp('SUMMER_RW5 slot loaded '+(i+1)+' '+prev.positions[i].join(' ')));
   if(i===29)await shot('cold-load-slot-30');
  }
  report.coldBoot30Slots=true;fs.writeFileSync(path.join(results,'persistence-report.json'),JSON.stringify(report,null,2));console.log('PERSIST_PASSED');return;
 }
 await shot('title');
 const galleryLog=await expected(216,446,/SUMMER_RW5 gallery ready/);const match=/SUMMER_RW5 gallery ready (\d+) (\d+)/.exec(galleryLog);assert.equal(Number(match[1]),155);assert.equal(Number(match[2]),856);report.gallery={groups:Number(match[1]),variants:856};await shot('gallery');
 await expected(114,170,/SUMMER_RW5 cg 1 1 /);await shot('cg-variant-01');await expected(216,216,/SUMMER_RW5 cg 1 2 /);await shot('cg-variant-02');await click(216,487);await click(216,474);
 await expected(216,375,/SUMMER_RW5 frame/);await shot('opening');await menu();await click(216,269);await click(216,385);
 const positions=[];
 for(let i=0;i<30;i++){
  if(i){const text=await expected(366,477,/SUMMER_RW5 (frame|choice)/);if(/SUMMER_RW5 choice/.test(text))await expected(216,89,/SUMMER_RW5 frame/);}
  await menu();await slots('save');let saved=await chooseSlot(i,new RegExp('SUMMER_RW5 (?:slot saved|overwrite) '+(i+1)+'(?:\\s|$)'));if(saved.includes('SUMMER_RW5 overwrite'))saved=await expected(216,210,new RegExp('SUMMER_RW5 slot saved '+(i+1)+' '));const m=new RegExp('SUMMER_RW5 slot saved '+(i+1)+' (\\d+) (\\d+)').exec(saved);positions.push([Number(m[1]),Number(m[2])]);await sleep(1600);
  if(i===29){await menu();await slots('load');for(let p=0;p<7;p++)await click(348,474);await shot('slots-29-30');await click(216,474);await click(216,385);}
 }
 assert.equal(new Set(positions.map(x=>x.join(':'))).size,30);
 for(let i=29;i>=0;i--){await menu();await slots('load');await chooseSlot(i,new RegExp('SUMMER_RW5 slot loaded '+(i+1)+' '+positions[i].join(' ')));}
 await menu();await expected(216,211,/SUMMER_RW5 (frame|map ready)/);await shot('chapter-skip');
 const data=logs().slice(start);assert.ok(!/SUMMER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(data));report.slots=30;report.positions=positions;report.result='passed';fs.writeFileSync(path.join(results,'slots-report.json'),JSON.stringify(report,null,2));console.log('SUMMER_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
