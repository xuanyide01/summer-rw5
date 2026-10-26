"""Losslessly cache smaller raw DEFLATE streams for the packaged story text."""
import concurrent.futures,hashlib,json,os,sys,zlib
from pathlib import Path
if os.environ.get('WATCH_COMPRESSION_DEPS'):
    sys.path.insert(0,os.environ['WATCH_COMPRESSION_DEPS'])
import zopfli.zlib
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'tools/install-deflate-cache';CACHE.mkdir(exist_ok=True)
def encode(file):
    raw=file.read_bytes();key=hashlib.sha256(raw).hexdigest();target=CACHE/(key+'.deflate')
    if target.exists():data=target.read_bytes()
    else:data=zopfli.zlib.compress(raw,numiterations=3)[2:-4];target.write_bytes(data)
    assert zlib.decompress(data,-15)==raw
    return {'file':file.relative_to(ROOT).as_posix(),'bytes':len(raw),'deflateBytes':len(data),'sha256':key}
if __name__=='__main__':
    files=list((ROOT/'src/common').rglob('*.txt'));rows=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for row in pool.map(encode,files):
            rows.append(row)
            if len(rows)%80==0:print(json.dumps({'prepared':len(rows),'total':len(files)}),flush=True)
    report={'allDecodedTextBytesIdentical':True,'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'deflateBytes':sum(r['deflateBytes'] for r in rows),'rows':rows}
    (ROOT/'reports/install-deflate-v020.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
