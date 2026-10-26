"""Rebuild the original title layers; buttons use the bundled baked A artwork.

Set SUMMER_GAME_ROOT to the directory containing the original files/image PAKs.
Requires the existing luca_format/cz_images decoders, Pillow and NumPy.
This only changes common/ui/title.png, never story images or save data.
"""
import hashlib,json
from pathlib import Path
from PIL import Image
from luca_format import ROOT as GAME,pak_index
from cz_images import decode
ROOT=Path(__file__).resolve().parents[1]
def original(archive,name):
    file=GAME/'files/image'/archive;entry=next(e for e in pak_index(file) if e['name']==name)
    with file.open('rb') as f:f.seek(entry['offset']);raw=f.read(entry['size'])
    return decode(raw),{'archive':archive,'name':name,'id':entry['id'],'sourceSha256':hashlib.sha256(raw).hexdigest()}
bg,bgSource=original('OTHCG.PAK','__SYS_TM_BG01A')
sprite,spriteSource=original('CHARCG.PAK','BS2_SR01121101')
assert bg.size==(1920,1920)
span=1920*432/514;box=((1920-span)/2,0,(1920+span)/2,1920)
canvas=bg.resize((432,514),Image.Resampling.LANCZOS,box=box).convert('RGBA')
sprite=sprite.crop(sprite.getbbox());sprite=sprite.resize((round(sprite.width*500/sprite.height),500),Image.Resampling.LANCZOS)
canvas.alpha_composite(sprite,(176,78));target=ROOT/'src/common/ui/title.png';canvas.convert('RGB').save(target,optimize=True)
(ROOT/'reports/title-original-layers-v023.json').write_text(json.dumps({'background':bgSource,'portrait':spriteSource,'backgroundCrop':box,'spriteHeight':500,'spritePosition':[176,78],'size':[432,514],'buttonColor':'A','buttonInkLeft':42,'runtimeMenuLeft':26,'allOriginalRouteGatesUnchanged':True},indent=2)+'\n',encoding='utf8')
print(target)
