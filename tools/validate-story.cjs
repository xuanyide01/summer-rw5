const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const uri=t=>'data:text/javascript;base64,'+Buffer.from(t).toString('base64');
const source=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8'),catalog=JSON.parse(source.replace('export const catalog=','').trim().slice(0,-1));
(async()=>{
 const e=await import(uri(fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace("'./catalog.js'",JSON.stringify(uri(source)))));
 const all={};for(let i=1;i<=catalog.count;i++)all[i]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',i+'.json'),'utf8'));
 const results=[];
 for(let policy=0;policy<2;policy++){
  const st=e.newState(catalog.flowScene,true);let text=0,maps=0,choices=0,automatic=0,f;const mapSelections=[];
  for(let i=0;i<100000;i++){
   f=e.readFrame(all[st.chapter],st);
   if(f.type==='text'){text++;automatic=0;st.cursor++;}
   else if(f.type==='choice'||f.type==='map'){
    const items=f.type==='map'?e.previewMap(all[catalog.mapScene],st,f):f.items;
    if(!items.length)throw new Error('Empty map '+st.chapter+':'+st.cursor);
    const index=policy===0?0:items.length-1;if(f.type==='map'){maps++;mapSelections.push({cursor:st.cursor,options:items.map(x=>({value:x.value,text:x.text})),selected:items[index].value});}else choices++;
    e.choose(st,items[index],index);automatic=0;
   }else if(f.type==='end')break;
   else if(++automatic>1000)throw new Error('Loop '+st.chapter+':'+st.cursor);
   if(i===99999)throw new Error('Frame limit '+JSON.stringify({text,maps,choices,scene:st.chapter,cursor:st.cursor,stack:st.stack,root:st.rootChapter,variables:st.variables}));
  }
  results.push({policy,text,maps,choices,type:f.type,scene:st.chapter,cursor:st.cursor,mapSelections});
 }
 fs.writeFileSync(path.join(root,'story-flow-report.json'),JSON.stringify({results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
