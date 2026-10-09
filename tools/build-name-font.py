"""Subset an OFL Noto Sans Mono CJK SC font for the name-bearing game text.

Usage: python tools/build-name-font.py path/to/NotoSansMonoCJKsc-Regular.otf
Requires fontTools. The font input is read only; generated assets stay in src.
"""
import json,re,sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root=Path(__file__).resolve().parents[1]
chars=set(chr(i) for i in range(32,127))
def visit(value):
    if isinstance(value,str) and re.search('[紬䌷]|Tsumugi',value):chars.update(value)
    elif isinstance(value,list):
        for item in value:visit(item)
    elif isinstance(value,dict):
        for item in value.values():visit(item)
for path in (root/'src/common').rglob('*.txt'):
    try:visit(json.loads(path.read_text(encoding='utf-8')))
    except ValueError:continue
catalog=(root/'src/common/catalog.js').read_text(encoding='utf-8')
chars.update(catalog)
chars.update((root/'src/pages/index/index.ux').read_text(encoding='utf-8'))
chars.update('紬文德斯0123456789存档旧版正在选择下一步章节开头…· /:')
options=subset.Options();options.name_IDs=['*'];options.name_languages=['*']
font=subset.load_font(sys.argv[1],options)
original_map=font.getBestCmap()
coverage={ord(c) for c in chars if ord(c) in original_map}
assert ord('紬') in coverage
subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=coverage);subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1,3,4,6,16):
        record.string='SummerNameSubset'.encode(record.getEncoding(),errors='replace')
if 'CFF ' in font:
    font['CFF '].cff.fontNames=['SummerNameSubset']
output=root/'src/common/summer-name.otf';subset.save_font(font,str(output),options)
loaded=TTFont(output);assert set(loaded.getBestCmap())==coverage
report={'font':'SummerNameSubset','sourceFamily':'Noto Sans Mono CJK SC','license':'SIL OFL 1.1','codepoints':sorted(coverage),'fontBytes':output.stat().st_size,'requestedChars':len(chars)}
(root/'name-font-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('NAME_FONT',len(coverage),output.stat().st_size)
