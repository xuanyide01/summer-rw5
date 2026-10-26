"""Crop the user-provided harbor screenshot without altering other game assets."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('source',type=Path);a=p.parse_args()
im=Image.open(a.source).convert('RGB');assert im.size==(2551,1587),'Review crop for different source dimensions'
box=(1235.0,80.0,1235.0+1440*432/514,1520.0)
im.resize((432,514),Image.Resampling.LANCZOS,box=box).save(ROOT/'src/common/ui/title.png',optimize=True,compress_level=9)
print(json.dumps({'sourceSha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'crop':box,'displaySize':[432,514]}))
