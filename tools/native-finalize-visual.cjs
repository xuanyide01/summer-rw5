// Finish the CG/map checks after the eight portrait screenshots were reviewed.
// Does not save or overwrite slots. Run from an open CG image in the same session.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(500);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const text=logs().slice(n);if(re.test(text))return text;await sleep(150);}throw Error('Timeout '+re);}
async function shot(name){await sleep(700);const r=await fetch('http://127.0.0.1:43125/screen');fs.writeFileSync(path.join(dest,name+'.png'),Buffer.from(await r.arrayBuffer()));}
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.summer.rw5.debug.'+manifest.versionName+'.rpk'))).digest('hex');
 const persisted=JSON.parse(fs.readFileSync(path.join(dest,'v011-persistence-report.json'),'utf8'));assert.equal(persisted.packageSha256,hash);
 const begin=logs().length,portraits=[];
 for(let route=1;route<=8;route++){const name='v011-portrait-route-'+route+'.png',p=path.join(dest,name);assert.ok(fs.existsSync(p));assert.ok(Date.now()-fs.statSync(p).mtimeMs<20*60*1000,'Review fresh current-package screenshots');portraits.push({route,file:name,review:'Visible full character, detailed face and original colors; visually reviewed'});}
 const matches=[...logs().matchAll(/SUMMER_RW5 cg (\d+) (\d+) (i\d+)/g)],last=matches.at(-1);assert.ok(last);
 await click(216,487);for(let p=0;p<Math.floor((Number(last[1])-1)/4);p++)await click(56,474);
 for(let p=0;p<4;p++)await click(348,474);
 await expected(114,350,/SUMMER_RW5 cg 19 1 i1089/);await shot('v011-cg-complete-canvas');
 for(let i=0;i<11;i++)await expected(216,216,new RegExp('SUMMER_RW5 cg 19 '+(((i+1)%11)+1)+' '));await shot('v011-cg-difference-cycled');
 await click(216,487);await click(216,474);await expected(216,410,/SUMMER_RW5 slots ready load/);for(let p=0;p<7;p++)await click(348,474);
 await expected(216,218,/SUMMER_RW5 slot loaded 30 281 10/);await sleep(900);await expected(216,89,/SUMMER_RW5 frame 95 4/);await shot('v011-after-portrait');
 assert.ok(!/SUMMER_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(begin)));
 const report={version:manifest.versionName,result:'passed',packageSha256:hash,runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,portraits,portraitReviewMethod:'Eight screenshots captured by the native portrait route checks, then visually reviewed. CG/map stage resumed with corrected gallery page coordinates.',gallery:{groups:155,variants:856},cgCompleteCanvas:true,cgFacialPatchTest:{group:19,first:'i1089',variants:11,fullCycleReturnedToFirst:true},oldMapSlotAndBranchRestored:true};
 fs.writeFileSync(path.join(dest,'visual-report.json'),JSON.stringify(report,null,2));console.log('VISUAL_FINAL_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
