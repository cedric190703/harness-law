#!/usr/bin/env python3
"""Run a Harvey LAB entry point with two infrastructure fixes, without touching harvey-labs.

  python bench/lab.py harness <lab_core.harness.run args>
  python bench/lab.py eval    <lab_core.evaluation.run_eval args>

1. Mistral calls retry on rate limits (429), server errors and network timeouts, with backoff. The stock
   adapter fails the whole task on the first 429. Applies equally to both conditions.
2. Mistral model names that do not start with "mistral" (codestral-*, magistral-*) are
   routed to the Mistral adapter and judge.
3. Mistral calls at temperature 0 send top_p=1, which the API now requires (both conditions).
3b. BENCH_MISTRAL_TOOL_CHOICE=any forces Mistral agents to act through tools (they end the
   run with the finish tool). Off by default; when used, it applies to both conditions.
4. Judge names starting with claude-code (claude-code-sonnet, claude-code-opus, or a pinned model with an
   effort level such as claude-code-opus-5-5@max) grade through
   `claude -p` on the Claude Code subscription instead of an API: same prompt and verdict JSON,
   no tools, none of the user's settings, CLAUDE.md, memory or MCP servers, at most 4 calls at once.
5. Judge names codex-<model>[@<effort>] (codex-gpt-5.5@high) grade through `codex exec` on the ChatGPT
   subscription, with the same contract: user config, rules, skills, plugins, MCP servers, hooks and
   tools off, a one-line system prompt, at most 4 calls at once. Codex has no switch for the global
   ~/.codex/AGENTS.md, which it still loads (personal workflow notes, nothing about grading).
"""
import functools
import json
import os
import random
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

RETRY_STATUS = {429, 500, 502, 503, 504}
NETWORK_ERRORS = {"ReadTimeout", "ConnectTimeout", "ConnectError", "RemoteProtocolError", "ReadError"}
CLAUDE_CODE_DIR = Path.home() / "lab-claude-code" / "juge"  # empty, outside any repository
CLAUDE_CODE_SLOTS = threading.BoundedSemaphore(4)
CLAUDE_CODE_TIMEOUT = 180
CLAUDE_CODE_MODELS: set[str] = set()
CODEX_DIR = Path.home() / "lab-claude-code" / "juge-codex"  # empty, outside any repository
CODEX_SLOTS = threading.BoundedSemaphore(4)
CODEX_MODELS: set[str] = set()
# Everything a judge does not need: the user's config.toml (MCP servers, plugins, hooks), project docs,
# skills, web search, shell and the other tools, and the long agent prompt.
CODEX_ISOLATION = ["--ignore-user-config", "--ignore-rules", "--strict-config"]
for setting in ("project_doc_max_bytes=0", 'web_search="disabled"', "skills.include_instructions=false",
                "skills.bundled.enabled=false", "include_apps_instructions=false", "include_environment_context=false",
                "include_permissions_instructions=false", "include_collaboration_mode_instructions=false"):
    CODEX_ISOLATION += ["-c", setting]
for feature in ("shell_tool", "unified_exec", "apps", "plugins", "image_generation", "goals", "multi_agent",
                "browser_use", "computer_use", "hooks", "tool_suggest", "skill_search"):
    CODEX_ISOLATION += ["--disable", feature]


def _status(exc: Exception) -> int | None:
    for attr in ("status_code", "status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    raw = getattr(exc, "raw_response", None) or getattr(exc, "http_res", None)
    return getattr(raw, "status_code", None)


def with_retry(fn, attempts: int = 8):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        delay = 5.0
        for attempt in range(attempts):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:
                status = _status(exc)
                network = type(exc).__name__ in NETWORK_ERRORS
                if (status not in RETRY_STATUS and not network) or attempt == attempts - 1:
                    raise
                status = status or type(exc).__name__
                wait = min(delay, 90) + random.uniform(0, 2)
                print(f"[bench] Mistral {status}, retry {attempt + 1}/{attempts - 1} in {wait:.0f}s", file=sys.stderr, flush=True)
                time.sleep(wait)
                delay *= 2
    return wrapper


def claude_code_verdict(model: str, prompt: str, schema: dict, attempts: int = 3) -> dict:
    """Grade one prompt with `claude -p`. Like the stock Anthropic judge, every attempt but the
    last asks for structured output; the last parses free text, ```json fences included."""
    from lab_core.evaluation.judge import Judge

    home = Path.home() / ".claude"
    settings = {"claudeMdExcludes": [str(home / "CLAUDE.md"), str(home / "**" / "*.md")], "autoMemoryEnabled": False}
    name, _, effort = model.removeprefix("claude-code").strip("-").partition("@")
    name = name or "sonnet"
    if "-" in name and not name.startswith("claude-"):  # opus-5-5 -> claude-opus-5-5 ; bare aliases stay
        name = f"claude-{name}"
    cmd = ["claude", "-p", "--model", name, *(["--effort", effort] if effort else []),
           "--system-prompt", "", "--output-format", "json", "--tools", "", "--no-session-persistence",
           "--strict-mcp-config", "--mcp-config", '{"mcpServers": {}}', "--setting-sources", "project",
           "--disable-slash-commands", "--settings", json.dumps(settings)]
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}  # the subscription, not the API
    CLAUDE_CODE_DIR.mkdir(parents=True, exist_ok=True)
    error = ""
    for attempt in range(attempts):
        structured = ["--json-schema", json.dumps(schema)] if attempt < attempts - 1 else []
        try:
            with CLAUDE_CODE_SLOTS:
                done = subprocess.run(cmd + structured, input=prompt, capture_output=True, text=True,
                                      cwd=CLAUDE_CODE_DIR, env=env, timeout=CLAUDE_CODE_TIMEOUT * (3 if effort else 1))
            try:
                out = json.loads(done.stdout)
            except json.JSONDecodeError:
                raise RuntimeError(f"exit {done.returncode}: {(done.stderr or done.stdout).strip()[:300]}") from None
            if out.get("is_error"):
                raise RuntimeError(f"API status {out.get('api_error_status')}: {str(out.get('result'))[:300]}")
            if not CLAUDE_CODE_MODELS:
                CLAUDE_CODE_MODELS.update(out.get("modelUsage", {}))
                print(f"[bench] Claude Code judge runs on {', '.join(sorted(CLAUDE_CODE_MODELS))}", file=sys.stderr, flush=True)
            return out.get("structured_output") or Judge._parse_json(out.get("result") or "")
        except subprocess.TimeoutExpired:
            error = f"no answer within {CLAUDE_CODE_TIMEOUT}s"
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            print(f"[bench] Claude Code judge: {error}, retry {attempt + 1}/{attempts - 1}", file=sys.stderr, flush=True)
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"Claude Code judge ({model}) failed {attempts} times, last error: {error}")


def codex_verdict(model: str, prompt: str, schema: dict, attempts: int = 3) -> dict:
    """Grade one prompt with `codex exec`, with the same contract and retries as claude_code_verdict."""
    from lab_core.evaluation.judge import Judge

    name, _, effort = model.removeprefix("codex").strip("-").partition("@")
    env = {k: v for k, v in os.environ.items() if k not in ("OPENAI_API_KEY", "CODEX_API_KEY")}  # the subscription
    CODEX_DIR.mkdir(parents=True, exist_ok=True)
    timeout = CLAUDE_CODE_TIMEOUT * (3 if effort else 1)
    error = ""
    with tempfile.TemporaryDirectory(prefix="bench-codex-") as tmp:
        work = Path(tmp)
        (work / "instructions.md").write_text("You are a helpful assistant.\n")  # replaces the long agent prompt
        (work / "schema.json").write_text(json.dumps(schema))
        answer_file = work / "answer.txt"
        cmd = ["codex", "exec", "-m", name or "gpt-5.5", *(["-c", f'model_reasoning_effort="{effort}"'] if effort else []),
               "-c", f"model_instructions_file={json.dumps(str(work / 'instructions.md'))}", *CODEX_ISOLATION,
               "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "-o", str(answer_file)]
        for attempt in range(attempts):
            structured = ["--output-schema", str(work / "schema.json")] if attempt < attempts - 1 else []
            answer_file.unlink(missing_ok=True)
            try:
                with CODEX_SLOTS:
                    done = subprocess.run(cmd + structured + ["-"], input=prompt, capture_output=True, text=True,
                                          cwd=CODEX_DIR, env=env, timeout=timeout)
                answer = answer_file.read_text() if answer_file.exists() else ""
                if done.returncode != 0 or not answer.strip():
                    errors = [line for line in done.stderr.splitlines() if line.startswith("ERROR:")]
                    raise RuntimeError(f"exit {done.returncode}: {(errors[-1] if errors else done.stderr.strip()[-300:])[:300]}")
                if not CODEX_MODELS:  # the banner Codex prints before the prompt
                    CODEX_MODELS.update(l for l in done.stderr.splitlines()[:12] if l.startswith(("model:", "reasoning effort:")))
                    print(f"[bench] Codex judge runs on {', '.join(sorted(CODEX_MODELS))}", file=sys.stderr, flush=True)
                return Judge._parse_json(answer)
            except subprocess.TimeoutExpired:
                error = f"no answer within {timeout}s"
            except Exception as exc:
                error = f"{type(exc).__name__}: {exc}"
            if attempt < attempts - 1:
                print(f"[bench] Codex judge: {error}, retry {attempt + 1}/{attempts - 1}", file=sys.stderr, flush=True)
                time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"Codex judge ({model}) failed {attempts} times, last error: {error}")


def patch() -> None:
    from lab_core.harness.adapters import mistral as mistral_adapter

    original_client = mistral_adapter.make_mistral_client

    def make_client():
        client = original_client()
        complete = with_retry(client.chat.complete)
        tool_choice = os.environ.get("BENCH_MISTRAL_TOOL_CHOICE")

        def complete_with_choice(*args, **kwargs):
            # The API now rejects temperature 0 unless top_p is exactly 1 (400 "greedy sampling").
            if kwargs.get("temperature") == 0:
                kwargs.setdefault("top_p", 1)
            if tool_choice and kwargs.get("tools"):
                kwargs.setdefault("tool_choice", tool_choice)
            return complete(*args, **kwargs)

        client.chat.complete = complete_with_choice
        return client

    mistral_adapter.make_mistral_client = make_client

    from lab_core.harness import run as harness_run

    original_create = harness_run.create_adapter

    def create_adapter(model, temperature=0.0, reasoning_effort=None):
        model_id = model.split("/", 1)[-1]
        if model_id.startswith(("codestral", "magistral", "devstral")):
            return mistral_adapter.MistralAdapter(model=model_id, temperature=temperature, reasoning_effort=reasoning_effort)
        return original_create(model, temperature, reasoning_effort)

    harness_run.create_adapter = create_adapter

    from lab_core.evaluation import judge

    judge.make_mistral_client = make_client
    original_detect = judge._detect_provider
    judge._detect_provider = lambda model: (
        "claude-code" if model.lower().startswith("claude-code")
        else "codex" if model.lower().startswith("codex-")
        else "mistral" if model.lower().startswith(("codestral", "magistral", "devstral")) else original_detect(model)
    )

    original_init = judge.Judge.__init__
    original_evaluate = judge.Judge.evaluate
    cli_judges = {"claude-code": claude_code_verdict, "codex": codex_verdict}

    def init(self, model: str = "claude-sonnet-4-6"):
        provider = judge._detect_provider(model)
        if provider not in cli_judges:
            return original_init(self, model)
        self.model, self.provider, self.client = model, provider, None

    def evaluate(self, prompt_template: str, variables: dict, temperature: float = 0.0, _retries: int = 2) -> dict:
        if self.provider not in cli_judges:
            return original_evaluate(self, prompt_template, variables, temperature, _retries)
        return cli_judges[self.provider](self.model, prompt_template.format(**variables), judge._VERDICT_SCHEMA)

    judge.Judge.__init__ = init
    judge.Judge.evaluate = evaluate


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("harness", "eval"):
        sys.exit(__doc__)
    mode, rest = sys.argv[1], sys.argv[2:]
    patch()
    if mode == "harness":
        from lab_core.harness import run as harness_run

        harness_run.main(harness_run.parser.parse_args(rest))
    else:
        from lab_core.evaluation import run_eval

        sys.argv = ["run_eval", *rest]
        run_eval.main()


if __name__ == "__main__":
    main()
