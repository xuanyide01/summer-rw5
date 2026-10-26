// Keep binary payloads STORE; DEFLATE only enough text to meet the size cap.
// Adapted from the physically tested Steins;Gate 0 and CLANNAD packaging approach.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{createRequire}=require('module');
module.exports=async function(file,toolkit){
 const req=createRequire(path.join(path.resolve(toolkit),'package.json')),JSZip=req('jszip'),CompressedObject=req('jszip/lib/compressedObject'),compression=req('jszip/lib/compressions').DEFLATE,
  algorithm=req.resolve('@aiot-toolkit/packager/lib/signature/algorithm'),pem=path.join(path.dirname(algorithm),'../pem');
 const before=fs.readFileSync(file),zip=await JSZip.loadAsync(before,{checkCRC32:true}),files=[],rows=[];zip.comment='';let estimate=before.length;
 for(const [name,entry] of Object.entries(zip.files)){
  if(entry.dir){entry.options.compression='STORE';continue;}
  const data=await entry.async('nodebuffer'),digest=crypto.createHash('sha256').update(data).digest();files.push({name,hash:digest});
  const text=/\.(js|json|txt|css|ux)$/i.test(name),oldSize=entry._data.compressedSize;let compressed=oldSize;
  if(text){
   const cache=path.join(__dirname,'install-deflate-cache',digest.toString('hex')+'.deflate');
   if(fs.existsSync(cache)){const raw=fs.readFileSync(cache);if(!zlib.inflateRawSync(raw).equals(data))throw Error('Invalid text stream cache');entry._data=new CompressedObject(raw.length,data.length,entry._data.crc32,compression,raw);compressed=raw.length;}
  }
  estimate+=data.length-oldSize;entry.options.compression='STORE';rows.push({name,entry,bytes:data.length,compressed,saving:data.length-compressed,text});
 }
 const retained=new Set();function deflate(r){if(retained.has(r.name)||r.saving<=0)return;retained.add(r.name);r.entry.options.compression='DEFLATE';estimate-=r.saving;}
 rows.filter(r=>r.text&&r.bytes>=65536).forEach(deflate);
 for(const r of rows.filter(r=>r.text&&!retained.has(r.name)).sort((a,b)=>b.saving-a.saving)){if(estimate<=24985000)break;deflate(r);}
 const unsigned=await zip.generateAsync({type:'nodebuffer',compression:'STORE',compressionOptions:{level:9}}),
  signed=require(algorithm).doSign(unsigned,files,fs.readFileSync(path.join(pem,'private.pem')),fs.readFileSync(path.join(pem,'certificate.pem')));
 if(signed.length>25000000)throw Error('Low-inflate package exceeds 25 MB: '+signed.length);
 const verified=await JSZip.loadAsync(signed,{checkCRC32:true});
 for(const f of files)if(!crypto.createHash('sha256').update(await verified.file(f.name).async('nodebuffer')).digest().equals(f.hash))throw Error('Payload changed: '+f.name);
 const deflated=rows.filter(r=>retained.has(r.name));
 if(rows.some(r=>!r.text&&retained.has(r.name)))throw Error('Binary resource requires inflate');
 fs.writeFileSync(file,signed);
 fs.writeFileSync(path.join(__dirname,'../reports/install-packaging-v025.json'),JSON.stringify({passed:true,sourceBytes:before.length,bytesBeforeR1:signed.length,allUncompressedPayloadBytesIdentical:true,allImagesPcmAndFontStored:true,storedFiles:rows.length-deflated.length,deflatedFiles:deflated.length,largestDeflatedBytes:Math.max(...deflated.map(r=>r.bytes)),deflatedUncompressedBytes:deflated.reduce((n,r)=>n+r.bytes,0),actualFirmwareHeapNotMeasured:true,deflatedEntries:deflated.map(({name,bytes,compressed})=>({name,bytes,compressed}))},null,2));
};
