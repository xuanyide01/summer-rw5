"""Rebuild the official Ao visual crop; do not modify story/audio/save resources."""
import argparse,hashlib,json,urllib.request
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'reports/original-ui-v021.json'
SOURCE_URL='https://summerpockets-anime.jp/wp_summer/wp-content/uploads/2025/07/20250709145630.jpg'
EXPECTED_SHA='57ae6eba68fa61d05a5d6a146edead3c7695b41ffa572ff685e9c26e91e25c86'
p=argparse.ArgumentParser();p.add_argument('--source',type=Path);p.add_argument('--atlas',type=Path,help='Optional original SYSCG TITLE_MENU01 PNG');a=p.parse_args()
source=a.source or ROOT.parent/'summer-title-research/ao-official-main.jpg'
if not source.exists():
 source.parent.mkdir(parents=True,exist_ok=True)
 with urllib.request.urlopen(SOURCE_URL,timeout=30) as response:source.write_bytes(response.read())
assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED_SHA,'Unexpected source artwork; review before changing crop'
im=Image.open(source).convert('RGB');assert im.size==(1414,2000)
im.crop((0,56,1414,1738)).resize((432,514),Image.Resampling.LANCZOS).save(ROOT/'src/common/ui/title.png',optimize=True,compress_level=9)
if a.atlas:
 atlas=Image.open(a.atlas).convert('RGBA')
 for button in json.loads((ROOT/'reports/original-ui-v020.json').read_text('utf8'))['buttons']:
  atlas.crop(tuple(button['sourceRect'])).save(ROOT/'src/common/ui'/(button['button']+'.png'),optimize=True,compress_level=9)
print('Rebuilt original Ao artwork crop; transparent title button glyphs retained.')
