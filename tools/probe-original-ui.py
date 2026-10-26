"""Read original PAK indexes and make a diagnostic contact sheet of title assets."""
import json, os, sys, struct
from pathlib import Path
from PIL import Image, ImageDraw
from luca_format import ROOT as GAME, pak_index
from cz_images import decode

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT.parent/'summer-original-ui-probe'
OUT.mkdir(exist_ok=True)
indexes = {}
for archive in ['SYSCG.PAK','SYSCG2.PAK','SYSCG3.PAK','OTHCG.PAK','OTHCGB.PAK','PARTS.PAK']:
    file = GAME/'files/image'/archive
    if not file.exists():
        continue
    entries = pak_index(file)
    indexes[archive] = entries
    print(json.dumps({'archive':archive,'count':len(entries),
                      'names':[e['name'] for e in entries if any(s in e['name'].upper() for s in ['TITLE','MENU','START','LOAD','CONFIG','LOGO','SYSTEM'])][:120]},ensure_ascii=False),flush=True)
music = pak_index(GAME/'files/music/MUSIC.PAK')
print(json.dumps({'musicCount':len(music),'musicIndex':music},ensure_ascii=False),flush=True)
(OUT/'indexes.json').write_text(json.dumps({'images':indexes,'music':music},ensure_ascii=False,indent=2),encoding='utf8')
tasks = [(archive,e) for archive,entries in indexes.items() for e in entries
         if any(s in e['name'].upper() for s in ['TITLE','LOGO'])]
if not tasks:
    tasks = [('SYSCG.PAK',e) for e in indexes['SYSCG.PAK'][:80]]
rows = []
for archive,e in tasks[:120]:
    with (GAME/'files/image'/archive).open('rb') as f:
        f.seek(e['offset']); raw=f.read(e['size'])
    try:
        image=decode(raw)
    except Exception as error:
        print('DECODE_ERROR',archive,e['name'],str(error),flush=True);continue
    target=OUT/(archive.replace('.PAK','')+'_'+e['name']+'.png')
    image.save(target)
    rows.append({'archive':archive,**e,'dimensions':list(image.size),'file':target.name})
for start in range(0,len(rows),24):
    batch=rows[start:start+24]; sheet=Image.new('RGB',(1200,240*((len(batch)+3)//4)), '#d8eaf2');draw=ImageDraw.Draw(sheet)
    for i,e in enumerate(batch):
        x,y=(i%4)*300,(i//4)*240
        with Image.open(OUT/e['file']) as im:
            im=im.convert('RGBA');im.thumbnail((290,200));sheet.paste(im,(x+5,y+5),im)
        draw.text((x+5,y+206),e['archive']+' / '+e['name'][:30],fill='black')
        draw.text((x+5,y+222),str(e['dimensions']),fill='black')
    sheet.save(OUT/('sheet-'+str(start//24)+'.png'))
(OUT/'title-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
