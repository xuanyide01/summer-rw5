const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {api,model,root}=require('./page-harness.cjs');
test('native ending positions preserve the original scenario operation count and all 30 save slots',()=>{
 const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story',api.catalog.flowScene+'.json'),'utf8'));
 assert.equal(ops.length,638);for(const cursor of Object.keys(api.FLOW_ENDINGS))assert.equal(ops[cursor].op,'end');assert.equal(api.SLOT_COUNT,30);
});
test('fourth and fifth included heroine clears require ReSTART; five unlock ALKA, ALKA unlocks Pocket',()=>{
 let p=api.emptyProgress(),s=api.newState();
 for(const ending of [4,5,6])p=api.progressFromState(p,s,ending);assert.deepEqual(api.titleActions(p),['start']);
 p=api.progressFromState(p,s,7);assert.deepEqual(api.titleActions(p),['restart']);assert.ok(!api.titleRows(p).some(x=>x.action==='load'));
 s.variables['14003']=2;p=api.progressFromState(p,s);assert.deepEqual(api.titleActions(p),['start']);
 p=api.progressFromState(p,s,10);p=api.progressFromState(p,s,12);assert.deepEqual(api.titleActions(p),['start']);p=api.progressFromState(p,s,13);assert.deepEqual(api.titleActions(p),['restart']);
 s.variables['14003']=4;p=api.progressFromState(p,s);p=api.progressFromState(p,s,13);assert.deepEqual(api.titleActions(p),['alka']);
 p=api.progressFromState(p,s,8);assert.deepEqual(api.titleActions(p),['pocket']);p=api.progressFromState(p,s,9);assert.deepEqual(api.titleActions(p),['start','alka','pocket']);
 const state=api.withProgress(api.newState(),p);assert.equal(state.variables['24006'],7);assert.equal(state.variables['12007'],1);assert.equal(state.variables['12008'],1);
});
test('bad endings and Umi do not count as the five included heroines; duplicates cannot trigger extra restarts',()=>{
 let p=api.emptyProgress();for(const id of [1,2,3,11,14,4,4,4])p=api.progressFromState(p,api.newState(),id);assert.equal(api.heroineCount(p),1);assert.deepEqual(api.titleActions(p),['start']);
});
test('older saves cannot roll back persisted clear flags or restart stages',()=>{
 const p={version:1,cleared:[4,5,6,7,10,12],restartStage:4,globals:{'12001':1}};
 const s=api.withProgress(api.newState(),p);assert.equal(s.variables['14003'],4);assert.equal(s.variables['24006'],4);assert.equal(s.variables['12574'],1);const merged=api.progressFromState(p,api.newState());assert.equal(merged.restartStage,4);assert.equal(api.heroineCount(merged),4);
});
test('page enables only the matching original title action; ALKA and Pocket enter the original flow',()=>{
 const m=model(),p=m.p;p.titleAction('alka');assert.equal(p.mode,'title');
 p._progress={version:1,cleared:[4,5,6,7,10,12,13],restartStage:4,globals:{}};p.refreshTitle();p.titleAction('alka');m.tick(30);assert.equal(p.session.variables['6004'],1);assert.ok(p.session.chapter!==7);p.toTitle();p._progress=api.progressFromState(p._progress,p.session,8);p.refreshTitle();p.titleAction('pocket');m.tick(30);assert.equal(p.session.variables['6004'],2);
});
test('invalid global records are not silently overwritten and auto starts disabled',()=>{
 const m=model({},'{broken');assert.equal(m.p.mode,'error');assert.equal(m.saved.get(api.PROGRESS_KEY),'{broken');assert.equal(m.p.autoEnabled,false);
});


test('fourth and fifth ending branches see the newly set native clear counter immediately',()=>{
 const ops=JSON.parse(fs.readFileSync(path.join(root,'converted-story/6.json'),'utf8'));
 let p={version:1,cleared:[5,6,7],restartStage:0,globals:{}},s=api.withProgress(api.newState(6,true),p);s.cursor=313;
 api.readFrame(ops,s);assert.equal(s.variables['12003'],1);assert.equal(s.variables['14003'],1);
 p={version:1,cleared:[4,5,6,7],restartStage:2,globals:{}};s=api.withProgress(api.newState(6,true),p);s.cursor=540;api.readFrame(ops,s);assert.equal(s.variables['12575'],1);assert.equal(s.variables['14003'],3);
 p.cleared.push(14);s=api.withProgress(api.newState(6,true),p);s.cursor=540;api.readFrame(ops,s);assert.equal(s.variables['12576'],1);assert.equal(s.variables['14003'],3);
});
