"""Restore readable watch portraits from complete original CHARCG base images.

Keeps one expression per pose/outfit, matching the small-package reader policy.
Never uses an eye/mouth patch as a complete character. Exports true RGBA PNG with mild RGB rounding,
not a 32-color palette, and prefers the original close view for a small screen.
"""
import json,re,hashlib,concurrent.futures
from pathlib import Path
from PIL import Image
from cz_images import decode
import importlib.util
_spec=importlib.util.spec_from_file_location('portrait_compression',Path(__file__).with_name('compress-portraits.py'))
_module=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_module)
quantize_rgb=_module.quantize_rgb
from luca_format import ROOT as GAME

PROJECT=Path(__file__).resolve().parents[1]
COMMON=PROJECT/'src/common'
LIMIT=(200,256)
def family(name):
    return re.sub(r'^(?:F_)?BS[123]_', '',name,flags=re.I)[:-2].upper()
def export(job):
    pose,e=job
    with open(GAME/'files/image/CHARCG.PAK','rb') as f:
        f.seek(e['offset']);raw=f.read(e['size'])
    original=decode(raw).convert('RGBA')
    # 01 is a complete base pose; other numbers can be only eye/mouth patches.
    assert e['name'].endswith('01') and not e['name'].upper().startswith('F_')
    # Smaller characters (e.g. TR) occupy only part of the tall source canvas.
    assert original.height >= 500,(e['name'],original.size)
    box=original.getchannel('A').getbbox();assert box
    im=original.crop(box);im.thumbnail(LIMIT,Image.Resampling.LANCZOS)
    filename='portrait_'+pose.lower()+'.png';dest=COMMON/'images'/filename
    im=quantize_rgb(im);im.save(dest,optimize=True,compress_level=9)
    return {'family':pose,'sourceId':e['id'],'source':e['name'],
        'sourceSize':list(original.size),'crop':list(box),'file':filename,
        'size':list(im.size),'mode':'RGBA','bytes':dest.stat().st_size,
        'colors':len(im.convert('RGB').getcolors(im.width*im.height) or [])}

def main():
    entries=json.loads((PROJECT/'portrait-source-headers.json').read_text(encoding='utf8'))
    paths=json.loads(re.search(r'const paths=(.*);',(COMMON/'assets.js').read_text(encoding='utf8'))[1])
    mapped=[e for e in entries if 'i'+str(e['id']) in paths]
    active={family(e['name']) for e in mapped}
    bases={}
    for pose in sorted(active):
        candidates=[e for e in entries if family(e['name'])==pose
                    and e['name'].endswith('01') and not e['name'].upper().startswith('F_')]
        assert candidates,pose
        # BS3 is the original close view, BS2 middle, BS1 whole-body.
        candidates.sort(key=lambda e:(int(e['name'][2]),e['dw']*e['dh']),reverse=True)
        bases[pose]=candidates[0]
    records=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        for record in pool.map(export,bases.items()):
            records.append(record)
            if len(records)%25==0:print('portraits',len(records),'/',len(bases),flush=True)
    for e in mapped:paths['i'+str(e['id'])]='portrait_'+family(e['name']).lower()+'.png'
    old={p.name for p in (COMMON/'images').glob('i*.png')}
    # Remove only superseded generated resources within this project's image dir.
    used=set(paths.values())
    removed=[]
    for name in sorted(old-used):
        target=COMMON/'images'/name
        assert target.parent.resolve()==(COMMON/'images').resolve()
        target.unlink();removed.append(name)
    (COMMON/'assets.js').write_text('const paths='+json.dumps(paths,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf8')
    report={'version':'0.1.2','maxSize':list(LIMIT),'format':'RGBA PNG / RGB 6 bits per channel, alpha 8 bits',
            'colorQuantization':'RGB 6 bits/channel','poseGroups':len(records),'mappedIds':len(mapped),
            'sourcePolicy':'Complete suffix-01 base, original BS3 close view preferred; one expression per pose/outfit',
            'totalBytes':sum(r['bytes'] for r in records),'maxDecodedBytes':max(r['size'][0]*r['size'][1]*4 for r in records),
            'minColors':min(r['colors'] for r in records),'removedOldFiles':len(removed),'images':records}
    (PROJECT/'portrait-quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    asset=json.loads((PROJECT/'asset-report.json').read_text(encoding='utf8'))
    asset.update(retainedFiles=len(list((COMMON/'images').iterdir())),finalAssetBytes=sum(p.stat().st_size for p in (COMMON/'images').iterdir()),
        portraitMaxSize=list(LIMIT),portraitPoseGroups=len(records),portraitFormat='RGBA PNG / RGB 6 bits per channel, alpha 8 bits',
        portraitExpressionPolicy='同服装、同姿势共用完整底图，优先近景；全部 CG 差分保留')
    asset['maxDecodedImage']=max(Image.open(p).width*Image.open(p).height*4 for p in (COMMON/'images').iterdir())
    (PROJECT/'asset-report.json').write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
