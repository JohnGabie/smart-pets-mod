#!/usr/bin/env bash
# Fails if tracked or staged files contain machine paths, e-mails or token-like strings.
set -euo pipefail
# Excluded: this script and the plan doc embed the regex itself; OFL.txt carries the font author's public email.
excl='^(scripts/qa/leak-check\.sh|docs/superpowers/plans/2026-10-17-v0-s0-toolchain\.md|site/assets/fonts/OFL\.txt)$'
files=$(git ls-files; git diff --cached --name-only)
files=$(echo "$files" | grep -vE "$excl" || true)
hits=$(echo "$files" | sort -u | xargs -r grep -InE '/home/[a-z0-9_-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|ghp_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{12,}|BEGIN (RSA |EC )?PRIVATE KEY' -- 2>/dev/null \
  | grep -v 'users.noreply.github.com' | grep -v 'noreply@anthropic.com' || true)
if [ -n "$hits" ]; then echo "LEAK CHECK FAILED:"; echo "$hits"; exit 1; fi
echo "leak-check: clean"
