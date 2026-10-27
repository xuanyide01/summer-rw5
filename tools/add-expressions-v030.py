from pathlib import Path
import os,sys,json,re,collections,hashlib,importlib.util
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1];GAME=Path(os.environ.get('SUMMER_GAME_ROOT','G:/SteamLibrary/steamapps/common/Summer Pockets REFLECTION BLUE'))
os.environ['SUMMER_GAME_ROOT']=str(GAME)
from cz_images import decode
from luca_format import pak_index
spec=importlib.util.spec_from_file_location('compress_portraits',Path(__file__).with_name('compress-portraits.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
COMMON=ROOT/'src/common';PAK=GAME/'files/image/CHARCG.PAK';headers=json.loads((ROOT/'portrait-source-headers.json').read_text('utf8'));byname={x['name'].upper():x for x in headers};byid={x['id']:x for x in headers};entries={x['name'].upper():x for x in pak_index(PAK)}
assert all(e['name'].upper() in entries and entries[e['name'].upper()]['id']==e['id'] for e in headers)
paths=json.loads(re.search(r'const paths=(.*);',(COMMON/'assets.js').read_text('utf8'))[1]);quality=json.loads((ROOT/'portrait-quality-report.json').read_text('utf8'));records={x['family']:x for x in quality['images']}
frequency=json.loads((ROOT/'reports/content-v030.json').read_text('utf8'))['usedImageFrequency']
def family(name):return re.sub(r'^(?:F_)?BS[123]_','',name,flags=re.I)[:-2].upper()
counts=collections.defaultdict(collections.Counter)
for id,n in frequency.items():
 e=byid.get(int(id[1:])) if id.startswith('i') else None
 if e and re.match(r'^(?:F_)?BS[123]_(AO|KM|SK|SR|TM)',e['name']):counts[family(e['name'])][e['name'][-2:]]+=n
families=[]
for heroine in ['SR','AO','TM','KM','SK']:
 eligible=[f for f in counts if f.startswith(heroine) and f in records and sum((('BS3_'+f+s) in byname) for s in counts[f] if s!='01')>=4]
 eligible.sort(key=lambda f:(-sum(counts[f].values()),f));families.extend(eligible[:2])

def load(name):
 e=entries[name.upper()]
 with PAK.open('rb') as f:f.seek(e['offset']);return decode(f.read(e['size'])).convert('RGBA')
results=[]
for fam in families:
 record=records[fam];baseName=record['source'].upper();base=load(baseName);bh=byname[baseName]
 canvas=Image.new('RGBA',(bh['cw'],bh['ch']));canvas.paste(base,(bh['x'],bh['y']))
 box=record['crop'];crop=(bh['x']+box[0],bh['y']+box[1],bh['x']+box[2],bh['y']+box[3]);reference=Image.open(COMMON/'images'/record['file']).convert('RGBA');assert list(reference.size)==record['size']
 variants=sorted([s for s in counts[fam] if s!='01' and ('BS3_'+fam+s) in byname],key=lambda s:(-counts[fam][s],s));seen={hashlib.sha256(reference.tobytes()).hexdigest()};added=0
 for suffix in variants:
  name='BS3_'+fam+suffix;h=byname[name];assert (h['cw'],h['ch'])==(bh['cw'],bh['ch'])
  image=canvas.copy();image.alpha_composite(load(name),(h['x'],h['y']));image=mod.quantize_rgb(image.crop(crop).resize(reference.size,Image.Resampling.LANCZOS))
  key=hashlib.sha256(image.tobytes()).hexdigest();changed=int(np.any(np.array(image)!=np.array(reference),axis=2).sum())
  if key in seen or changed<5:continue
  seen.add(key);filename='portrait_'+fam.lower()+'_e'+suffix+'.png';dest=COMMON/'images'/filename;image.save(dest,optimize=True,compress_level=9)
  mapped=[]
  for e in headers:
   id='i'+str(e['id'])
   if id in paths and family(e['name'])==fam and e['name'][-2:]==suffix:paths[id]=filename;mapped.append(e['id'])
  assert mapped
  results.append({'family':fam,'heroine':fam[:2],'expression':suffix,'baseSource':baseName,'baseSourceId':bh['id'],'patchSource':name,'patchSourceId':h['id'],'patchPosition':[h['x'],h['y']],'originalCanvas':[bh['cw'],bh['ch']],'baseCrop':list(crop),'file':filename,'baseFile':record['file'],'size':list(image.size),'bytes':dest.stat().st_size,'changedPixels':changed,'mappedIds':mapped,'scriptImageUses':counts[fam][suffix]})
  added+=1
  if added==4:break
 print(json.dumps({'family':fam,'added':added,'total':len(results)},ensure_ascii=True),flush=True)
(COMMON/'assets.js').write_text('const paths='+json.dumps(paths,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf8')
report={'version':'0.3.0','originalArchive':'CHARCG.PAK','entriesAndIdsVerified':len(entries),'method':'Original same-camera suffix-01 complete base, alpha composite exact expression patch at original canvas coordinates, same crop and 200x256 limit as the existing base; RGB rounding retained; one complete image loaded per character.','addedExpressions':len(results),'families':len(families),'heroineCounts':dict(collections.Counter(x['heroine'] for x in results)),'addedBytes':sum(x['bytes'] for x in results),'maxDecodedBytes':max(x['size'][0]*x['size'][1]*4 for x in results),'records':results}
(ROOT/'reports/expressions-v030.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=True),flush=True)
# Comparison uses actual exported images; no separate mock art.
thumbs=[]
for fam in families:
 row=[(fam+' BASE',records[fam]['file'])]+[(x['expression'],x['file']) for x in results if x['family']==fam]
 for col,(label,file) in enumerate(row):
  from PIL import ImageDraw
  tile=Image.new('RGB',(180,280),(31,43,56));im=Image.open(COMMON/'images'/file).convert('RGBA');im.thumbnail((170,250));tile.paste(im,((180-im.width)//2,25),im);ImageDraw.Draw(tile).text((5,5),label,fill='white');thumbs.append((families.index(fam),col,tile))
sheet=Image.new('RGB',(900,280*len(families)),(31,43,56))
for row,col,tile in thumbs:sheet.paste(tile,(180*col,280*row))
(ROOT/'docs/images').mkdir(exist_ok=True);sheet.save(ROOT/'docs/images/expressions-v030.jpg',quality=92)
