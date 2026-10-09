const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const formatting=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'src/common/dialogue.js'),'utf8')).toString('base64'));
test('watch dialogue removes long script padding while preserving words, line breaks and short indents',async()=>{
 const {formatDialogue}=await formatting;
 assert.equal(formatDialogue('　　　　　　　　　好像做了一场很长很长的梦。'),'好像做了一场很长很长的梦。');
 assert.equal(formatDialogue('第一行\n　　　　　第二行\n\n　　第三段'),'第一行\n第二行\n\n　　第三段');
 assert.equal(formatDialogue('  English words  stay spaced.'),'  English words  stay spaced.');
 const ux=fs.readFileSync(path.join(root,'src/pages/index/index.ux'),'utf8');
 assert.ok(ux.includes('this.fullText=formatDialogue(this.visibleText(f.text))'));
});
test('all 46 padded lines in Tsumugi 0999 render from the left without altering original script data',async()=>{
 const {formatDialogue}=await formatting;
 const raw=fs.readFileSync(path.join(root,'converted-story/205.json'),'utf8');
 const lines=JSON.parse(raw).filter(op=>op.op==='text');
 assert.equal(lines.length,79);let corrected=0;
 for(const line of lines){
  const displayed=formatDialogue(line.text);
  if(displayed!==line.text){
   corrected++;
   // Only an actual prefix of the original text is removed, never words.
   assert.ok(line.text.endsWith(displayed));
   assert.ok(Array.from(line.text.slice(0,line.text.length-displayed.length)).every(c=>c==='\u3000'));
   assert.ok(displayed.length>0&&!/^\s/.test(displayed));
  }
 }
 assert.equal(corrected,46);
 assert.equal(fs.readFileSync(path.join(root,'converted-story/205.json'),'utf8'),raw);
});
