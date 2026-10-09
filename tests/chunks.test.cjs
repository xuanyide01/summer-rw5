const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),uri=x=>'data:text/javascript;base64,'+Buffer.from(x).toString('base64');
const source=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8'),catalog=JSON.parse(source.replace('export const catalog=','').trim().slice(0,-1));
test('packaged story blocks preserve every operation and both complete story flows',async()=>{
 const e=await import(uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(uri(source))))),full={},chunks={};let blocks=0;
 for(let scene=1;scene<=catalog.count;scene++){
  full[scene]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',scene+'.json'),'utf8'));chunks[scene]=[];
  for(let block=0;block<Math.max(1,Math.ceil(full[scene].length/1024));block++){chunks[scene][block]=JSON.parse(fs.readFileSync(path.join(root,'src/common/story',String(scene),block+'.txt'),'utf8'));blocks++;}
  assert.deepEqual(chunks[scene].flat(),full[scene]);assert.equal(catalog.scenes[String(scene)].length,full[scene].length);
 }
 function frame(state,chunked){for(let budget=0;budget<1000;budget++){
  const scene=state.chapter,base=chunked?Math.floor(state.cursor/1024)*1024:0,ops=chunked?(chunks[scene][base/1024]||[]):full[scene];
  const result=e.readFrame(ops,state,base,full[scene].length);if(result.type!=='yield'&&result.type!=='jump')return result;
 }throw Error('Automatic instruction budget exceeded');}
 const results=[];
 for(let policy=0;policy<2;policy++){
  const a=e.newState(catalog.flowScene,true),b=e.newState(catalog.flowScene,true),hash=crypto.createHash('sha256');let visible=0,ended=false;
  for(let step=0;step<100000;step++){
   const fa=frame(a,false),fb=frame(b,true);assert.deepEqual(fb,fa);assert.deepEqual(e.checkpoint(b),e.checkpoint(a));hash.update(JSON.stringify([a.chapter,a.cursor,fa]));visible++;
   if(fa.type==='end'){ended=true;break;}
   if(fa.type==='text'){a.cursor++;b.cursor++;continue;}
   const ia=fa.type==='map'?e.previewMap(full[catalog.mapScene],a,fa):fa.items,ib=fb.type==='map'?e.previewMap(full[catalog.mapScene],b,fb):fb.items;
   assert.deepEqual(ib,ia);assert.ok(ia.length);const index=policy===0?0:ia.length-1;e.choose(a,ia[index],index);e.choose(b,ib[index],index);
  }
  assert.ok(ended);results.push({policy,visibleFrames:visible,sha256:hash.digest('hex'),result:'passed'});
 }
 fs.writeFileSync(path.join(root,'chunk-equivalence-report.json'),JSON.stringify({blockSize:1024,blocks,scenes:catalog.count,results},null,2));
});
