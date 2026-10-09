const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function jpegSize(file){const data=fs.readFileSync(file);assert.equal(data.readUInt16BE(0),0xffd8);let offset=2;while(offset<data.length){assert.equal(data[offset++],255);while(data[offset]===255)offset++;const marker=data[offset++],size=data.readUInt16BE(offset);if([192,193,194].includes(marker))return [data.readUInt16BE(offset+5),data.readUInt16BE(offset+3)];offset+=size;}throw Error('Missing JPEG dimensions');}
test('all CGs retain their full original canvas, including facial patches and nested pose differences',()=>{
 const original=JSON.parse(fs.readFileSync(path.join(root,'cg-source-headers.json'),'utf8')).entries,report=JSON.parse(fs.readFileSync(path.join(root,'cg-composition-report.json'),'utf8'));
 const paths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);assert.equal(original.length,856);assert.equal(report.records.length,856);const by=new Map(report.records.map(x=>[x.id,x]));
 for(const entry of original){const scale=Math.min(320/entry.cw,240/entry.ch,1),expected=[Math.max(1,Math.round(entry.cw*scale)),Math.max(1,Math.round(entry.ch*scale))];assert.deepEqual(jpegSize(path.join(root,'src/common/images',paths['i'+entry.id])),expected,entry.name);let node=by.get(entry.id);const seen=new Set();while(node.base){assert.ok(!seen.has(node.id));seen.add(node.id);assert.ok(by.has(node.base));node=by.get(node.base);assert.ok(seen.size<32);}}
 const facial=by.get(1089);assert.equal(facial.kind,'composed');assert.equal(facial.base,1090);assert.deepEqual(facial.outputSize,[320,180]);
 assert.ok(report.records.some(x=>x.base&&by.get(x.base).kind==='composed'),'Multi-step pose then expression composition is present');
});
