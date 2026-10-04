#!/usr/bin/env python3
"""Run a Harvey LAB entry point with two infrastructure fixes, without touching harvey-labs.

  python bench/lab.py harness <lab_core.harness.run args>
  python bench/lab.py eval    <lab_core.evaluation.run_eval args>

1. Mistral calls retry on rate limits (429) and server errors, with backoff. The stock
   adapter fails the whole task on the first 429. Applies equally to both conditions.
2. Mistral model names that do not start with "mistral" (codestral-*, magistral-*) are
   routed to the Mistral adapter and judge.
"""
import functools
import random
import sys
import time

RETRY_STATUS = {429, 500, 502, 503, 504}


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
                if status not in RETRY_STATUS or attempt == attempts - 1:
                    raise
                wait = min(delay, 90) + random.uniform(0, 2)
                print(f"[bench] Mistral {status}, retry {attempt + 1}/{attempts - 1} in {wait:.0f}s", file=sys.stderr, flush=True)
                time.sleep(wait)
                delay *= 2
    return wrapper


def patch() -> None:
    from lab_core.harness.adapters import mistral as mistral_adapter

    original_client = mistral_adapter.make_mistral_client

    def make_client():
        client = original_client()
        client.chat.complete = with_retry(client.chat.complete)
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
        "mistral" if model.lower().startswith(("codestral", "magistral", "devstral")) else original_detect(model)
    )


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
