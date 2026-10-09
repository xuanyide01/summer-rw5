const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const names=import(uri(fs.readFileSync(path.join(root,'src/common/names.js'),'utf8')));
test('Chinese character name, original short form and old Latin text display without duplicate surname',async()=>{
 const n=await names;
 for(const text of ['紬','䌷','Tsumugi','紬·文德斯','紬・文德斯','紬文德斯'])assert.equal(n.visibleText(text,true),'紬文德斯');
 assert.equal(n.visibleText('“我叫紬。紬·文德斯。”'),'“我叫紬。紬文德斯。”');
 assert.equal(n.visibleText('紬·静久',true),'紬文德斯·静久');
 assert.equal(n.textFont('紬文德斯'),'summername');assert.equal(n.textFont('羽依里'),'sans-serif');
});
test('bundled font covers every name-bearing story line and original speaker, without changing raw story or save schema',async()=>{
 const n=await names,report=JSON.parse(fs.readFileSync(path.join(root,'name-font-report.json'),'utf8')),covered=new Set(report.codepoints);let fields=0;
 function visit(x){
  if(typeof x==='string'&&/[紬䌷]|Tsumugi/.test(x)){
   const text=n.visibleText(x,true);for(const c of text)if(!/\s/.test(c))assert.ok(covered.has(c.codePointAt(0)),'Font misses '+c+' in '+text);
   fields++;
  }else if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')Object.values(x).forEach(visit);
 }
 for(const file of fs.readdirSync(path.join(root,'converted-story')))if(file.endsWith('.json'))visit(JSON.parse(fs.readFileSync(path.join(root,'converted-story',file),'utf8')));
 assert.equal(fields,4637);
 assert.equal(fs.statSync(path.join(root,'src/common/summer-name.otf')).size,report.fontBytes);
 assert.ok(report.fontBytes<750000);
 const ux=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8');assert.match(ux,/@font-face.*summer-name\.otf/);assert.ok(!ux.includes("'Tsumugi'"));
 const saves=fs.readFileSync(path.join(root,'src/common/saves.js'),'utf8');assert.match(saves,/summer_rw5_slot_v1_/);assert.match(saves,/saved.version!==1/);
});
