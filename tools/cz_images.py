import sys,struct,json,time,collections,concurrent.futures
from pathlib import Path
from array import array
import numpy as np
from PIL import Image
from luca_format import ROOT,OUT,pak_index
def decode(b):
    magic,n,w,h,bits=struct.unpack_from('<4sIHHH',b)
    if magic[:3]==b'CZ0':return Image.frombytes('RGBA',(w,h),b[n:n+w*h*4])
    if magic[:3] not in [b'CZ4',b'CZ3']: raise ValueError(('unsupported',magic))
    count=struct.unpack_from('<I',b,n)[0]; blocks=[struct.unpack_from('<II',b,n+4+i*8) for i in range(count)]; p=n+4+8*count; chunks=[]
    for codesize,rawsize in blocks:
        codes=array('H'); codes.frombytes(b[p:p+2*codesize]); p+=2*codesize
        table=[bytes([i]) for i in range(256)]; prev=table[codes[0]]; result=bytearray()
        for code in codes:
            entry=table[code] if code<len(table) else prev+prev[:1] if code==len(table) else None
            if entry is None: raise ValueError(('bad LZW',code,len(table)))
            result.extend(entry); table.append(prev+entry[:1]); prev=entry
        chunks.append(result)
    raw=b''.join(chunks)
    if len(raw)!=w*h*(bits//8):raise ValueError(('pixel size',len(raw),w*h*(bits//8),blocks))
    if magic[:3]==b'CZ3':
        pixels=np.frombuffer(raw,dtype=np.uint8).reshape(h,w,bits//8).copy();block=(h+2)//3
        for start in range(0,h,block):pixels[start:start+block]=np.cumsum(pixels[start:start+block],axis=0,dtype=np.uint32).astype(np.uint8)
        return Image.fromarray(pixels,'RGBA' if bits==32 else 'RGB').convert('RGBA')
    rgb=np.frombuffer(raw[:w*h*3],dtype=np.uint8).reshape(h,w,3).copy(); alpha=np.frombuffer(raw[w*h*3:],dtype=np.uint8).reshape(h,w,1).copy()
    block=(h+2)//3
    for start in range(0,h,block):
        rgb[start:start+block]=np.cumsum(rgb[start:start+block],axis=0,dtype=np.uint32).astype(np.uint8)
        alpha[start:start+block]=np.cumsum(alpha[start:start+block],axis=0,dtype=np.uint32).astype(np.uint8)
    return Image.fromarray(np.concatenate([rgb,alpha],axis=2),'RGBA')
def export(job):
    archive,e,dest=job; path=ROOT/'files/image'/archive
    with open(path,'rb') as f:f.seek(e['offset']); b=f.read(e['size'])
    img=decode(b); original=img.size
    kind='body' if archive=='CHARCG.PAK' else 'scene'
    # Crop transparent padding only; preserve the entire CG composition.
    if kind=='body':
        # Raw expressions can be patches. Use restore-portraits.py for final app portraits.
        box=img.getchannel('A').getbbox()
        if box:img=img.crop(box)
        img.thumbnail((224,286),Image.Resampling.LANCZOS)
        filename='i'+str(e['id'])+'.png'; img.save(Path(dest)/filename,optimize=True)
    else:
        img.thumbnail((320,240),Image.Resampling.LANCZOS)
        bg=Image.new('RGB',img.size,(8,16,24));bg.paste(img,mask=img.getchannel('A'))
        filename='i'+str(e['id'])+'.jpg';bg.save(Path(dest)/filename,quality=35,optimize=True,progressive=False,subsampling=2)
    return {'id':e['id'],'name':e['name'],'file':filename,'archive':archive,'original':original,'size':img.size,'bytes':(Path(dest)/filename).stat().st_size}
if __name__=='__main__':
    indexes={p.name:pak_index(p) for p in (ROOT/'files/image').glob('*.PAK')}
    (OUT/'image-index.json').write_text(json.dumps(indexes,ensure_ascii=False),encoding='utf8')
    print({a:(len(es),es[0]['id'],es[-1]['id'],es[0]['name']) for a,es in indexes.items()},flush=True)
    dest=Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'image-preview'; dest.mkdir(parents=True,exist_ok=True)
    if len(sys.argv)>2:
        tasks=json.loads(Path(sys.argv[2]).read_text(encoding='utf8'))
    else:tasks=[['EVENTCG.PAK',indexes['EVENTCG.PAK'][0],str(dest)]]
    records=[]; errors=[]; start=time.time()
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        futurejobs={pool.submit(export,job):job for job in tasks}
        for fu in concurrent.futures.as_completed(futurejobs):
            try:records.append(fu.result())
            except Exception as ex:errors.append({'job':futurejobs[fu],'error':repr(ex)})
            if (len(records)+len(errors))%50==0:print('images',len(records),'errors',len(errors),'seconds',round(time.time()-start),flush=True)
    (dest.parent/'image-report.json').write_text(json.dumps({'images':records,'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
    print('done',len(records),errors[:5],'seconds',round(time.time()-start),flush=True)
