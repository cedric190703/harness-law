#!/usr/bin/env python3
"""Reject private configuration paths even if added with git add --force."""
import pathlib
import re
import subprocess
import sys

paths = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
blocked = []
for value in filter(None, paths):
    path = pathlib.PurePosixPath(value)
    name = path.name.lower()
    env = name.startswith(".env") and not name.endswith(".example")
    private_dir = bool(set(path.parts) & {".harness-data", ".ssh", ".aws"})
    credential = bool(re.fullmatch(r"credentials.*\.json|.*service-account.*\.json|online-access\.json|id_rsa|id_ed25519", name))
    private_key = path.suffix.lower() in {".pem", ".key", ".p12", ".pfx"}
    if env or private_dir or credential or private_key:
        blocked.append(value)
if blocked:
    print("Private file paths must not be tracked:", *blocked, sep="\n", file=sys.stderr)
    sys.exit(1)
print("Tracked file paths: no private configuration or harness data.")
