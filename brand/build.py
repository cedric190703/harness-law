"""Assemble le guide de marque en une seule page : python3 brand/build.py

Insère saul.css et les dessins de Saul dans guide.template.html, écrit guide.html.
"""

import re
from pathlib import Path

ici = Path(__file__).parent
page = (ici / "guide.template.html").read_text()
css = (ici / "saul.css").read_text()
css = re.sub(r'@import url\([^)]*\);\n', "", css)  # la police est chargée par un <link>
page = page.replace("{{SAUL_CSS}}", css)
for svg in sorted((ici / "saul").glob("*.svg")):
    corps = re.sub(r' width="\d+" height="\d+"', "", svg.read_text(), count=1)
    page = page.replace("{{" + svg.stem + "}}", corps)
reste = re.findall(r"\{\{[^}]+\}\}", page)
assert not reste, reste
(ici / "guide.html").write_text(page)
print("guide.html", len(page) // 1024, "Ko")
