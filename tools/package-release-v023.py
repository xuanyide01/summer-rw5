"""Create the 0.2.3 local delivery; every archive/package stays below 25 MB."""
from pathlib import Path
import hashlib,json,os,shutil,sys,zipfile
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
version=json.loads((ROOT/'src/manifest.json').read_text('utf8'))['versionName'];assert version=='0.2.3'
package=ROOT/f'dist/com.codex.summer.rw5.debug.{version}.rpk';expected='1525c2ffcaa83bdc37da18a18d63bfa198a724ae4b4f34ce11b528ebad2c5198'
assert hashlib.sha256(package.read_bytes()).hexdigest()==expected and package.stat().st_size<25000000
for suffix in ['bin','rpk']:shutil.copy2(package,OUT/f'summer-rw5-v{version}.{suffix}')
shutil.copy2(ROOT/'docs/v0.2.3.md',OUT/'README.md');shutil.copy2(ROOT/'docs/images/title-v023.png',OUT/'title-v023.png')
wanted=[];pruned={'node_modules','__pycache__','.git','sign','.emulator','build','dist'}
for dirname in ['src','tools','tests','converted-story','docs','reports','licenses']:
 for folder,dirs,files in os.walk(ROOT/dirname):
  dirs[:]=[d for d in dirs if d not in pruned]
  for name in files:
   p=Path(folder)/name
   if p.suffix.lower() in ['.pyc','.log','.db','.pem','.key','.pfx','.p12','.rpk','.bin']:continue
   wanted.append(p)
for p in ROOT.iterdir():
 if p.is_file() and p.name!='WORK_PROGRESS.md' and (p.suffix.lower() in ['.md','.json','.py','.cjs'] or p.name in ['LICENSE','.gitignore','.gitattributes']):wanted.append(p)
assert len(set(wanted))==len(wanted)
def resource(p):return p.relative_to(ROOT).as_posix().startswith('src/common/') and p.suffix.lower() in ['.png','.jpg','.jpeg','.wav','.mp3','.otf','.ttf','.txt']
archives=[]
for label,select in [('source',lambda p:not resource(p)),('resources',resource)]:
 target=OUT/f'summer-rw5-v{version}-{label}.zip';selected=[p for p in wanted if select(p)]
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p in sorted(selected):z.write(p,'summer-rw5/'+p.relative_to(ROOT).as_posix())
 assert target.stat().st_size<25000000,(target,target.stat().st_size)
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  for p in selected:assert z.read('summer-rw5/'+p.relative_to(ROOT).as_posix())==p.read_bytes()
 archives.append({'file':target.name,'bytes':target.stat().st_size,'files':len(selected),'crcAndSourceBytesVerified':True})
for name in ['payload-v023.json','native-installed-v023.json','native-audio-soak-v023.json','native-audio-release-v023.json','native-features-v023.json','resource-dedup-v023.json','install-packaging-v023.json','font-horizontal-v023.json','title-audio-v023.json']:
 shutil.copy2(ROOT/'reports'/name,OUT/name)
manifest={'version':version,'packageBytes':package.stat().st_size,'packageSha256':expected,'allDeliveryArchivesBelow25MB':True,'sourceAndResourcesExtractIntoSameDirectory':True,'archives':archives,'physicalDeviceTested':False,'githubPublished':False}
(OUT/'delivery.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
rows=[]
for p in sorted(OUT.iterdir()):
 if p.is_file() and p.name!='SHA256SUMS.txt':rows.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
(OUT/'SHA256SUMS.txt').write_text('\n'.join(rows)+'\n',encoding='utf8');print(json.dumps(manifest,ensure_ascii=True))
