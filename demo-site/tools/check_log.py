#!/usr/bin/env python3
"""Independently re-check a verification log against the matter documents.

The agent's log says which passage supports each claim. This script does not
take that on trust: it opens the documents itself, confirms every quote is
really there, and confirms every document in the folder was accounted for.

usage: python3 check_log.py LOG DOCUMENTS_DIR [-o OUT]
"""
import argparse
import html
import json
import re
import unicodedata
import zipfile
from pathlib import Path

TEXT_SUFFIXES = {".txt", ".md", ".csv", ".json", ".eml"}
MARKUP_SUFFIXES = {".html", ".htm", ".xml"}
QUOTES = str.maketrans({"“": '"', "”": '"', "„": '"', "«": '"', "»": '"', "‘": "'", "’": "'", "–": "-", "—": "-"})
ELLIPSIS = re.compile(r"\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…")


def strip_tags(xml):
    return html.unescape(re.sub(r"<[^>]+>", " ", xml))


def docx_text(path):
    # page headers and footers can carry party names the body does not
    with zipfile.ZipFile(path) as z:
        parts = ["word/document.xml"] + sorted(n for n in z.namelist() if re.match(r"word/(header|footer)\d*\.xml$", n))
        xml = "\n".join(z.read(n).decode("utf-8", "replace") for n in parts)
    # runs split a sentence into many <w:t> elements; only paragraphs are real breaks
    return html.unescape(re.sub(r"<[^>]+>", "", xml.replace("</w:p>", "\n")))


def xlsx_text(path):
    with zipfile.ZipFile(path) as z:
        parts = [n for n in z.namelist() if n == "xl/sharedStrings.xml" or n.startswith("xl/worksheets/sheet")]
        return strip_tags(" ".join(z.read(n).decode("utf-8", "replace") for n in parts))


def pdf_text(path):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)


def read_text(path):
    """Text of a document, or None when this script cannot open the format."""
    suffix = path.suffix.lower()
    try:
        if suffix in TEXT_SUFFIXES:
            return path.read_text("utf-8", "replace")
        if suffix in MARKUP_SUFFIXES:
            return strip_tags(path.read_text("utf-8", "replace"))
        if suffix == ".docx":
            return docx_text(path)
        if suffix == ".xlsx":
            return xlsx_text(path)
        if suffix == ".pdf":
            return pdf_text(path)
    except Exception:
        return None
    return None


def normalize(text):
    text = unicodedata.normalize("NFKC", text).translate(QUOTES)
    return re.sub(r"\s+", " ", text).strip().casefold()


def loosen(text):
    return re.sub(r"[^0-9a-z]", "", normalize(text))


def find_quote(quote, text):
    """'exact', 'loose' (ignoring punctuation and spacing) or None.

    A quote with an ellipsis is split into fragments that must appear in order.
    """
    fragments = [f for f in (part.strip() for part in ELLIPSIS.split(quote)) if len(f) >= 3]
    if not fragments:
        return None
    for label, prepare in (("exact", normalize), ("loose", loosen)):
        haystack, position = prepare(text), 0
        for fragment in fragments:
            needle = prepare(fragment)
            position = haystack.find(needle, position) if needle else -1
            if position < 0:
                break
            position += len(needle)
        else:
            return label
    return None


def check(log, docs_dir):
    files = sorted(p for p in docs_dir.rglob("*") if p.is_file() and not p.name.startswith("."))
    by_name = {p.name.casefold(): p for p in files}
    by_stem = {p.stem.casefold(): p for p in files}
    texts = {}

    def text_for(ref):
        name = Path(ref or "").name.casefold()
        path = by_name.get(name) or by_stem.get(Path(name).stem)
        if path is None:
            return None, "The document is not in the folder."
        if path not in texts:
            texts[path] = read_text(path)
        if texts[path] is None:
            return None, "This document format could not be opened by the checker."
        return texts[path], ""

    counts = {"quotes": 0, "found": 0, "not_found": 0, "unreadable": 0, "absences": 0, "absences_confirmed": 0}
    # "missing" items are requirements the checked work left out; they carry sources too
    for claim in log.get("claims", []) + log.get("missing", []):
        # a claim that something is NOT in a document: confirm none of the terms appear
        for absent in claim.get("absent", []):
            counts["absences"] += 1
            text, problem = text_for(absent.get("file"))
            if text is None:
                absent["absent_confirmed"], absent["note"] = None, problem
                continue
            haystack = normalize(text)
            hits = [term for term in absent.get("terms", []) if normalize(term) in haystack]
            absent["absent_confirmed"], absent["terms_found"] = not hits, hits
            counts["absences_confirmed"] += not hits
        for source in claim.get("sources", []):
            counts["quotes"] += 1
            text, problem = text_for(source.get("file"))
            if text is None:
                source["quote_found"], source["quote_note"] = None, problem
                counts["unreadable"] += 1
                continue
            match = find_quote(source.get("quote", ""), text)
            source["quote_found"], source["quote_match"] = bool(match), match
            counts["found" if match else "not_found"] += 1

    logged = {Path(d.get("file", "")).name.casefold() for d in log.get("documents", [])}
    missing = [p.name for p in files if p.name.casefold() not in logged]
    for name in missing:
        log.setdefault("documents", []).append({
            "file": name, "tier": None, "read": False, "used": False,
            "note": "In the folder but missing from the agent's log.", "missing_from_log": True,
        })

    log["independent_check"] = dict(counts, documents_missing_from_log=missing)
    return log


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("log", type=Path)
    parser.add_argument("documents", type=Path)
    parser.add_argument("-o", "--out", type=Path)
    args = parser.parse_args()

    checked = check(json.loads(args.log.read_text("utf-8")), args.documents)
    out = args.out or args.log.with_name(args.log.stem + ".checked.json")
    out.write_text(json.dumps(checked, indent=2, ensure_ascii=False), "utf-8")

    result = checked["independent_check"]
    print("quotes checked: {quotes}  found: {found}  not found: {not_found}  could not open: {unreadable}".format(**result))
    if result["absences"]:
        print("absence claims checked: {absences}  confirmed: {absences_confirmed}".format(**result))
    if result["documents_missing_from_log"]:
        print("documents missing from the log: " + ", ".join(result["documents_missing_from_log"]))
    print("written to " + str(out))


if __name__ == "__main__":
    main()
