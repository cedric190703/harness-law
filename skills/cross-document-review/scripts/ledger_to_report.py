#!/usr/bin/env python3
"""Turn the ledger into a complete first draft of the report, in markdown.

  python ledger_to_report.py [--title "Deviation Report — ..."] [--out $WORKSPACE_DIR/report.md]

Every finding is written with both values, both citations, impact, severity and
recommendation, most severe first. Then YOU edit the draft: bottom line, client-specific
analysis, interactions, anything the instructions ask for. Convert it at the end:
  python $WORKSPACE_DIR/skills/docx/scripts/generate_from_md.py report.md $OUTPUT_DIR/<deliverable>.docx
"""
import argparse
import json
import os
from collections import Counter
from pathlib import Path

ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
FINDINGS = {"deviation", "missing", "added"}
LABEL = {"deviation": "Changed", "missing": "Omitted from the reviewed document", "added": "Added in the reviewed document"}


def cell(text, limit: int = 160) -> str:
    text = " ".join(str(text or "").split()).replace("|", "/")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def cite(doc, loc) -> str:
    return ", ".join(part for part in (str(doc or "").strip(), str(loc or "").strip()) if part)


def main() -> None:
    workspace = Path(os.environ.get("WORKSPACE_DIR", "."))
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ledger", type=Path, default=workspace / "ledger.jsonl")
    parser.add_argument("--out", type=Path, default=workspace / "report.md")
    parser.add_argument("--title", default="Deviation Report")
    args = parser.parse_args()
    if not args.ledger.exists():
        raise SystemExit(f"{args.ledger} does not exist — write the ledger rows first (step 2).")
    rows = []
    for line in args.ledger.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    status = lambda r: str(r.get("status", "")).lower()  # noqa: E731
    findings = sorted((r for r in rows if status(r) in FINDINGS),
                      key=lambda r: (ORDER.get(str(r.get("severity", "")).lower(), 9), str(r.get("id", ""))))
    claims = [r for r in rows if status(r) == "claim" and str(r.get("verdict", "")).lower() == "inaccurate"]
    matches = [r for r in rows if status(r) == "match"]
    unclear = [r for r in rows if status(r) == "unclear"]
    counts = Counter(str(r.get("severity", "")).capitalize() for r in findings)

    out = [f"# {args.title}", ""]
    out += ["## Executive Summary", "",
            "<!-- EDIT: one-paragraph bottom line for the client (e.g. do not sign / must be revised before entry), then the top issues. -->", ""]
    out.append(f"This review identified **{len(findings)} deviations** "
               + "(" + ", ".join(f"{counts[s]} {s}" for s in ("Critical", "High", "Medium", "Low") if counts[s]) + ").")
    out.append("")
    top = findings[:5]
    if top:
        out.append("Most significant issues:")
        out.append("")
        for i, r in enumerate(top, 1):
            out.append(f"{i}. **{cell(r.get('topic'), 120)}** ({r.get('severity')}): {cell(r.get('ref_value'), 80)} → {cell(r.get('subj_value'), 80)}. {cell(r.get('impact'), 220)}")
        out.append("")
    if claims:
        out.append(f"The correspondence contains **{len(claims)} inaccurate statement(s)** about the documents (see below).")
        out.append("")

    out += ["## Summary of Deviations", "",
            "| ID | Provision | Reference | Reviewed document | Severity | Recommendation |",
            "|---|---|---|---|---|---|"]
    for r in findings:
        out.append(f"| {cell(r.get('id'), 12)} | {cell(r.get('topic'), 60)} | {cell(r.get('ref_value'), 60)} ({cell(r.get('ref_loc'), 40)}) "
                   f"| {cell(r.get('subj_value'), 60)} ({cell(r.get('subj_loc'), 40)}) | {cell(r.get('severity'), 10)} | {cell(r.get('recommendation'), 140)} |")
    out.append("")

    out += ["## Detailed Findings", ""]
    for r in findings:
        out.append(f"### {r.get('id')}. {cell(r.get('topic'), 140)} — {r.get('severity')}")
        out.append("")
        out.append(f"- **{LABEL[status(r)]}.**")
        if r.get("ref_quote") or r.get("ref_value"):
            quote = f' "{cell(r.get("ref_quote"), 400)}"' if r.get("ref_quote") else ""
            out.append(f"- **Reference** ({cite(r.get('ref_doc'), r.get('ref_loc'))}): {cell(r.get('ref_value'), 200)}.{quote}")
        if r.get("subj_quote") or r.get("subj_value"):
            quote = f' "{cell(r.get("subj_quote"), 400)}"' if r.get("subj_quote") else ""
            out.append(f"- **Reviewed document** ({cite(r.get('subj_doc'), r.get('subj_loc'))}): {cell(r.get('subj_value'), 200)}.{quote}")
        out.append(f"- **Impact:** {cell(r.get('impact'), 1200)}")
        out.append(f"- **Recommendation:** {cell(r.get('recommendation'), 800)}")
        links = [str(x) for x in (r.get("links") or [])]
        if links:
            out.append(f"- **Related:** {', '.join(links)}")
        out.append("")

    if claims:
        out += ["## Inaccurate Statements in the Correspondence", ""]
        for r in claims:
            out.append(f"- {cite(r.get('ref_doc'), r.get('ref_loc'))}: \"{cell(r.get('ref_quote'), 300)}\" — inaccurate; see {', '.join(map(str, r.get('links') or []))}. {cell(r.get('impact'), 300)}")
        out.append("")
    if matches:
        out += ["## Provisions Reviewed and Found Consistent", ""]
        for r in matches:
            out.append(f"- {cell(r.get('topic'), 120)}: {cell(r.get('ref_value') or r.get('ref_quote'), 120)} ({cite(r.get('subj_doc'), r.get('subj_loc'))})")
        out.append("")
    out += ["## Open Questions and Next Steps", ""]
    for r in unclear:
        out.append(f"- {cell(r.get('topic'), 120)}: {cell(r.get('impact') or r.get('subj_quote'), 300)}")
    out.append("<!-- EDIT: items needing client input, then next steps (e.g. send markup to counterparty). -->")
    out.append("")
    args.out.write_text("\n".join(out), encoding="utf-8")
    print(f"Draft written to {args.out}: {len(findings)} findings, {len(claims)} inaccurate claims, {len(matches)} consistent provisions.")
    print("Now EDIT it (bottom line, client-specific analysis, everything the instructions ask for), then convert:")
    print(f"  python $WORKSPACE_DIR/skills/docx/scripts/generate_from_md.py {args.out} $OUTPUT_DIR/<deliverable>.docx")


if __name__ == "__main__":
    main()
