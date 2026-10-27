const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {api,model,root}=require('./page-harness.cjs');
const report=JSON.parse(fs.readFileSync(path.join(root,'reports/content-v030.json'),'utf8'));
test('upper artwork tap completes typing then advances once; dragging and loading never consume a line',()=>{
 const m=model(),p=m.p;m.start();p.textSpeed=30;p.advance();m.tick(5);const current=m.position();assert.notEqual(p.displayText,p.fullText);p.dialogueTap();assert.equal(m.position(),current);assert.equal(p.displayText,p.fullText);p.dialogueTap();m.tick(5);assert.notEqual(m.position(),current);
 const after=m.position();p.dialogueTouchStart({touches:[{clientX:200,clientY:100}]});p.dialogueTouchMove({touches:[{clientX:210,clientY:170}]});p.dialogueTouchEnd();p.dialogueTap();assert.equal(m.position(),after);p.loading=true;m.tick(500);p.dialogueTap();assert.equal(m.position(),after);p.onDestroy();
 const ux=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8');assert.match(ux,/<div class="art-tap"[^>]*onclick="dialogueTap"/);assert.match(ux,/\.dialogue-panel\{background-color:#102c42;border-width:0px;/);
});
test('common character events show only their real date; individual routes show only the character',()=>{
 const s=api.newState(348,true);s.stack=[[6,70],[281,40]];s.strings['106']='０月０日';assert.match(api.sceneLabel(s),/^\d{1,2}月\d{1,2}日$/);assert.ok(!api.sceneLabel(s).includes('神山'));
 s.strings['106']='７月２９日';assert.equal(api.sceneLabel(s),'7月29日');
 const personal=api.newState(60,true);personal.stack=[[6,291]];assert.equal(api.sceneLabel(personal),'鸣濑白羽');personal.chapter=318;assert.equal(api.sceneLabel(personal),'鸣濑白羽');
 const standalone=api.newState(360);assert.equal(api.sceneLabel(standalone),'神山识');
 const row=api.slotRow(0,{version:1,state:s,sceneMode:'play',savedAt:0});assert.equal(row.meta,'7月29日');
});
test('removed personal routes have no reachable story target, while other-character common events and both finals remain',()=>{
 const removed=new Set(report.removedPersonalScenes);assert.equal(removed.size,67);
 assert.ok(api.catalog.routes.some(x=>x.name==='ALKA'));assert.ok(api.catalog.routes.some(x=>x.name==='Pocket'));
 for(const name of ['野村美希','水织静久','加藤羽未'])assert.ok(!api.catalog.routes.some(x=>x.name===name));
 for(const id of report.keptOtherCharactersCommonScenes)assert.ok(!api.catalog.scenes[String(id)].removed);
 for(const p of fs.readdirSync(path.join(root,'converted-story'))){const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story',p),'utf8'));for(const op of ops)if(op.op==='callScene'||op.op==='jumpScene')assert.ok(!removed.has(op.scene));}
 const saved=api.checkpoint(api.newState());saved.chapter=325;saved.rootChapter=325;assert.throws(()=>api.restore(saved),/已移除/);
 assert.equal(api.restore(api.checkpoint(api.newState(318))).chapter,318);
});
test('40 actual expressions use complete RGBA portraits with original crop and fixed decode ceiling',()=>{
 const e=JSON.parse(fs.readFileSync(path.join(root,'reports/expressions-v030.json'),'utf8'));assert.equal(e.addedExpressions,40);assert.deepEqual(e.heroineCounts,{SR:8,AO:8,TM:8,KM:8,SK:8});
 for(const x of e.records){const raw=fs.readFileSync(path.join(root,'src/common/images',x.file)),base=fs.readFileSync(path.join(root,'src/common/images',x.baseFile));assert.equal(raw[24],8);assert.equal(raw[25],6);assert.equal(raw.readUInt32BE(16),base.readUInt32BE(16));assert.equal(raw.readUInt32BE(20),base.readUInt32BE(20));assert.ok(x.size[0]*x.size[1]*4<=204800);assert.ok(x.changedPixels>=5);assert.notEqual(crypto.createHash('sha256').update(raw).digest('hex'),crypto.createHash('sha256').update(base).digest('hex'));for(const id of x.mappedIds)assert.equal(api.imagePath('i'+id),'/common/images/'+x.file);}
});
