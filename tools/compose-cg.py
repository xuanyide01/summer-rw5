import json,re,hashlib,shutil,concurrent.futures,collections,time,sys
from pathlib import Path
from PIL import Image
from cz_images import decode
from luca_format import ROOT
PROJECT=Path(__file__).resolve().parents[1];COMMON=PROJECT/'src/common';STAGE=PROJECT/'.luca-research/composed-cg';STAGE.mkdir(parents=True,exist_ok=True)
DATA=json.loads((PROJECT/'cg-source-headers.json').read_text(encoding='utf-8'));ENTRIES={x['id']:x for x in DATA['entries']}
PATHS=json.loads(re.search(r'const paths=(.*);\n',(COMMON/'assets.js').read_text(encoding='utf-8'))[1])
def family(e):
    m=re.match(r'^(cg|ef)_([a-z]+\d+)_',e['name'],re.I)
    return m[0].lower() if m else e['name'].lower()
def load(e):
    with open(ROOT/'files/image'/e['archive'],'rb') as f:f.seek(e['offset']);data=f.read(e['size'])
    return decode(data)
def group_job(ids):
    cache={};records=[];plans={}
    def parts(e):
        m=re.match(r'^(cg_[a-z]+\d+_)([a-z]*)(\d{2})(\d{2})(.*)$',e['name'],re.I)
        return (m[1].lower()+m[2].lower()+m[3],int(m[4]),m[5].lower()) if m else None
    def select_base(e):
        p=parts(e);peers=[ENTRIES[i] for i in ids if i!=e['id']];full=[a for a in peers if (a['w'],a['h'])==(a['cw'],a['ch']) and a['x']==a['y']==0 and '_text' not in a['name'].lower()]
        # Object/postcard illustrations without a full scene stay independent.
        if not full:return None
        same=[a for a in peers if p and parts(a) and parts(a)[0]==p[0] and (a['cw'],a['ch'])==(e['cw'],e['ch'])]
        samefull=[a for a in same if a in full]
        if samefull:return min(samefull,key=lambda a:(parts(a)[2]!=p[2],parts(a)[1],a['name'].lower()))['id']
        earlier=[a for a in same if parts(a)[1]<p[1]]
        if earlier:return min(earlier,key=lambda a:(parts(a)[2]!=p[2],parts(a)[1],a['name'].lower()))['id']
        return min(full,key=lambda a:((a['cw'],a['ch'])!=(e['cw'],e['ch']),a['name'].lower()))['id']
    def generate(id,trail=()):
        if id in cache:return cache[id]
        assert id not in trail and len(trail)<32,('composition cycle',trail,id)
        e=ENTRIES[id];target=(max(1,round(e['cw']*min(320/e['cw'],240/e['ch'],1))),max(1,round(e['ch']*min(320/e['cw'],240/e['ch'],1))))
        patch=e['x']!=0 or e['y']!=0 or (e['w'],e['h'])!=(e['cw'],e['ch']);baseId=None;kind='full'
        if not patch:image=load(e).resize(target,Image.Resampling.LANCZOS)
        else:
            baseId=select_base(e)
            if baseId:image=generate(baseId,trail+(id,)).resize(target,Image.Resampling.LANCZOS);kind='composed'
            else:image=Image.new('RGBA',target,(8,16,24,255));kind='standalone-on-original-canvas'
            piece=load(e);sx=target[0]/e['cw'];sy=target[1]/e['ch'];piece=piece.resize((max(1,round(e['w']*sx)),max(1,round(e['h']*sy))),Image.Resampling.LANCZOS)
            image.alpha_composite(piece,(round(e['x']*sx),round(e['y']*sy)))
        cache[id]=image;plans[id]=(kind,baseId);return image
    for id in ids:
        e=ENTRIES[id];image=generate(id);kind,baseId=plans[id];target=image.size;output=STAGE/('i'+str(id)+'.jpg')
        background=Image.new('RGB',image.size,(8,16,24));background.paste(image,mask=image.getchannel('A'));background.save(output,quality=35,optimize=True,progressive=False,subsampling=2)
        records.append({'id':id,'source':e['name'],'kind':kind,'base':baseId,'sourceCanvas':[e['cw'],e['ch']],'sourcePatch':[e['x'],e['y'],e['w'],e['h']],'outputSize':target,'bytes':output.stat().st_size})
    return records
if __name__=='__main__':
    groups=collections.defaultdict(list)
    for id,e in ENTRIES.items():groups[family(e)].append(id)
    records=[];started=time.time()
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        pending=[pool.submit(group_job,ids) for ids in groups.values()]
        for future in concurrent.futures.as_completed(pending):
            records.extend(future.result())
            if len(records)%40<10:print('CGs',len(records),'seconds',round(time.time()-started),flush=True)
    assert len(records)==856
    seen={}
    for record in sorted(records,key=lambda x:x['id']):
        key='i'+str(record['id']);p=STAGE/(key+'.jpg');sha=hashlib.sha256(p.read_bytes()).hexdigest()
        if sha not in seen:seen[sha]=p.name;shutil.copyfile(p,COMMON/'images'/p.name)
        PATHS[key]=seen[sha]
    keep=set(PATHS.values())|{'title_bg.jpg','bg_black.jpg'}
    for p in (COMMON/'images').iterdir():
        if p.name not in keep:p.unlink()
    (COMMON/'assets.js').write_text('const paths='+json.dumps(PATHS,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf-8')
    counts=dict(collections.Counter(x['kind'] for x in records));report={'cgImages':856,'counts':counts,'uniqueCgFiles':len(seen),'sizeLimit':[320,240],'policy':'同场景底图与透明差分按原画布坐标合成；无底图的独立插画按原画布位置展示','records':sorted(records,key=lambda x:x['id'])}
    (PROJECT/'cg-composition-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    report=json.loads((PROJECT/'asset-report.json').read_text(encoding='utf-8'));report.update(finalAssetBytes=sum(p.stat().st_size for p in (COMMON/'images').iterdir()),retainedFiles=sum(1 for p in (COMMON/'images').iterdir()),cgComposition=counts)
    (PROJECT/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print('COMPOSED_CG_READY',counts,report['finalAssetBytes'],flush=True)
