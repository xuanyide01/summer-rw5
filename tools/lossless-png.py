"""Recompress PNGs with exact RGBA, dimensions, bit depth and color type checks."""
import concurrent.futures, hashlib, io, json, os, sys, time
from pathlib import Path
from PIL import Image

if os.environ.get('WATCH_COMPRESSION_DEPS'):
    sys.path.insert(0, os.environ['WATCH_COMPRESSION_DEPS'])
import zopfli.png

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT.parent / 'summer-lossless-cache'
BACKUP, OUTPUT = CACHE / 'before', CACHE / 'after'
SHA = lambda b: hashlib.sha256(b).hexdigest()


def optimize(file):
    relative = file.relative_to(ROOT / 'src/common')
    before, after = BACKUP / relative, OUTPUT / relative
    before.parent.mkdir(parents=True, exist_ok=True)
    after.parent.mkdir(parents=True, exist_ok=True)
    current = file.read_bytes()
    if not before.exists():
        before.write_bytes(current)
    old = before.read_bytes()
    if after.exists():
        new = after.read_bytes()
    else:
        new = zopfli.png.optimize(old, lossy_transparent=False, lossy_8bit=False,
                                 num_iterations=1, num_iterations_large=1,
                                 filter_strategies='0mepb')
        if len(new) >= len(old) or new[24:26] != old[24:26]:
            new = old
        after.write_bytes(new)
    assert current in (old, new), 'Source changed outside this optimizer: ' + str(relative)
    a, b = Image.open(io.BytesIO(old)).convert('RGBA'), Image.open(io.BytesIO(new)).convert('RGBA')
    assert a.size == b.size and a.tobytes() == b.tobytes() and old[24:26] == new[24:26]
    file.write_bytes(new)
    return {'file': relative.as_posix(), 'beforeBytes': len(old), 'afterBytes': len(new),
            'beforeSha256': SHA(old), 'afterSha256': SHA(new), 'pixelsIdentical': True,
            'size': list(a.size), 'pngBitDepth': old[24], 'pngColorType': old[25]}


def main():
    files = list((ROOT / 'src/common').rglob('*.png'))
    rows, start = [], time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for future in concurrent.futures.as_completed([pool.submit(optimize, p) for p in files]):
            rows.append(future.result())
            if len(rows) % 20 == 0:
                print(json.dumps({'done': len(rows), 'total': len(files),
                                  'savedBytes': sum(x['beforeBytes']-x['afterBytes'] for x in rows),
                                  'seconds': round(time.monotonic()-start)}), flush=True)
    report = {'files': len(rows), 'beforeBytes': sum(x['beforeBytes'] for x in rows),
              'afterBytes': sum(x['afterBytes'] for x in rows),
              'savedBytes': sum(x['beforeBytes']-x['afterBytes'] for x in rows),
              'allDecodedRGBASamplesIdentical': True, 'dimensionsBitDepthAndColorTypeUnchanged': True,
              'rows': sorted(rows, key=lambda r:r['file'])}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/lossless-png-v021.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'}), flush=True)


if __name__ == '__main__':
    main()
