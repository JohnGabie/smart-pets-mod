#!/usr/bin/env bash
# Fails if tracked or staged files contain machine paths, e-mails or token-like strings.
set -euo pipefail
files=$(git ls-files; git diff --cached --name-only)
hits=$(echo "$files" | sort -u | xargs -r grep -InE '/home/[a-z0-9_-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|ghp_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{12,}|BEGIN (RSA |EC )?PRIVATE KEY' -- 2>/dev/null \
  | grep -v 'users.noreply.github.com' | grep -v 'noreply@anthropic.com' || true)
if [ -n "$hits" ]; then echo "LEAK CHECK FAILED:"; echo "$hits"; exit 1; fi
echo "leak-check: clean"
