"""Recompress full, readable RGBA portraits to meet the 25,000,000-byte cap.

Use the supplied 0.1.1 source image folder as the immutable input. RGB is rounded
to 6 bits/channel (262,144 possible colors), alpha remains 8-bit. PNG encoding is
lossless after that mild quantization; this is not a 32-color palette image.
"""
import json,math,sys
from pathlib import Path
from PIL import Image
import numpy as np
PROJECT=Path(__file__).resolve().parents[1]
LIMIT=(200,256)
def quantize_rgb(im):
    data=np.asarray(im.convert('RGBA'),dtype=np.uint16).copy()
    for c in range(3):data[:,:,c]=((data[:,:,c]*63+127)//255*255+31)//63
    return Image.fromarray(data.astype(np.uint8),'RGBA')
def main():
    source=Path(sys.argv[1]).resolve();dest=PROJECT/'src/common/images'
    assert source!=dest.resolve(),'Use a separate immutable source folder.'
    files=sorted(source.glob('portrait_*.png'));assert len(files)==277
    records=[]
    for p in files:
        original=Image.open(p).convert('RGBA');base=original.copy();base.thumbnail(LIMIT,Image.Resampling.LANCZOS)
        final=quantize_rgb(base);out=dest/p.name;final.save(out,optimize=True,compress_level=9)
        # Independently inspect the written PNG and compare all its pixels.
        actual=Image.open(out).convert('RGBA');a=np.asarray(actual).astype(np.int16);b=np.asarray(base).astype(np.int16)
        alpha_equal=bool(np.array_equal(a[:,:,3],b[:,:,3]));error=int(np.max(np.abs(a[:,:,:3]-b[:,:,:3])))
        assert alpha_equal and error<=2
        mask=b[:,:,3]>240;mse=float(np.mean((a[:,:,:3][mask].astype(float)-b[:,:,:3][mask])**2));psnr=10*math.log10(255**2/mse) if mse else 100
        colors=len(actual.convert('RGB').getcolors(actual.width*actual.height) or []);assert colors>1000
        records.append({'file':p.name,'before':list(original.size),'size':list(actual.size),'bytes':out.stat().st_size,
                        'maxRgbError':error,'alphaUnchanged':alpha_equal,'psnrDb':psnr,'colors':colors})
    report={'version':'0.1.3','fileCapBytes':25000000,'portraitMaxSize':list(LIMIT),'rgbBits':[6,6,6],
            'alphaBits':8,'format':'RGBA PNG; mild RGB rounding, lossless PNG encoding afterwards',
            'portraitCount':len(records),'portraitBytes':sum(x['bytes'] for x in records),
            'maxDecodedPortraitBytes':max(x['size'][0]*x['size'][1]*4 for x in records),
            'minPsnrDb':min(x['psnrDb'] for x in records),'maxRgbError':max(x['maxRgbError'] for x in records),
            'minimumColors':min(x['colors'] for x in records),'images':records}
    (PROJECT/'portrait-compression-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    quality=json.loads((PROJECT/'portrait-quality-report.json').read_text(encoding='utf8'));by={x['file']:x for x in records}
    for r in quality['images']:
        n=by[r['file']];r.update(size=n['size'],bytes=n['bytes'],colors=n['colors'])
    quality.update(version='0.1.3',maxSize=list(LIMIT),format=report['format'],colorQuantization='RGB 6 bits/channel; alpha 8 bits',
        totalBytes=report['portraitBytes'],maxDecodedBytes=report['maxDecodedPortraitBytes'],minColors=report['minimumColors'])
    (PROJECT/'portrait-quality-report.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    asset=json.loads((PROJECT/'asset-report.json').read_text(encoding='utf8'));asset.update(portraitMaxSize=list(LIMIT),portraitFormat=report['format'],finalAssetBytes=sum(p.stat().st_size for p in dest.iterdir()))
    (PROJECT/'asset-report.json').write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
if __name__=='__main__':main()
