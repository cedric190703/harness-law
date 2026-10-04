"""Check generated page links and anchors without network dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate id: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "a" and "href" in attrs:
            self.links.append(attrs["href"])


pages = {name: Page(SITE / name) for name in ("index.html", "benchmarks.html")}
for name, page in pages.items():
    for href in page.links:
        url = urlsplit(href)
        if url.scheme or url.netloc:
            continue
        target = unquote(url.path) or name
        assert target in pages, f"{name}: missing local page {target}"
        if url.fragment:
            assert unquote(url.fragment) in pages[target].ids, f"{name}: missing anchor {href}"
print("Both pages: unique ids, local links and anchors valid")
