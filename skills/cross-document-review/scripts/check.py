#!/usr/bin/env python3
"""Mechanical gate for the concordance ledger and the final report.

  python check.py candidates             # figures found in only one document (likely deviations)
  python check.py ledger                 # verify $WORKSPACE_DIR/ledger.jsonl
  python check.py report <deliverable>   # check the deliverable reflects the ledger

Options: --ledger PATH, --text-dir PATH (defaults under $WORKSPACE_DIR).
"""
import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

from sections import bare_numbers, candidates, locate, normalize

STATUSES = {"match", "deviation", "missing", "added", "unclear", "claim", "n/a"}
FINDINGS = {"deviation", "missing", "added"}
SEVERITIES = {"critical", "high", "medium", "low"}
ABSENT = {"", "none", "absent", "n/a", "not addressed", "silent", "omitted", "not included"}
STOP = set("the a an of to in for and or on by with from at as is are be this that its under per".split())
MAX_LISTED = 25


def load_ledger(path: Path) -> tuple[list[dict], list[str]]:
    rows, errors = [], []
    if not path.exists():
        return rows, [f"{path} does not exist — build the ledger first (step 2)."]
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"line {n}: invalid JSON ({exc.msg}) — fix this line")
            continue
        row["_line"] = n
        rows.append(row)
    return rows, errors


class Corpus:
    def __init__(self, text_dir: Path):
        self.text_dir = text_dir
        self.files = {p.relative_to(text_dir).as_posix()[:-4]: p for p in text_dir.rglob("*.txt")}
        self._cache: dict[str, tuple[str, str]] = {}

    def resolve(self, name: str) -> str | None:
        if not name:
            return None
        name = name.strip().removeprefix("documents/").removeprefix("/workspace/documents/")
        if name in self.files:
            return name
        base = Path(name).name.lower()
        stem = Path(name).stem.lower()
        for key in self.files:
            if Path(key).name.lower() == base:
                return key
        for key in self.files:
            if Path(key).stem.lower() == stem:
                return key
        return None

    def text(self, key: str) -> tuple[str, str]:
        if key not in self._cache:
            raw = self.files[key].read_text(encoding="utf-8", errors="replace")
            self._cache[key] = (raw, normalize(raw))
        return self._cache[key]


def check_quote(corpus: Corpus, row: dict, doc_field: str, quote_field: str, problems: list[str]) -> None:
    quote = (row.get(quote_field) or "").strip()
    doc = row.get(doc_field) or ""
    if not quote:
        return
    key = corpus.resolve(doc)
    if key is None:
        problems.append(f"{row.get('id', '?')}: {doc_field} '{doc}' is not one of the documents")
        return
    status, _ = locate(quote, corpus.text(key)[1])
    if status == "missing":
        problems.append(f"{row.get('id', '?')}: {quote_field} not found verbatim in {key}: \"{quote[:90]}\"")
    elif status == "approx":
        problems.append(f"{row.get('id', '?')}: {quote_field} only approximately matches {key} — copy it exactly: \"{quote[:90]}\"")


def uncovered_candidates(corpus: Corpus, rows: list[dict], only: set[str] | None = None) -> list[tuple[str, int, list[str], str]]:
    """Candidate passages (unique unit-numbers) whose numbers the ledger never mentions."""
    docs = {key: corpus.text(key)[0] for key in corpus.files}
    ledger_text = " ".join(str(r.get(f, "")) for r in rows
                           for f in ("ref_quote", "subj_quote", "ref_value", "subj_value", "impact", "topic", "ref_loc", "subj_loc"))
    known = bare_numbers(ledger_text)
    return [c for c in candidates(docs)
            if (only is None or c[0] in only) and not any(n in known for n in c[2])]


def print_candidates(items: list[tuple[str, int, list[str], str]], title: str) -> None:
    by_doc: dict[str, list] = {}
    for item in items:
        by_doc.setdefault(item[0], []).append(item)
    print(f"\n{title} ({len(items)})")
    for doc, entries in by_doc.items():
        print(f"  [{doc}] {len(entries)} passages")
        for _, line_no, nums, snippet in entries[:MAX_LISTED]:
            print(f"    line {line_no} — {', '.join(nums)} — {snippet}")
        if len(entries) > MAX_LISTED:
            print(f"    ... {len(entries) - MAX_LISTED} more — re-run after adding rows")


def cmd_candidates(args) -> int:
    corpus = Corpus(args.text_dir)
    if not corpus.files:
        print(f"no extracted text in {args.text_dir} — run extract_text.py first")
        return 1
    items = uncovered_candidates(corpus, [])
    print("Passages whose figures ($, %, bps, x, days, months, years) appear in NO other document.")
    print("Each is a likely deviation, omission or addition. Every one must end up in the ledger")
    print("(as a deviation, or as match / n/a if the difference is legitimate). This list is a")
    print("starting point, NOT the whole review: wording changes without figures are not listed.")
    print_candidates(items, "CANDIDATES")
    return 0


def cmd_ledger(args) -> int:
    rows, errors = load_ledger(args.ledger)
    corpus = Corpus(args.text_dir)
    if not corpus.files:
        errors.append(f"no extracted text in {args.text_dir} — run extract_text.py first (step 1)")
    warnings: list[str] = []
    ids = Counter(r.get("id") for r in rows)
    for dup, n in ids.items():
        if n > 1:
            errors.append(f"id {dup} is used {n} times — ids must be unique")
    for row in rows:
        rid = row.get("id", f"line {row['_line']}")
        status = str(row.get("status", "")).lower()
        if status not in STATUSES:
            errors.append(f"{rid}: status '{row.get('status')}' must be one of {sorted(STATUSES)}")
            continue
        if not row.get("topic"):
            errors.append(f"{rid}: missing topic")
        check_quote(corpus, row, "ref_doc", "ref_quote", errors)
        check_quote(corpus, row, "subj_doc", "subj_quote", errors)
        if status in FINDINGS:
            if status != "added" and not (row.get("ref_quote") or "").strip():
                errors.append(f"{rid}: {status} needs ref_quote (what the reference says)")
            if status != "missing" and not (row.get("subj_quote") or "").strip():
                errors.append(f"{rid}: {status} needs subj_quote (what the subject says)")
            for field in ("ref_value", "subj_value"):
                value = str(row.get(field, "")).strip().lower()
                absent_ok = (status == "added" and field == "ref_value") or (status == "missing" and field == "subj_value")
                if value in ABSENT and not (absent_ok and field in row):
                    errors.append(f"{rid}: {field} must state the precise value (use \"none\" only for the absent side)")
            for field in ("impact", "recommendation"):
                if len(str(row.get(field, "")).split()) < 4:
                    errors.append(f"{rid}: {field} is empty or too vague")
            if str(row.get("severity", "")).lower() not in SEVERITIES:
                errors.append(f"{rid}: severity must be Critical, High, Medium or Low")
        if status == "claim" and str(row.get("verdict", "")).lower() not in {"accurate", "inaccurate", "unverifiable"}:
            errors.append(f"{rid}: claim rows need verdict accurate | inaccurate | unverifiable")
        if status == "unclear":
            warnings.append(f"{rid}: still 'unclear' — resolve it or list it as an open question in the report")

    used = {corpus.resolve(str(r.get(f) or "")) for r in rows for f in ("ref_doc", "subj_doc")}
    used |= {corpus.resolve(str(d)) for r in rows for d in (r.get("links") or []) if isinstance(d, str)}
    for key in sorted(corpus.files):
        if key not in used:
            errors.append(f"document never used in the ledger: {key} — read it; record what it changes (claim, requirement, data) or add an n/a row")

    compared = {corpus.resolve(str(r.get(f) or "")) for r in rows if str(r.get("status", "")).lower() != "claim"
                for f in ("ref_doc", "subj_doc")} - {None}
    uncovered = uncovered_candidates(corpus, rows, compared) if rows and corpus.files else []
    counts = Counter(str(r.get("status", "")).lower() for r in rows)
    sev = Counter(str(r.get("severity", "")).capitalize() for r in rows if str(r.get("status", "")).lower() in FINDINGS)
    print(f"{len(rows)} rows: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    if sev:
        print("severity: " + ", ".join(f"{k} {v}" for k, v in sev.most_common()))
    for title, items in (("ERRORS", errors), ("WARNINGS", warnings)):
        if items:
            print(f"\n{title} ({len(items)})")
            for item in items[:60]:
                print(f"  - {item}")
            if len(items) > 60:
                print(f"  ... {len(items) - 60} more")
    if uncovered:
        print_candidates(uncovered, "FIGURES NOT YET IN THE LEDGER — read each passage; add a row (deviation / missing / added / match / n/a) that states the figure")
    ok = not errors and not uncovered
    print("\nLEDGER OK" if ok else "\nLEDGER NOT OK — fix the items above and re-run.")
    return 0 if ok else 1


def cmd_report(args) -> int:
    sys.path.insert(0, str(Path(__file__).parent))
    from extract_text import convert

    target = Path(args.deliverable)
    if not target.exists():
        print(f"{target} does not exist")
        return 1
    report = convert(target)
    report_norm = normalize(report)
    report_nums = bare_numbers(report)
    rows, errors = load_ledger(args.ledger)
    problems = list(errors)
    for row in rows:
        status = str(row.get("status", "")).lower()
        relevant = status in FINDINGS or (status == "claim" and str(row.get("verdict", "")).lower() == "inaccurate")
        if not relevant:
            continue
        rid, topic = row.get("id", "?"), str(row.get("topic", ""))
        wanted = bare_numbers(f"{row.get('ref_value', '')} {row.get('subj_value', '')}") if status != "claim" else set()
        missing_nums = sorted(n for n in wanted if n not in report_nums)
        words = [w for w in re.findall(r"[a-z][a-z'-]{3,}", normalize(topic)) if w not in STOP]
        found_words = [w for w in words if w in report_norm]
        if words and len(found_words) < max(1, len(words) // 2):
            problems.append(f"{rid} ({topic}): topic not found in the report")
        elif missing_nums:
            problems.append(f"{rid} ({topic}): values {', '.join(missing_nums)} not stated in the report — state both values")
    lowered = report_norm
    for label, pattern in (("an executive summary", r"executive summary|summary"),
                           ("recommendations", r"recommend"),
                           ("severity / priority labels", r"critical|high|medium|low|priority")):
        if not re.search(pattern, lowered):
            problems.append(f"report has no {label}")
    print(f"report: {target.name}, {len(report.split())} words; {sum(1 for r in rows if str(r.get('status', '')).lower() in FINDINGS)} findings in ledger")
    if problems:
        print(f"\nREPORT GAPS ({len(problems)})")
        for item in problems[:80]:
            print(f"  - {item}")
        print("\nREPORT NOT OK — fix, re-run, then reread the instructions sentence by sentence.")
        return 1
    print("\nREPORT OK — now reread the task instructions sentence by sentence before calling finish.")
    return 0


def main() -> None:
    workspace = Path(os.environ.get("WORKSPACE_DIR", "."))
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["candidates", "ledger", "report"])
    parser.add_argument("deliverable", nargs="?")
    parser.add_argument("--ledger", type=Path, default=workspace / "ledger.jsonl")
    parser.add_argument("--text-dir", type=Path, default=workspace / "text")
    args = parser.parse_args()
    if args.mode == "report" and not args.deliverable:
        parser.error("report mode needs the deliverable path")
    sys.exit({"candidates": cmd_candidates, "ledger": cmd_ledger, "report": cmd_report}[args.mode](args))


if __name__ == "__main__":
    main()
