const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {api:a,root}=require('./page-harness.cjs');
test('five included clears can finish ALKA and Pocket without granting removed personal endings',()=>{
 const full={};for(const f of fs.readdirSync(path.join(root,'converted-story')))full[+f.slice(0,-5)]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',f),'utf8'));
 for(const mode of [1,2]){
  const progress={version:1,cleared:mode===1?[4,5,6,7,13]:[4,5,6,7,13,8],restartStage:4,globals:{}};
  const s=a.withProgress(a.newState(6,true),progress);s.variables['6004']=mode;let ended=false;
  for(let n=0;n<50000;n++){
   const f=a.readFrame(full[s.chapter],s);assert.ok(!a.catalog.scenes[String(s.chapter)].removed);
   if(f.type==='jump'||f.type==='yield')continue;
   if(f.type==='end'){assert.equal(a.FLOW_ENDINGS[s.cursor],mode===1?8:9);ended=true;break;}
   if(f.type==='text'){s.cursor++;continue;}
   const choices=f.type==='map'?a.previewMap(full[a.catalog.mapScene],s,f):f.items;assert.ok(choices.length);a.choose(s,choices[0],0);
  }
  assert.ok(ended);assert.equal(s.variables['12573'],undefined);assert.equal(s.variables['12574'],undefined);
 }
});
