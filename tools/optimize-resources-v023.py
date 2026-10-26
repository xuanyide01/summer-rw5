"""Lossless portrait deduplication and removal of unused vertical font metadata.

Run after resource conversion, before building. Original game files are never
modified. All original logical image IDs, story positions and save keys survive.
"""
from pathlib import Path
import hashlib,json,re
from PIL import Image
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1];IMAGES=ROOT/'src/common/images';REPORTS=ROOT/'reports';REPORTS.mkdir(exist_ok=True)
groups={};aliases={};rows=[]
for p in sorted(IMAGES.glob('portrait*.png')):groups.setdefault(hashlib.sha256(p.read_bytes()).hexdigest(),[]).append(p)
for digest,files in groups.items():
    for p in files[1:]:
        keep=files[0];assert p.resolve().parent==IMAGES.resolve() and p.read_bytes()==keep.read_bytes()
        a,b=Image.open(p).convert('RGBA'),Image.open(keep).convert('RGBA');assert a.size==b.size and a.tobytes()==b.tobytes()
        aliases[p.name]=keep.name;rows.append({'removed':p.name,'retained':keep.name,'bytes':p.stat().st_size,'sha256':digest,'rgbaIdentical':True})
source=ROOT/'src/common/assets.js';text=source.read_text('utf8');originalKeys=set(json.loads(re.search(r'const paths=(.*);\n',text).group(1)))
for old,new in aliases.items():text=text.replace('"'+old+'"','"'+new+'"')
assert set(json.loads(re.search(r'const paths=(.*);\n',text).group(1)))==originalKeys
if aliases:source.write_text(text,encoding='utf8')
quality=ROOT/'portrait-quality-report.json';q=json.loads(quality.read_text('utf8'))
for r in q['images']:
    if r['file'] in aliases:r['originalFile']=r['file'];r['file']=aliases[r['file']]
if aliases:
    quality.write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    for r in rows:
        p=IMAGES/r['removed'];assert p.resolve().parent==IMAGES.resolve() and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'];p.unlink()
    (REPORTS/'resource-dedup-v023.json').write_text(json.dumps({'filesRemoved':len(rows),'bytesSaved':sum(r['bytes'] for r in rows),'logicalPortraits':len(q['images']),'uniquePortraitFiles':len(list(IMAGES.glob('portrait*.png'))),'allDecodedPixelsUnchanged':True,'allOriginalAssetIdsPreserved':True,'storyAndSaveSchemaUnchanged':True,'rows':rows},indent=2)+'\n',encoding='utf8')
fontFile=ROOT/'src/common/summer-name.otf';font=TTFont(fontFile);before=fontFile.stat().st_size
keep=['CFF ','hmtx','hhea','cmap','GPOS','GSUB'];hashes={tag:hashlib.sha256(font.reader[tag]).hexdigest() for tag in keep};removed=[]
for tag in ['BASE','VORG','vmtx','vhea']:
    if tag in font:removed.append({'table':tag,'bytes':len(font.reader[tag])});del font[tag]
if removed:
    font.recalcTimestamp=False;font.save(fontFile);after=TTFont(fontFile)
    for tag,digest in hashes.items():assert hashlib.sha256(after.reader[tag]).hexdigest()==digest,tag
    (REPORTS/'font-horizontal-v023.json').write_text(json.dumps({'beforeBytes':before,'afterBytes':fontFile.stat().st_size,'unusedVerticalTablesRemoved':removed,'glyphProgramsHorizontalMetricsUnicodeAndLayoutTablesByteIdentical':True,'tableSha256':hashes},indent=2)+'\n',encoding='utf8')
    p=ROOT/'name-font-report.json';r=json.loads(p.read_text('utf8'));r['fontBytesBeforeVerticalMetadataRemoval']=before;r['fontBytes']=fontFile.stat().st_size;r['horizontalGlyphsUnchanged']=True;p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'duplicateFilesRemovedThisRun':len(rows),'duplicateBytesSavedThisRun':sum(r['bytes'] for r in rows),'fontBytes':fontFile.stat().st_size}))
