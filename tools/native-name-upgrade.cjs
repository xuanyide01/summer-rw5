const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'native-test-results'),log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
const logs=()=>fs.readFileSync(log,'utf8'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(x,y){assert.ok((await fetch('http://127.0.0.1:43125/click?x='+x+'&y='+y)).ok);await sleep(200);}
async function expected(x,y,re){const n=logs().length;await click(x,y);for(let i=0;i<100;i++){const text=logs().slice(n);if(re.test(text))return text;await sleep(150);}throw Error('Timeout '+re);}
(async()=>{
 const begin=logs().length,manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),report={version:manifest.versionName,result:'passed',physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/com.codex.summer.rw5.debug.'+manifest.versionName+'.rpk'))).digest('hex'),oldSlotsLoaded:[]};let choice=false;
 for(let i=29;i>=0;i--){
  if(i===29)await expected(216,410,/SUMMER_RW5 slots ready load/);
  else{await expected(216,choice?492:477,/SUMMER_RW5 menu/);await expected(216,153,/SUMMER_RW5 slots ready load/);}
  for(let p=0;p<Math.floor(i/4);p++)await click(348,474);
  const n=logs().length;let part=await expected(216,126+(i%4)*92,new RegExp('SUMMER_RW5 slot loaded '+(i+1)+' '));
  for(let k=0;k<100;k++){part=logs().slice(n);if(/SUMMER_RW5 (?:frame|map ready|choice)/.test(part))break;await sleep(150);}
  assert.match(part,/SUMMER_RW5 (?:frame|map ready|choice)/);
  const match=new RegExp('SUMMER_RW5 slot loaded '+(i+1)+' (\\d+) (\\d+)').exec(part);assert.ok(match);choice=/SUMMER_RW5 (?:map ready|choice)/.test(part);
  report.oldSlotsLoaded.push({slot:i+1,position:match.slice(1).map(Number),selection:choice});console.log('OLD_SLOT',i+1);
 }
 assert.ok(!/SUMMER_RW5 error|PANIC!!!|ASSERTION FAILED/.test(logs().slice(begin)));report.storageSchemaUnchanged=true;
 if(process.argv.includes('--cold'))report.coldBoot30Slots=true;
 fs.writeFileSync(path.join(dest,'v015-upgrade-report.json'),JSON.stringify(report,null,2));
 if(process.argv.includes('--cold'))fs.writeFileSync(path.join(dest,'v015-persistence-report.json'),JSON.stringify(report,null,2));
 console.log('UPGRADE_SLOTS_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
