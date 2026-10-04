---
name: cross-document-review
description: "Use this skill whenever the task asks you to compare, reconcile, or check one or more documents against a governing reference — deviation reports, discrepancy reports, gap analyses, conformity or compliance reviews, 'X against Y' comparisons (draft vs. term sheet, decree vs. settlement, policy vs. spec, filing vs. regulation, candidate vs. criteria). It is the verification method senior lawyers use: an exhaustive concordance table, every finding anchored to a verbatim quote, mechanically checked before delivery. Does NOT apply to tasks that only ask you to draft from scratch or summarize a single document."
---

# Cross-document review (concordance method)

Partners reject comparison work for one reason: **one missed or misstated item**. A report that catches 95% of deviations is wrong. This method trades speed for completeness and verifiability. Follow the steps in order; do not draft the deliverable before step 6.

Scripts live in `$WORKSPACE_DIR/skills/cross-document-review/scripts/`. All working files go in `$WORKSPACE_DIR` (never in `output/`).

## Step 1 — Inventory and roles

```bash
python $WORKSPACE_DIR/skills/cross-document-review/scripts/extract_text.py
```

This converts every document to plain text — `$WORKSPACE_DIR/text/<full document filename>.txt`, e.g. `text/executed-term-sheet.docx.txt` — and prints the exact paths. Then:

- **Read every document in full, exactly once: read the `.txt` files, not the originals** (same content, and each re-read fills your context window). Do not skim. Long documents: read in chunks until the end. Afterwards, look things up with `grep -n` on `$WORKSPACE_DIR/text/` instead of re-reading.
- Assign each document a role: **REFERENCE** (what governs: term sheet, executed agreement, client instructions, spec, statute/regulation, selection criteria, prior version), **SUBJECT** (what is being checked), or **CONTEXT** (cover emails, notes, claims data, templates, checklists).
- Identify **the client and its side** (e.g. borrower, the wife, the insured, the issuer's counsel). Every impact and recommendation is written from that side.
- Identify the **parties, transaction, and key dates** exactly as named in the documents.

## Step 2 — Build the concordance ledger (forward pass)

First, list the figures that appear in only one document — the most likely deviations, omissions and additions:

```bash
python $WORKSPACE_DIR/skills/cross-document-review/scripts/check.py candidates
```

Every passage it lists must end up in the ledger. It is a starting point, not the whole review: wording changes without figures are not listed.

Then create `$WORKSPACE_DIR/ledger.jsonl`, one JSON object per line. Walk the REFERENCE **section by section, including definitions, schedules, exhibits, tables, footnotes**. Every operative term gets a row — not only the ones that look important.

```json
{"id": "R-012", "topic": "SOFR floor (Term Loan A)", "ref_doc": "executed-term-sheet.docx", "ref_loc": "Pricing", "ref_quote": "SOFR floor of 0.75%", "subj_doc": "draft-credit-agreement.docx", "subj_loc": "Section 1.01 'Adjusted Term SOFR'", "subj_quote": "shall not be less than 1.00%", "status": "deviation", "ref_value": "0.75%", "subj_value": "1.00%", "impact": "", "severity": "", "recommendation": "", "links": []}
```

- `status`: `match` | `deviation` | `missing` (in reference, absent from subject; `subj_value` = `"none"`) | `added` (in subject, not in reference; `ref_value` = `"none"`) | `unclear` | `claim` (step 4) | `n/a` (boilerplate you reviewed: notices, signatures).
- `ref_quote` / `subj_quote`: **copied verbatim** from the document text, short (5–30 words) and distinctive. Never paraphrase inside a quote field.
- Write rows in batches as you go (append with `bash cat >> ... <<'EOF'` or `write` to an absolute path). Do not hold the table in your head.
- Several references (e.g. term sheet + commitment letter, or spec + contract covenant)? Compare the subject against **each** and record which source each requirement comes from.

## Step 3 — Reverse pass and hidden changes

Walk the SUBJECT section by section and add `added` rows for anything with no counterpart in the reference: new conditions, new carve-outs, broadened or narrowed **defined terms** (Change of Control, Material Adverse Effect, EBITDA, Permitted X), changed triggers (knowledge qualifiers, "sole discretion", "reasonable"), extended or shortened periods, removed protective words ("irrevocable", "not less than", "jointly and severally").

Omissions are deviations: a missing tier, floor, cap, minimum threshold, carryforward, exception, cure right, notice period, or step-down counts.

## Step 4 — Test every claim in the CONTEXT documents

Cover emails, transmittals, and notes often characterize the subject ("conforms to the term sheet", "only clean-up changes", "consistent with our discussions"). Extract **each factual claim** and test it against the ledger: add a row with `"status": "claim"`, `ref_doc` = the context document, `ref_quote` = the claim verbatim, `"verdict": "accurate" | "inaccurate" | "unverifiable"`, and `links` = the ledger ids that prove it. If a claim is inaccurate, say so explicitly in the report (claim, source, why it is inaccurate). Use spreadsheets and data files to compute the figures the review needs. If a template or checklist is provided, follow its structure.

## Step 5 — Analyze each non-match row

For every `deviation`, `missing`, `added`, fill:

- `ref_value` and `subj_value`: **both** precise values with units (amounts, percentages, days, ratios, parties, dates).
- `impact`: the concrete consequence **for the client**, quantified whenever the documents allow (annual cost, aggregate exposure, percentage change). Compute with `python`, and show the arithmetic in the report (e.g. "$185M × 0.25% = $462,500 per year").
- Interactions: when two deviations compound each other, or a gap breaches a requirement in a third document, put the other row ids in `links` and say it.
- `severity`: **Critical** (economic or legal exposure that must be fixed before signing/entry; contradicts a negotiated or court-ordered term), **High** (material adverse change to the client), **Medium** (meaningful but negotiable), **Low** (drafting/clean-up).
- `recommendation`: a specific fix ("Revise Section 2.08(a) to restore the 0.75% floor per the executed term sheet"), not "consider reviewing".

## Step 6 — Mechanical gate (mandatory, repeat until clean)

```bash
python $WORKSPACE_DIR/skills/cross-document-review/scripts/check.py ledger
```

It verifies that every quote exists verbatim in the named document, that every non-match row is complete, that every document was used, and it lists **passages of the compared documents whose figures no row mentions yet**. For each one: read it, then add a row stating the figure (`match` or `n/a` if the difference is legitimate). For each quote not found: fix the quote from the text, or correct the finding. Re-run until it reports `LEDGER OK`.

## Step 7 — Draft the deliverable from the ledger

Write the report from `ledger.jsonl`, not from memory. Use the exact output filename requested and the docx/xlsx skill for the format. Default structure (adapt to what the instructions ask for):

1. **Header** — matter, parties and their roles, documents reviewed, client/side.
2. **Executive summary** — bottom-line recommendation (e.g. "do not sign / the decree must be revised before entry"), the top issues ranked, count by severity.
3. **Summary table** — ID, provision, reference value + cite, subject value + cite, severity, recommendation.
4. **Detailed findings**, most severe first — what each document says (short quotes with section cites), the difference with **both values stated**, quantified impact on the client, interactions, specific recommendation.
5. **Inaccurate statements in correspondence** (from step 4), if any.
6. **Provisions confirmed as conforming** — a brief list (it proves completeness).
7. **Open questions / items needing client input**, next steps.

Use the categories, priority labels, or headings the instructions request, in their words.

## Step 8 — Final review loop (mandatory)

```bash
python $WORKSPACE_DIR/skills/cross-document-review/scripts/check.py report $OUTPUT_DIR/<deliverable>
```

It lists ledger findings, or values, that are missing from the report. Then reread the task instructions **sentence by sentence** and confirm that each requested element is present (prioritized? categorized? recommendations? root causes? quantification? the requested side?). Fix, re-run, and only then call `finish`.
