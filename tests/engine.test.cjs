const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),uri=t=>'data:text/javascript;base64,'+Buffer.from(t).toString('base64');
const catalogSource=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8'),catalog=JSON.parse(catalogSource.replace(/^export const catalog=/,'').trim().slice(0,-1));
const catalogUri=uri(catalogSource),engineUri=uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(catalogUri)));
const engine=import(engineUri),gallery=import(uri(fs.readFileSync(path.join(root,'src/common/gallery.js'),'utf8')));
const namesUri=uri(fs.readFileSync(path.join(root,'src/common/names.js'),'utf8'));
const saves=import(uri(fs.readFileSync(path.join(root,'src/common/saves.js'),'utf8').replace("'./catalog.js'",JSON.stringify(catalogUri)).replace("'./engine.js'",JSON.stringify(engineUri)).replace("'./names.js'",JSON.stringify(namesUri))));
const stories={};for(let i=1;i<=catalog.count;i++)stories[i]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',i+'.json'),'utf8'));
const paths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);
test('every control-flow destination and actual BG/portrait/CG reference exists',()=>{
 let text=0,choices=0;
 for(const [scene,ops]of Object.entries(stories))for(const op of ops){
  if(op.op==='text')text++;if(op.op==='choice')choices++;
  if(op.target!==undefined){const dst=stories[op.scene||scene];assert.ok(dst);assert.ok(op.target>=0&&op.target<=dst.length);}
  if(op.op==='image'){const id=Number(op.image.slice(1));if(id<=522||(id>=1001&&id<=1856)||(id>=10001&&id<=16045))assert.ok(paths[op.image]&&fs.existsSync(path.join(root,'src/common/images',paths[op.image])),op.image);}
 }
 assert.equal(text,96936);assert.equal(choices,191);assert.equal(catalog.chapters.length,315);
});
test('safe expression evaluation, selection flags, cross-scene calls and back',async()=>{
 const e=await engine,s=e.newState();s.variables['6046']=1;assert.equal(e.evaluate(['&&',['==',['v',6046],1],['!',0]],s),1);
 const ops=[{op:'set',variable:6001,value:0},{op:'choice',variable:6001,items:[{text:'a',condition:1,value:0},{text:'b',condition:['v',6046],value:1}]},{op:'if',value:['==',['v',6001],1],truth:false,target:5},{op:'callScene',scene:8,target:0},{op:'text',speaker:'',text:'after'},{op:'end'}];
 assert.equal(e.readFrame(ops,s).items.length,2);const before=e.checkpoint(s);e.choose(s,{variable:6001,value:1},1);assert.equal(e.readFrame(ops,s).type,'jump');assert.equal(s.chapter,8);assert.equal(s.stack.length,1);
 const f=e.readFrame([{op:'return'}],s);assert.deepEqual(f.to,[catalog.initial,4]);assert.equal(e.readFrame(ops,s).text,'after');assert.ok(e.previous(s));assert.deepEqual(e.checkpoint(s),before);
 for(let i=0;i<20;i++)e.next(s);assert.equal(s.history.length,12);
});
test('all 30 saves retain different chapters, variables, choices and call stacks',async()=>{
 const e=await engine,save=await saves,store=new Map();
 for(let i=0;i<30;i++){const s=e.newState(catalog.chapters[i*5].id);s.variables['6001']=i;s.stack=[[catalog.initial,i]];s.choices=[i];store.set(save.slotKey(i),JSON.stringify(save.createSave(s,'play',1000+i)));}
 assert.equal(store.size,30);
 for(let i=0;i<30;i++){const s=save.decodeSave(store.get(save.slotKey(i))).state;assert.equal(s.chapter,catalog.chapters[i*5].id);assert.equal(s.variables['6001'],i);assert.deepEqual(s.stack,[[catalog.initial,i]]);assert.deepEqual(s.choices,[i]);}
 assert.throws(()=>e.restore({chapter:999,cursor:0}));const bad=e.checkpoint(e.newState());bad.stack=[[1000,0]];assert.throws(()=>e.restore(bad));
});
test('all 856 CG variants survive grouping and can be tapped through once',async()=>{
 const g=await gallery,items=JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8')),groups=g.groupGallery(items);
 assert.equal(items.length,856);assert.equal(groups.flatMap(x=>x.variants).length,856);assert.ok(groups.length<856);
 const seen=new Set();for(const group of groups){let cursor=0;for(let i=0;i<group.variants.length;i++){const item=group.variants[cursor];assert.ok(paths[item.image]);seen.add(item.image);cursor=g.stepVariant(cursor,1,group.variants.length);}assert.equal(cursor,0);}assert.equal(seen.size,856);
});
test('every chapter opens or terminates within a bounded VM budget',async()=>{
 const e=await engine,results=[],failures=[];
 for(const chapter of catalog.chapters){const s=e.newState(chapter.id);let f,steps=0;
  try{for(;steps<1000;steps++){f=e.readFrame(stories[s.chapter],s);if(f.type!=='jump'&&f.type!=='yield')break;}assert.ok(steps<1000);results.push({chapter:chapter.id,scene:s.chapter,cursor:s.cursor,type:f.type});}
  catch(error){failures.push({chapter:chapter.id,message:error.message});}
 }
 fs.writeFileSync(path.join(root,'test-chapter-openings.json'),JSON.stringify({checked:results.length,failures,results},null,2));assert.deepEqual(failures,[]);
});
