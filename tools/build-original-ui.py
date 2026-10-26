"""Slice the original title atlas; fit the supplied OST illustration for the watch."""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'src/common/ui'
OUT.mkdir(exist_ok=True)
PROBE=ROOT.parent/'summer-original-ui-probe'
atlas=Image.open(PROBE/'SYSCG_TITLE_MENU01B.png').convert('RGBA')
logo=PROBE/'OTHCG___SYS_RBLOGO02a.png'
if not logo.exists():
    logo=PROBE/'__SYS_RBLOGO02a.png'
Image.open(logo).convert('RGBA').resize((376,108),Image.Resampling.LANCZOS).save(OUT/'logo.png',optimize=True,compress_level=9)
# Bounds of the original 1920x456 atlas, including the original letter spacing.
cuts={'start':(250,18,402,62),'load':(550,18,682,62),
      'options':(829,18,1044,62),'manual':(1191,18,1403,62),
      'exit':(1551,18,1671,62),'alka':(259,94,390,138),
      'pocket':(256,170,396,214),'gallery':(504,322,717,366),
      'restart':(334,398,538,442)}
rows=[]
for name,box in cuts.items():
    im=atlas.crop(box)
    # Exact source pixels, encoded as RGBA PNG. Runtime sizes retain the ratio.
    im.save(OUT/(name+'.png'),optimize=True,compress_level=9)
    rows.append({'button':name,'source':'SYSCG.PAK/TITLE_MENU01B','sourceRect':list(box),
                 'size':list(im.size),'pixelsFromOriginalAtlas':True})
image=Path(sys.argv[1])
original=Image.open(image).convert('RGB')
assert original.size==(1600,1600),'Review crop for a different source resolution'
# Exclude the album text; retain both faces and the joined hands.
crop=(80,320,1520,1600)
# A wider original crop keeps the two faces below the separate title area.
# The header uses only an unlettered sky patch from the same supplied picture.
background=Image.new('RGB',(432,514))
background.paste(original.crop((0,0,320,320)).resize((432,130),Image.Resampling.LANCZOS),(0,0))
background.paste(original.crop(crop).resize((432,384),Image.Resampling.LANCZOS),(0,130))
background.save(OUT/'title.png',optimize=True,compress_level=9)
report={'source':'user-provided Summer Pockets OST cover',
        'sourceSha256':hashlib.sha256(image.read_bytes()).hexdigest(),
        'sourceSize':list(original.size),'crop':list(crop),'artViewport':[0,130,432,384],'headerSourceCrop':[0,0,320,320],'displaySize':[432,514],
        'titleEncoding':'RGB PNG; no palette reduction','atlasSha256':hashlib.sha256((PROBE/'SYSCG_TITLE_MENU01B.png').read_bytes()).hexdigest(),
        'buttons':rows}
(ROOT/'reports/original-ui-v020.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'uiBytes':sum(p.stat().st_size for p in OUT.iterdir()),'buttons':len(rows),'crop':crop}))
