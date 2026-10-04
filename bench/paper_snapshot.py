#!/usr/bin/env python3
"""Export aggregate LAB evidence; never expose held-out rubric text or verdicts.

python3 bench/paper_snapshot.py /path/to/harvey-labs/results > paper/lab-results.json
The original Opus-max/GPT-high profile stays fixed. Medium regrades are recorded
separately, never substituted on the basis of their score.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JUDGES = ("claude-code-opus-5-5@max", "codex-gpt-5.5@high")


def read(path):
    return json.loads(path.read_text()) if path.exists() else {}


def snapshot(results):
    split = read(ROOT / "bench/split-ma.json")
    rows = []
    agreement = {"runs": 0, "agree": 0, "total": 0}
    for partition in ("dev", "test"):
        for task in split[partition]:
            for run in sorted((results / task).glob("*/*")):
                if not run.is_dir():
                    continue
                metrics = read(run / "metrics.json")
                scores = {}
                raw = {}
                for path in sorted(run.glob("scores_*.json")):
                    if path.name == "scores_dual.json":
                        continue
                    score = read(path)
                    judge = score.get("judge_model", path.stem.removeprefix("scores_"))
                    raw[judge] = score
                    scores[judge] = {key: score.get(key) for key in (
                        "n_passed", "n_criteria", "n_grading_errors", "all_pass", "scored_at")}
                    scores[judge]["complete"] = bool(score.get("n_criteria")) and score.get("n_grading_errors") == 0 and len(score.get("criteria_results", [])) == score["n_criteria"]
                excluded = metrics.get("ne_compte_pas")
                complete = not excluded and all(scores.get(j, {}).get("complete") for j in JUDGES)
                row = {"split": partition, "task": task, "run_id": str(run.relative_to(results)),
                       "condition": run.parent.name, "excluded": excluded,
                       "original_profile_complete": bool(complete), "scores": scores}
                rows.append(row)
                # Only development verdicts are compared. Test rubric remains sealed.
                if partition == "dev" and complete:
                    left, right = ({c["id"]: c["verdict"] for c in raw[j]["criteria_results"]} for j in JUDGES)
                    assert left.keys() == right.keys()
                    assert len(left) == raw[JUDGES[0]]["n_criteria"]
                    agreement["runs"] += 1
                    agreement["total"] += len(left)
                    agreement["agree"] += sum(v == right[k] for k, v in left.items())
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "judges": JUDGES,
            "selection": "All runs; raw incomplete counts retained for audit, never included in aggregates. Original judge profile fixed.",
            "development_agreement": agreement, "runs": rows}


if __name__ == "__main__":
    print(json.dumps(snapshot(Path(sys.argv[1])), ensure_ascii=False, indent=2))
