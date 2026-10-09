const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('character eyes and mouths resolve to complete close portraits, with true-color PNG',()=>{
 const records=JSON.parse(fs.readFileSync(path.join(root,'portrait-quality-report.json'),'utf8')).images;
 const headers=JSON.parse(fs.readFileSync(path.join(root,'portrait-source-headers.json'),'utf8'));
 const paths=JSON.parse(/const paths=(.*);\r?\n/.exec(fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8'))[1]);
 assert.equal(records.length,277);
 for(const record of records){
  const original=headers.find(e=>e.id===record.sourceId);assert.ok(original);
  assert.match(original.name,/^BS[123]_.*01$/i);assert.ok(original.dh>=500);
  const png=fs.readFileSync(path.join(root,'src/common/images',record.file));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),record.size[0]);assert.equal(png.readUInt32BE(20),record.size[1]);
  assert.equal(png[24],8);assert.equal(png[25],6,'RGBA, without the destructive 32-color palette');
  assert.ok(record.size[0]<=200&&record.size[1]<=256);assert.ok(record.size[0]*record.size[1]*4<=204800);
 }
 // These two source IDs are facial patches, not complete characters.
 assert.equal(paths.i10004,'portrait_ao010101.png');assert.equal(paths.i13061,'portrait_sr010101.png');
 assert.equal(records.find(x=>x.family==='AO010101').source,'BS3_AO01010101');
 assert.equal(records.find(x=>x.family==='SR010101').source,'BS3_SR01010101');
 for(const entry of headers){const resolved=paths['i'+entry.id];if(resolved)assert.ok(resolved.startsWith('portrait_'),entry.name);}
});
