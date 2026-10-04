#!/usr/bin/env python3
"""Run Harvey LAB tasks with and without our skill, grade them, and summarize.

Examples (from the harness-law root):
  python bench/run.py --model mistral-medium-3.5 --set one                 # 1 task, both conditions
  python bench/run.py --model mistral-medium-3.5 --set dev --parallel 4
  python bench/run.py --model claude-sonnet-5-5 --set test --effort high
  python bench/run.py --summary                                            # table from bench/results.jsonl

Each run is appended to bench/results.jsonl (model, condition, task, all-pass, criteria, tokens, time).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAB = ROOT / "harvey-labs"
SKILL = "cross-document-review"
BASE_SKILLS = ["docx", "pptx", "xlsx"]
RESULTS = ROOT / "bench" / "results.jsonl"
DEFAULT_JUDGE = "claude-sonnet-4-6"


def load_env() -> dict:
    env = dict(os.environ)
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    env["LAB_ROOT"] = str(LAB)
    return env


def install_skill() -> None:
    target = LAB / "lab_core" / "harness" / "skills" / SKILL
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(ROOT / "skills" / SKILL, target, ignore=shutil.ignore_patterns("__pycache__"))


def run_one(task: str, condition: str, args, env: dict) -> dict:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    model_short = args.model.split("/")[-1] + (f"-{args.effort}" if args.effort else "")
    run_id = f"{task}/{model_short}-{condition}/{stamp}"
    skills = BASE_SKILLS + ([SKILL] if condition == "skill" else [])
    cmd = ["uv", "run", "python", "-m", "lab_core.harness.run", "--model", args.model, "--task", task,
           "--run-id", run_id, "--max-turns", str(args.max_turns), "--skills", *skills]
    if args.effort:
        cmd += ["--reasoning-effort", args.effort]
    log_dir = ROOT / "bench" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log = log_dir / (run_id.replace("/", "__") + ".log")
    started = time.time()
    with log.open("w") as fh:
        agent = subprocess.run(cmd, cwd=LAB, env=env, stdout=fh, stderr=subprocess.STDOUT)
        judge_cmd = ["uv", "run", "python", "-m", "lab_core.evaluation.run_eval", "--run-id", run_id,
                     "--task", task, "--judges", *args.judges]
        graded = subprocess.run(judge_cmd, cwd=LAB, env=env, stdout=fh, stderr=subprocess.STDOUT) if agent.returncode == 0 else None
    result_dir = LAB / "results" / run_id
    metrics = json.loads((result_dir / "metrics.json").read_text()) if (result_dir / "metrics.json").exists() else {}
    score_file = next((result_dir / name for name in ("scores_dual.json", "scores.json") if (result_dir / name).exists()), None)
    if score_file is None:
        per_judge = sorted(result_dir.glob("scores_*.json"))
        score_file = per_judge[0] if per_judge else None
    scores = json.loads(score_file.read_text()) if score_file else {}
    row = {
        "at": datetime.now().isoformat(timespec="seconds"),
        "model": args.model, "effort": args.effort, "condition": condition, "task": task, "run_id": run_id,
        "judges": args.judges,
        "agent_ok": agent.returncode == 0, "graded": bool(graded and graded.returncode == 0 and scores),
        "all_pass": scores.get("all_pass"), "score": scores.get("score"),
        "n_criteria": scores.get("n_criteria"), "n_passed": scores.get("n_passed"),
        "input_tokens": metrics.get("input_tokens"), "output_tokens": metrics.get("output_tokens"),
        "turns": metrics.get("turn_count"), "finish_reason": metrics.get("finish_reason"),
        "agent_seconds": metrics.get("wall_clock_seconds"), "total_seconds": round(time.time() - started, 1),
        "log": str(log.relative_to(ROOT)),
    }
    with RESULTS.open("a") as fh:
        fh.write(json.dumps(row) + "\n")
    passed = f"{row['n_passed']}/{row['n_criteria']}" if row["n_criteria"] else "not graded"
    print(f"[{condition:5}] {task}: {passed} criteria, all-pass={row['all_pass']}, {row['total_seconds']}s", flush=True)
    return row


def summary() -> None:
    if not RESULTS.exists():
        print("no results yet")
        return
    rows = [json.loads(line) for line in RESULTS.read_text().splitlines() if line.strip()]
    groups: dict[tuple, list] = {}
    for r in rows:
        if r.get("graded"):
            groups.setdefault((r["model"], r.get("effort"), r["condition"]), []).append(r)
    print(f"{'model':28} {'cond':5} {'runs':>4} {'all-pass':>9} {'criteria':>9} {'tokens in/out (avg)':>22} {'min/run':>8}")
    for (model, effort, cond), rs in sorted(groups.items(), key=lambda kv: (kv[0][0], str(kv[0][1]), kv[0][2])):
        allpass = sum(1 for r in rs if r["all_pass"]) / len(rs)
        crit = sum(r["n_passed"] for r in rs) / max(1, sum(r["n_criteria"] for r in rs))
        tin = sum(r["input_tokens"] or 0 for r in rs) / len(rs)
        tout = sum(r["output_tokens"] or 0 for r in rs) / len(rs)
        mins = sum(r["total_seconds"] for r in rs) / len(rs) / 60
        label = model + (f"@{effort}" if effort else "")
        print(f"{label:28} {cond:5} {len(rs):>4} {allpass:>9.1%} {crit:>9.1%} {tin:>12,.0f}/{tout:<9,.0f} {mins:>8.1f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model")
    parser.add_argument("--set", choices=["one", "dev", "test", "controle"], default="one")
    parser.add_argument("--tasks", nargs="*", help="explicit task ids (overrides --set)")
    parser.add_argument("--conditions", nargs="+", choices=["base", "skill"], default=["base", "skill"])
    parser.add_argument("--effort", help="reasoning effort passed to the model (low/medium/high/...)")
    parser.add_argument("--judges", nargs="+", default=[DEFAULT_JUDGE])
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--parallel", type=int, default=2)
    parser.add_argument("--max-turns", type=int, default=200)
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()
    if args.summary:
        summary()
        return
    if not args.model:
        parser.error("--model is required")
    split = json.loads((ROOT / "bench" / "split.json").read_text())
    tasks = args.tasks or (split["dev"][:1] if args.set == "one" else split[args.set])
    env = load_env()
    needed = ["ANTHROPIC_API_KEY"] + (["MISTRAL_API_KEY"] if args.model.startswith("mistral") else [])
    needed += ["OPENAI_API_KEY"] if any(j.startswith("gpt") for j in args.judges) else []
    missing = [k for k in needed if not env.get(k)]
    if missing:
        sys.exit(f"missing in .env: {', '.join(missing)}")
    install_skill()
    jobs = [(t, c) for _ in range(args.repeat) for t in tasks for c in args.conditions]
    print(f"{len(jobs)} runs: {len(tasks)} tasks x {args.conditions} x {args.repeat} — model {args.model}, judges {args.judges}")
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        list(pool.map(lambda job: run_one(job[0], job[1], args, env), jobs))
    summary()


if __name__ == "__main__":
    main()
