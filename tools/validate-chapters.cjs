const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const uri=t=>'data:text/javascript;base64,'+Buffer.from(t).toString('base64');
const source=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8');
const catalog=JSON.parse(source.replace('export const catalog=','').trim().slice(0,-1));
(async()=>{
 const engine=await import(uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(uri(source)))));
 const stories={};for(let i=1;i<=catalog.count;i++)stories[i]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',i+'.json'),'utf8'));
 const runs=[],failures=[];let total=0;
 for(const chapter of catalog.chapters)for(let policy=0;policy<2;policy++){
  const state=engine.newState(chapter.id);let frames=0,automatic=0,f;
  try{
   for(;frames<60000;){
    f=engine.readFrame(stories[state.chapter],state);
    if(f.type==='text'){frames++;automatic=0;if(frames%503===0){const a=engine.checkpoint(state),b=engine.checkpoint(engine.restore(JSON.parse(JSON.stringify(a))));if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('save mismatch');}state.cursor++;}
    else if(f.type==='choice'||f.type==='map'){const items=f.type==='map'?engine.previewMap(stories[catalog.mapScene],state,f):f.items;if(!items.length)throw new Error('map has no supported options');const index=policy===0?0:items.length-1;engine.choose(state,items[index],index);automatic=0;}
    else if(f.type==='end')break;
    else if(++automatic>1000)throw new Error('automatic loop');
   }
   if(frames>=60000)throw new Error('frame limit');runs.push({chapter:chapter.id,policy,frames,result:f.type});total+=frames;
  }catch(error){failures.push({chapter:chapter.id,source:chapter.source,policy,scene:state.chapter,cursor:state.cursor,frames,error:error.message});}
 }
 const report={runs:runs.length,totalFrames:total,failures,details:runs,coverage:'每个可选章节分别以首项/末项策略遍历；不代表穷举所有原版路线组合'};
 fs.writeFileSync(path.join(root,'chapter-traversal-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({runs:report.runs,totalFrames:total,failures}));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
