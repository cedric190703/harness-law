#!/usr/bin/env python3
"""Build demo/index.html: the site template with the checked demo matter inlined.

usage: python3 build.py   (run matter/make_log.py and tools/check_log.py first)
"""
import json
from pathlib import Path

here = Path(__file__).parent
# every checked matter that exists, the team's data room first
paths = [here / d / "verification-log.checked.json" for d in ("matter-vdr", "matter")]
matter = [json.loads(p.read_text("utf-8")) for p in paths if p.exists()]
# "<" is escaped so no quote from a document can close the script tag
data = json.dumps(matter, ensure_ascii=False).replace("<", "\\u003c")
page = (here / "site.template.html").read_text("utf-8").replace("__DEMO_JSON__", data)
(here / "index.html").write_text(page, "utf-8")
print("index.html written,", len(page) // 1024, "KB")
