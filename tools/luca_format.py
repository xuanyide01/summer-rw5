import struct, json, re, sys, collections, os
from pathlib import Path
ROOT=Path(os.environ.get('SUMMER_GAME_ROOT', '.')).resolve()
OUT=Path(__file__).resolve().parents[1]/'.luca-research'
OUT.mkdir(exist_ok=True)
def pak_index(path):
    with open(path,'rb') as f:
        first=f.read(36); h=struct.unpack('<9I',first); f.seek(0); b=f.read(h[0])
    p={'EVENTCG2.PAK':64,'OTHCGB.PAK':56}.get(path.name,32)
    if path.name not in ['EVENTCG2.PAK','OTHCGB.PAK']:
        while struct.unpack_from('<I',b,p)[0]!=h[0]//h[3]:
            p+=4
            if p>=256:raise ValueError(('directory',path))
    names=b[struct.unpack_from('<I',b,p-4)[0]:].split(b'\0') if h[8]&512 else []
    entries=[]
    for i in range(h[1]):
        block,size=struct.unpack_from('<II',b,p+i*8)
        if names:
            try:name=names[i].decode('utf-8')
            except UnicodeDecodeError:name=names[i].decode('cp932')
        else:name=str(h[2]+i)
        if size and (block*h[3]<h[0] or block*h[3]+size>path.stat().st_size):raise ValueError(('entry bounds',name))
        entries.append({'id':h[2]+i,'name':name,'offset':block*h[3],'size':size})
    return entries
def opcodes():
    b=(ROOT/'SummerPocketsRB.exe').read_bytes(); p=b.index(b'EQU\0'); ops=[]
    while True:
        z=b.index(0,p); s=b[p:z].decode('ascii',errors='replace')
        if not re.fullmatch('[A-Z][A-Z0-9_]+',s): break
        ops.append(s); p=z
        while b[p]==0: p+=1
    return ops
def commands(b,ops):
    p=0; out=[]
    while p<len(b):
        n,op,flag=struct.unpack_from('<HBB',b,p)
        if n<4 or p+n>len(b): raise ValueError((p,n,len(b)))
        v=b[p+4:p+n]; fixed=list(struct.unpack_from('<'+'H'*min(flag,2),v)) if flag else []
        v=v[2*min(flag,2):]
        out.append({'p':p,'op':ops[op] if op<len(ops) else str(op),'flag':flag,'fixed':fixed,'hex':v.hex()})
        p+=(n+1)//2*2
    return out
if __name__=='__main__':
    ops=opcodes(); (OUT/'opcodes.json').write_text(json.dumps(ops),encoding='utf-8'); print(list(enumerate(ops)))
    scenes={}; counts=collections.Counter()
    for e in pak_index(ROOT/'files/SCRIPT2.PAK'):
        with open(ROOT/'files/SCRIPT2.PAK','rb') as f:f.seek(e['offset']); b=f.read(e['size'])
        try:c=commands(b,ops)
        except Exception as ex: print('skip',e['name'],str(ex)); continue
        scenes[e['name']]=c; counts.update(x['op'] for x in c)
    (OUT/'all-commands.json').write_text(json.dumps(scenes,ensure_ascii=False),encoding='utf-8')
    (OUT/'opcode-counts.json').write_text(json.dumps(counts,indent=2),encoding='utf-8')
    for name in ['00_シナリオフロー','10_プロローグ0725']:
        print(name,[(x['p'],x['op'],x['fixed'],bytes.fromhex(x['hex']).decode('cp932','replace')[:100]) for x in scenes[name] if x['op'] in ['JUMP','FARCALL','IFY','IFN','GOTO','SELECT','EQU','EQUV','IMAGELOAD']][:50])
    print(counts)
