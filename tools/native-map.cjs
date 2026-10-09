const fs=require('fs'),path=require('path'),assert=require('assert/strict'),root=path.resolve(__dirname,'..'),results=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log'),sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(300);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const s=logs().slice(n);if(re.test(s))return s;await sleep(200);}throw Error('Timeout '+re);}
async function shot(name){const r=await fetch('http://127.0.0.1:43125/screen');fs.writeFileSync(path.join(results,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const start=logs().length,info=await(await fetch('http://127.0.0.1:43125/info')).json();assert.equal(info.packageName,'com.codex.summer.rw5');let output='';
 for(let i=0;i<10;i++){await expected(216,477,/SUMMER_RW5 menu/);output=await expected(216,211,/SUMMER_RW5 (frame|map ready)/);if(output.includes('SUMMER_RW5 map ready'))break;}
 const map=/SUMMER_RW5 map ready (\d+) (\d+) ([\d,]+)/.exec(output);assert.ok(map,'Map must be reached from the normal story');const values=map[3].split(',').map(Number);assert.ok(values.length>=5);await shot('map-text-options');
 // Save the selection itself in the emulator's occupied slot 30.
 await expected(216,492,/SUMMER_RW5 menu/);await expected(216,95,/SUMMER_RW5 slots ready save/);for(let p=0;p<7;p++)await click(348,474);await expected(216,218,/SUMMER_RW5 overwrite 30/);await expected(216,210,new RegExp('SUMMER_RW5 slot saved 30 '+map[1]+' '+map[2]));await sleep(700);
 await expected(216,89,/SUMMER_RW5 frame/);await shot('map-choice-story');const selectedFrame=/SUMMER_RW5 frame (\d+) (\d+)/.exec(logs().slice(start).split('SUMMER_RW5 slot saved 30')[1]);assert.ok(selectedFrame);
 await expected(216,477,/SUMMER_RW5 menu/);await expected(216,153,/SUMMER_RW5 slots ready load/);for(let p=0;p<7;p++)await click(348,474);await expected(216,218,new RegExp('SUMMER_RW5 map ready '+map[1]+' '+map[2]+' '+map[3]));await shot('map-restored');
 // Scroll the list and keep the menu reachable before returning to its first item.
 await fetch('http://127.0.0.1:43125/drag?x0=250&y0=430&x1=250&y1=125');await sleep(300);await shot('map-options-scrolled');await expected(216,492,/SUMMER_RW5 menu/);await click(216,385);
 await fetch('http://127.0.0.1:43125/drag?x0=250&y0=125&x1=250&y1=430');await sleep(300);await expected(216,89,/SUMMER_RW5 frame/);
 assert.ok(!/SUMMER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(start)));const report={version:'0.1.2',physicalDeviceTested:false,normalStoryMap:[Number(map[1]),Number(map[2])],originalBranchValues:values,selectedFirstDestination:selectedFrame.slice(1).map(Number),selectionSaveLoad:true,scrollAndMenu:true,result:'passed'};fs.writeFileSync(path.join(results,'map-report.json'),JSON.stringify(report,null,2));console.log('NATIVE_MAP_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
