# Visa demo site

A single page that shows the review side of Visa on a real case: Legora's report on the
closing-checklist task of Harvey's Legal Agent Benchmark
(`corporate-ma/compare-closing-checklist-against-ma-agreement`).

Open `index.html` in a browser. No server and no build step are needed to view it.

## What it shows

1. A live check that replays the stored results: Legora's 23 statements, then the 4 required
   items its report left out, then the with/without-method score (26/38 and 38/38, from
   `bench/` on `youssef/bench-revue`).
2. A review screen: each statement beside the passages that prove it, differing values in
   red, matching ones in green. Initial or flag each one (`I`, `F`, arrows).
3. A coverage table, a documents view, and a printable sign-off record.

## What is real and what was prepared

- The two documents and the rubric are the benchmark's own files (`matter/documents`, `matter/task.json`).
- The 23 statements are the ones Legora made in its report on 4 October 2026 (plain run, no method).
- The passages, statuses and the 4 left-out items in `matter/make_log.py` were prepared by hand
  with Claude for the demo, using the rubric to know which omissions to look for. They are not
  the output of the agent harness.
- `tools/check_log.py` then opens the documents and confirms every quote (63 of 63) and every
  "this is absent" claim (6 of 6). It does not trust the log.

## Rebuild

```bash
cd demo-site/matter
python3 make_log.py
python3 ../tools/check_log.py verification-log.json documents
python3 ../build.py
```

`build.py` inlines every `matter*/verification-log.checked.json` it finds into `site.template.html`
and writes `index.html`. To show another matter, add a folder with a log in the same shape
(`claims`, `missing`, `coverage`, `documents`, `path`) and run the checker on it.
