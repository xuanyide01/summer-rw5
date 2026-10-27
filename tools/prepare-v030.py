from pathlib import Path
import json,re,collections,hashlib
ROOT=Path(__file__).resolve().parents[1]
BASE=Path(__import__('sys').argv[1])
common=ROOT/'src/common';original=BASE/'src/common'
def loadjs(p,decl):return json.loads(re.search(decl+r'(.*);',p.read_text('utf8'))[1])
c=loadjs(original/'catalog.js',r'export const catalog=');paths=loadjs(original/'assets.js',r'const paths=')
stories={int(p.stem):json.loads(p.read_text('utf8')) for p in (BASE/'converted-story').glob('*.json')}
removed=set(range(290,318))|set(range(325,348))|set(range(390,406))
removed&=set(stories)
flow=stories[c['flowScene']]
# Keep VM addresses stable; only the removed personal branches become inert.
for i in list(range(457,524))+list(range(549,567)):
 if flow[i]['op']!='end':flow[i]={'op':'nop'}
for i,target in {235:236,237:238,271:272,278:280}.items():flow[i]={'op':'goto','target':target}
def thresholds(x):
 if not isinstance(x,list):return x
 result=[thresholds(v) for v in x]
 if len(result)==3 and result[0] in ['==','!=','>=','<=','>','<']:
  if result[1]==['v',24006] and result[2] in [6,7]:result[2]=5
  elif result[2]==['v',24006] and result[1] in [6,7]:result[1]=5
 return result
for sid,ops in stories.items():
 if sid in removed:stories[sid]=[{'op':'end'}];continue
 for op in ops:
  if 'value' in op:op['value']=thresholds(op['value'])
  if op['op'] in ['callScene','jumpScene']:assert op['scene'] not in removed,(sid,op)
# Metadata distinguishes genuine personal chapters from common map events.
personal_ids=set(x['scene'] for i,x in enumerate(flow) if x['op']=='callScene' and (290<=i<=405 or 524<=i<=548))
oldroutes=c['routes'];names={i:r['name'] for i,r in enumerate(oldroutes)}
for key,info in c['scenes'].items():
 sid=int(key);info['routeName']=names.get(info.get('route'),'');info['phase']='personal' if sid in personal_ids else 'common'
 if info.get('route') in [9,10,11]:info['phase']='final'
 info['removed']=sid in removed;info['length']=len(stories[sid])
 m=re.search(r'(\d{2})(\d{2})(?:AM|PM|[a-z]?)$',info['source'])
 info['date']=(str(int(m[1]))+'月'+str(int(m[2]))+'日') if m and 1<=int(m[1])<=12 and 1<=int(m[2])<=31 else ''
 if info.get('next') in removed:info['next']=0
# Retain other characters' common events, but remove their personal route browsers.
other_common=[];routes=[]
for i,r in enumerate(oldroutes):
 kept=[sid for sid in r['scenes'] if sid not in removed]
 if i in [5,6,8]:other_common.extend(kept);continue
 routes.append({'name':r['name'],'scenes':kept})
routes.append({'name':'共通事件','scenes':other_common});c['routes']=routes
for idx,r in enumerate(routes):
 for sid in r['scenes']:c['scenes'][str(sid)]['route']=idx
c['chapters']=[dict(c['scenes'][str(x['id'])]) for x in c['chapters'] if x['id'] not in removed]
c['edition']='five-heroines-plus-finals';c['personalHeroineNames']=[names[i] for i in [1,2,4,3,7]]
date='7月25日';c['flowDates']={};c['flowLabels']={}
for i,op in enumerate(flow):
 if op['op']=='callScene':
  info=c['scenes'][str(op['scene'])]
  if info.get('date'):date=info['date']
  if info.get('phase')!='common':c['flowLabels'][str(i+1)]=info['routeName']
 if op['op'] in ['call','callScene']:c['flowDates'][str(i+1)]=date
c['chapters']=[{k:x[k] for k in ['id','name','route','next','source']} for x in c['chapters']]
for x in c['scenes'].values():
 if not x.get('removed'):x.pop('removed',None)
 if not x.get('date'):x.pop('date',None)
 if x.get('phase')=='common':x.pop('phase',None);x.pop('routeName',None)
(common/'catalog.js').write_text('export const catalog='+json.dumps(c,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
for sid,ops in stories.items():
 (ROOT/f'converted-story/{sid}.json').write_text(json.dumps(ops,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 folder=common/'story'/str(sid);folder.mkdir(exist_ok=True)
 for p in folder.glob('*.txt'):
  assert p.resolve().is_relative_to((common/'story').resolve());p.unlink()
 for offset in range(0,max(1,len(ops)),1024):(folder/f'{offset//1024}.txt').write_text(json.dumps(ops[offset:offset+1024],ensure_ascii=False,separators=(',',':')),encoding='utf8')
used=collections.Counter(op['image'] for sid,ops in stories.items() if sid not in removed for op in ops if op['op']=='image')
gallery=json.loads((original/'gallery.txt').read_text('utf8'))
def family(e):
 m=re.match(r'^(?:cg|ef)_([a-z]+\d+)_',e['source'],re.I)
 return m[1].lower() if m else e['source'].lower()
# A retained scene's CG family keeps all its existing differences.
active_families={family(e) for e in gallery if e['image'] in used}
kept_gallery=[e for e in gallery if family(e) in active_families or not re.match(r'^(?:cg|ef)_(?:mk|sz|um)',e['source'],re.I)]
(common/'gallery.txt').write_text(json.dumps(kept_gallery,ensure_ascii=False,separators=(',',':')),encoding='utf8')
keep_ids=set(used)|{e['image'] for e in kept_gallery}|{'bg_black'}
paths={k:v for k,v in paths.items() if k in keep_ids}
files=set(paths.values());removed_files=[]
for p in (common/'images').iterdir():
 if p.name not in files:
  assert p.resolve().is_relative_to((common/'images').resolve());removed_files.append({'file':p.name,'bytes':p.stat().st_size});p.unlink()
(common/'assets.js').write_text('const paths='+json.dumps(paths,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf8')
quality=json.loads((BASE/'portrait-quality-report.json').read_text('utf8'));quality['images']=[x for x in quality['images'] if x['file'] in files];quality['retainedPoseGroups']=len(quality['images']);quality['totalBytes']=sum((common/'images'/n).stat().st_size for n in set(x['file'] for x in quality['images']));(ROOT/'portrait-quality-report.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2),encoding='utf8')
report={'version':'0.3.0','removedPersonalScenes':sorted(removed),'keptOtherCharactersCommonScenes':other_common,'mainHeroines':c['personalHeroineNames'],'alkaPocketRetained':True,'restartThresholds':[4,5],'alkaAfterMainClears':5,'sceneIdsAndRetainedOperationAddressesPreserved':True,'chapters':len(c['chapters']),'storyText':sum(op['op']=='text' for ops in stories.values() for op in ops),'choices':sum(op['op']=='choice' for ops in stories.values() for op in ops),'galleryBefore':len(gallery),'galleryAfter':len(kept_gallery),'removedImages':removed_files,'removedImageBytes':sum(x['bytes'] for x in removed_files),'usedImageFrequency':used}
(ROOT/'reports/content-v030.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k not in ['removedImages','usedImageFrequency']},ensure_ascii=True))
