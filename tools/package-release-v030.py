"""Package the tested 0.3.0 delivery; BIN/RPK and both manual ZIPs remain below 25 MB."""
from pathlib import Path
import hashlib,json,os,shutil,sys,zipfile
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'outputs/夏日口袋-v0.3.0';OUT.mkdir(parents=True,exist_ok=True)
VERSION='0.3.0';SHA='964e1db4693560fa5fefdb5a1a162bb8f344fd7d0003edd05d58249eba325916';package=ROOT/f'dist/com.codex.summer.rw5.debug.{VERSION}.rpk'
assert package.stat().st_size<25000000 and hashlib.sha256(package.read_bytes()).hexdigest()==SHA
for suffix in ['bin','rpk']:shutil.copy2(package,OUT/f'summer-rw5-v{VERSION}.{suffix}')
doc=(ROOT/'docs/v0.3.0.md').read_text('utf8').replace('(images/','(');(OUT/'README.md').write_text(doc,encoding='utf8')
for name in ['common-date-v030.png','common-shiki-v030.png','personal-v030.png','expression-v030.png','expressions-v030.jpg']:shutil.copy2(ROOT/'docs/images'/name,OUT/name)
for name in ['payload-v030.json','native-v030.json','native-install-v030.json','content-v030.json','expressions-v030.json','expressions-lossless-v030.json','install-packaging-v030.json','tests-v030.txt','hardware-test-v030.json']:shutil.copy2(ROOT/'reports'/name,OUT/name)
wanted=[];pruned={'node_modules','__pycache__','.git','sign','.emulator','build','dist'}
for dirname in ['src','tools','tests','converted-story','docs','reports','licenses','native-test-results']:
 for folder,dirs,files in os.walk(ROOT/dirname):
  dirs[:]=[d for d in dirs if d not in pruned]
  for name in files:
   p=Path(folder)/name
   if p.suffix.lower() in ['.pyc','.log','.db','.pem','.key','.pfx','.p12','.rpk','.bin'] or name in ['tests-v030-initial.txt','original-resource-location.json']:continue
   wanted.append(p)
for p in ROOT.iterdir():
 if p.is_file() and p.name!='WORK_PROGRESS.md' and (p.suffix.lower() in ['.md','.json','.py','.cjs','.js'] or p.name in ['LICENSE','.gitignore','.gitattributes','requirements.txt']):wanted.append(p)
assert len(set(wanted))==len(wanted)
def resource(p):return p.relative_to(ROOT).as_posix().startswith('src/common/') and p.suffix.lower() in ['.png','.jpg','.jpeg','.wav','.mp3','.otf','.ttf','.txt']
archives=[]
for label,select in [('source',lambda p:not resource(p)),('resources',resource)]:
 target=OUT/f'summer-rw5-v{VERSION}-{label}.zip';selected=[p for p in wanted if select(p)]
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p in sorted(selected):z.write(p,'summer-rw5/'+p.relative_to(ROOT).as_posix())
 assert target.stat().st_size<25000000,(target,target.stat().st_size)
 with zipfile.ZipFile(target) as z:
  assert z.testzip() is None
  for p in selected:assert z.read('summer-rw5/'+p.relative_to(ROOT).as_posix())==p.read_bytes()
 archives.append({'file':target.name,'bytes':target.stat().st_size,'files':len(selected),'crcAndSourceBytesVerified':True})
manifest={'version':VERSION,'packageBytes':package.stat().st_size,'packageSha256':SHA,'allDeliveryArchivesBelow25MB':True,'sourceAndResourcesExtractIntoSameDirectory':True,'archives':archives,'physicalDeviceTested':True,'hardwareRuntimeNoIssuesReported':True,'installationSucceededAfterFactoryReset':True,'initialInstallationIssueUnresolved':True,'hardwareFeedbackDate':'2026-10-27','githubReleaseUrl':'https://github.com/xuanyide01/summer-rw5/releases/tag/v0.3.0','automatedTestsPassed':52,'completeNativeFreshInstallPassed':True,'nativeOverwriteResult':-19,'addedExpressions':40,'retainedGalleryItems':712,'retainedGalleryGroups':136}
(OUT/'delivery.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
shutil.copy2(ROOT/'docs/release-v0.3.0.md',OUT/'release-notes.md')
rows=[]
for p in sorted(OUT.iterdir()):
 if p.is_file() and p.name!='SHA256SUMS.txt':
  assert p.stat().st_size<25000000;rows.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
(OUT/'SHA256SUMS.txt').write_text('\n'.join(rows)+'\n',encoding='utf8');print(json.dumps(manifest,ensure_ascii=True))
