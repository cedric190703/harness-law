"""Assemble les pages autonomes du site : python3 site/build.py.

template.html → index.html (la landing), benchmarks.template.html → benchmarks.html.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRAND = HERE.parent / 'brand'
CSS = re.sub(r'@import url\([^)]*\);\n', '', (BRAND / 'saul.css').read_text(encoding='utf-8'))


def svg(name):
    content = (BRAND / 'saul' / f'{name}.svg').read_text(encoding='utf-8')
    content = re.sub(r' width="\d+" height="\d+"', '', content, count=1)
    return re.sub(r' aria-label="[^"]*"', ' aria-hidden="true" focusable="false"', content, count=1)


def dots(match):
    """{{dots N K}} : N carrés, dont les K premiers verts (affirmations marquées vertes)."""
    total, green = int(match.group(1)), int(match.group(2))
    assert 0 <= green <= total
    cells = ''.join(f'<i class="g" style="--k:{i}"></i>' if i < green else '<i></i>' for i in range(total))
    return f'<span class="dots" aria-hidden="true">{cells}</span>'


def build(source, target, extra=None):
    page = (HERE / source).read_text(encoding='utf-8').replace('{{SAUL_CSS}}', CSS)
    if extra:
        page = extra(page)
    page = re.sub(r'\{\{dots (\d+) (\d+)\}\}', dots, page)
    for path in sorted((BRAND / 'saul').glob('*.svg')):
        page = page.replace('{{' + path.stem + '}}', svg(path.stem))
    assert not re.findall(r'\{\{[^}]+\}\}', page), f'Unresolved template placeholders in {source}'
    (HERE / target).write_text(page, encoding='utf-8')
    print(f'site/{target} — {len(page.encode()) // 1024} Ko')


def hero(page):
    art = svg('saul-repos')
    # Only the knot and blade receive the live verdict color; the brand file stays intact.
    for path_start in ('M113 150', 'M116 160'):
        art, count = re.subn(r'(<path d="' + path_start + r'[^"]*" fill=")[^"]+(\")', r'\g<1>var(--saul-tie, #7A808A)\2', art)
        assert count == 1, f'Tie path missing: {path_start}'
    return page.replace('{{hero-saul}}', art)


build('template.html', 'index.html', hero)
build('benchmarks.template.html', 'benchmarks.html')
