// Packaging revision r1: retain ZIP entries, add tail whitespace, then re-sign.
// The exact released file passed REDMI Watch 5 testing; the failure cause is unknown.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createRequire}=require('module');
function footerOffset(raw){
 for(let i=raw.length-22;i>=Math.max(0,raw.length-65557);i--)
  if(raw.readUInt32LE(i)===0x06054b50&&i+22+raw.readUInt16LE(i+20)===raw.length)return i;
 throw Error('ZIP footer not found');
}
function sized(raw,offset){
 if(offset+4>raw.length)throw Error('Truncated signature');
 const end=offset+4+raw.readUInt32LE(offset);
 if(end>raw.length)throw Error('Truncated signature');
 return {data:raw.subarray(offset+4,end),end};
}
function outerCertificate(raw,start,central){
 for(let offset=start+8;offset<central-24;){
  const length=Number(raw.readBigUInt64LE(offset));
  if(length<4||offset+8+length>central-24)throw Error('Invalid signature entry');
  if(raw.readUInt32LE(offset+8)===0x1000101){
   const signers=sized(raw.subarray(offset+12,offset+8+length),0).data;
   const signer=sized(signers,0).data,signed=sized(signer,0).data;
   const digests=sized(signed,0),certificates=sized(signed,digests.end).data;
   return sized(certificates,0).data;
  }
  offset+=8+length;
 }
 throw Error('Package certificate not found');
}
async function repackRpk(input,output,toolkit){
 const requireToolkit=createRequire(path.join(path.resolve(toolkit),'package.json'));
 const JSZip=requireToolkit('jszip'),algorithmPath=requireToolkit.resolve('@aiot-toolkit/packager/lib/signature/algorithm');
 const {doSign}=require(algorithmPath),pem=path.join(path.dirname(algorithmPath),'../pem');
 const key=fs.readFileSync(path.join(pem,'private.pem')),cert=fs.readFileSync(path.join(pem,'certificate.pem'));
 const original=fs.readFileSync(input),footer=footerOffset(original),central=original.readUInt32LE(footer+16);
 if(original.subarray(central-16,central).toString()!=='RPK Sig Block 42')throw Error('Expected signed RPK');
 const blockLength=Number(original.readBigUInt64LE(central-24))+8,start=central-blockLength;
 if(start<0||original.readBigUInt64LE(start)+8n!==BigInt(blockLength))throw Error('Invalid RPK signature block');
 if(!outerCertificate(original,start,central).equals(new crypto.X509Certificate(cert).raw))
  throw Error('r1 packaging supports the compatible toolkit development certificate only');
 const zip=await JSZip.loadAsync(original,{checkCRC32:true});
 const extra=(1-original.length%16+16)%16;
 if(original.readUInt16LE(footer+20)+extra>65535)throw Error('ZIP comment too long');
 let signed=original;
 if(extra){
  const unsigned=Buffer.concat([original.subarray(0,start),original.subarray(central),Buffer.alloc(extra,32)]);
  const unsignedFooter=footer-blockLength;
  unsigned.writeUInt32LE(start,unsignedFooter+16);
  unsigned.writeUInt16LE(original.readUInt16LE(footer+20)+extra,unsignedFooter+20);
  const files=[];
  for(const name of Object.keys(zip.files))if(!zip.files[name].dir)
   files.push({name,hash:crypto.createHash('sha256').update(await zip.file(name).async('nodebuffer')).digest()});
  signed=doSign(unsigned,files,key,cert);
  if(!Buffer.isBuffer(signed)||signed.length!==original.length+extra)throw Error('Unexpected signed size');
  const newFooter=footerOffset(signed),newCentral=signed.readUInt32LE(newFooter+16);
  if(!signed.subarray(0,start).equals(original.subarray(0,start))||
     !signed.subarray(newCentral,newFooter).equals(original.subarray(central,footer)))
   throw Error('ZIP entry bytes changed');
  await JSZip.loadAsync(signed,{checkCRC32:true});
 }
 if(signed.length>25000000)throw Error('Package exceeds 25,000,000 bytes');
 fs.writeFileSync(output,signed);
 return {bytes:signed.length,sha256:crypto.createHash('sha256').update(signed).digest('hex'),extraZipCommentBytes:extra};
}
module.exports={repackRpk};
if(require.main===module){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: node tools/repack-rpk.cjs INPUT.rpk OUTPUT.rpk');
 const toolkit=process.env.WATCH_COMPAT_TOOLKIT||path.join(__dirname,'compat-toolkit/node_modules/aiot-toolkit');
 repackRpk(input,output,toolkit).then(result=>console.log('R1_PACKAGING',JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
