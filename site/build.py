"""Assemble la landing autonome : python3 site/build.py."""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRAND = HERE.parent / 'brand'
page = (HERE / 'template.html').read_text(encoding='utf-8')
css = re.sub(r'@import url\([^)]*\);\n', '', (BRAND / 'saul.css').read_text(encoding='utf-8'))
page = page.replace('{{SAUL_CSS}}', css)

def svg(name):
    content = (BRAND / 'saul' / f'{name}.svg').read_text(encoding='utf-8')
    content = re.sub(r' width="\d+" height="\d+"', '', content, count=1)
    return re.sub(r' aria-label="[^"]*"', ' aria-hidden="true" focusable="false"', content, count=1)

hero = svg('saul-repos')
# Only the knot and blade receive the live verdict color; the brand file stays intact.
for path_start in ('M113 150', 'M116 160'):
    hero, count = re.subn(r'(<path d="' + path_start + r'[^"]*" fill=")[^"]+(\")', r'\g<1>var(--saul-tie, #7A808A)\2', hero)
    assert count == 1, f'Tie path missing: {path_start}'
page = page.replace('{{hero-saul}}', hero)
for path in sorted((BRAND / 'saul').glob('*.svg')):
    page = page.replace('{{' + path.stem + '}}', svg(path.stem))
assert not re.findall(r'\{\{[^}]+\}\}', page), 'Unresolved template placeholders'
(HERE / 'index.html').write_text(page, encoding='utf-8')
print(f'site/index.html — {len(page.encode()) // 1024} Ko')
