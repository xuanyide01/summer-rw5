"""Rebuild Shiroha from the original title illustration, preserving source RGB.

The original title illustration and its clean background share the same camera.
Copy only Shiroha's connected foreground component onto that background, then
crop the resulting original scene to the watch. Never use a dialogue portrait.
"""
from pathlib import Path
import hashlib,json,os,sys
from PIL import Image
from collections import deque
import numpy as np
from luca_format import ROOT as GAME,pak_index
from cz_images import decode
ROOT=Path(__file__).resolve().parents[1]
def original(name):
    file=GAME/'files/image/OTHCG.PAK';e=next(e for e in pak_index(file) if e['name']==name)
    with file.open('rb') as f:f.seek(e['offset']);raw=f.read(e['size'])
    return decode(raw).convert('RGB'),{'archive':'OTHCG.PAK','name':name,'id':e['id'],'rawSha256':hashlib.sha256(raw).hexdigest()}
scene,sceneInfo=original('__SYS_TM_BGRB01B')
# The RGB behind this effect layer's alpha is the clean original title backdrop.
background,bgInfo=original('__SYS_TM_BGRB04e')
assert scene.size==background.size==(1920,1920)
g,b=np.asarray(scene),np.asarray(background)
delta=np.max(np.abs(g.astype('int16')-b.astype('int16')),axis=2)
candidate=delta>2;mask=np.zeros(candidate.shape,dtype=bool)
assert candidate[1400,900],'Expected original Shiroha foreground at the seed'
queue=deque([(900,1400)]);mask[1400,900]=True
while queue:
    px,py=queue.popleft()
    for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
        if 0<=nx<1920 and 0<=ny<1920 and candidate[ny,nx] and not mask[ny,nx]:
            mask[ny,nx]=True;queue.append((nx,ny))
y,x=np.where(mask);box=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
assert box==[815,1287,1091,1845],box
# Include the two-pixel original antialias fringe; no foreground colors invented.
for _ in range(2):
    pad=np.pad(mask,1);mask=pad[1:-1,1:-1]|pad[:-2,1:-1]|pad[2:,1:-1]|pad[1:-1,:-2]|pad[1:-1,2:]
mask &= delta>0
rgb=b.copy();rgb[mask]=g[mask]
crop=(475.0,1120.0,475+760*432/514,1880.0)
title=Image.fromarray(rgb).resize((432,514),Image.Resampling.LANCZOS,box=crop)
file=ROOT/'src/common/ui/title.png';title.save(file,optimize=True)
before=file.stat().st_size
if os.environ.get('WATCH_COMPRESSION_DEPS'):sys.path.insert(0,os.environ['WATCH_COMPRESSION_DEPS'])
try:
    import io,zopfli.png
    raw=file.read_bytes();new=zopfli.png.optimize(raw,lossy_transparent=False,lossy_8bit=False,num_iterations=2,num_iterations_large=2,filter_strategies='0mepb')
    if len(new)<len(raw) and new[24:26]==raw[24:26]:
        assert Image.open(io.BytesIO(new)).convert('RGB').tobytes()==title.tobytes();file.write_bytes(new)
except ImportError:pass
report={'version':'0.2.4','titleScene':sceneInfo,'cleanBackgroundRgb':bgInfo,'originalTitleShirohaBounds':box,'usesOriginalTitleShiroha':True,'usesDialoguePortrait':False,'foregroundPixelsCopiedFromOriginal':True,'watchCameraCrop':crop,'size':[432,514],'logoRect':[16,8,320,92],'buttonRowHeight':42,'buttonInkLeft':42,'footerRemoved':True,'titlePngBytes':file.stat().st_size,'pngBytesBeforeLosslessRecompression':before,'titlePngSha256':hashlib.sha256(file.read_bytes()).hexdigest()}
(ROOT/'reports/title-ui-v024.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report),flush=True)
