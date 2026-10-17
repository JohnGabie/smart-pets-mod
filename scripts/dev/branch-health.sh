#!/usr/bin/env bash
# Read-only branch health report. Never deletes anything. Usage: bash scripts/dev/branch-health.sh [stale_days=14]
set -euo pipefail
STALE="${1:-14}"
git fetch -q --prune origin 2>/dev/null || echo "(fetch failed: offline?)"
now=$(date +%s)
echo "== Remote branches (age, ahead/behind vs origin/main, merged?)"
git for-each-ref --format='%(refname:short)|%(committerdate:unix)' refs/remotes/origin | grep -v 'origin/HEAD' | while IFS='|' read -r ref ts; do
  [ "$ref" = "origin/main" ] && continue
  age=$(( (now - ts) / 86400 ))
  ab=$(git rev-list --left-right --count origin/main..."$ref" 2>/dev/null | awk '{print "behind "$1", ahead "$2}')
  merged=$(git merge-base --is-ancestor "$ref" origin/main && echo "MERGED" || echo "open")
  flag=""; [ "$merged" = "open" ] && [ "$age" -ge "$STALE" ] && flag="  <-- STALE"
  printf '%-45s %3sd  %-22s %s%s\n' "$ref" "$age" "$ab" "$merged" "$flag"
done
echo; echo "== Local branches not on origin"
git for-each-ref --format='%(refname:short)' refs/heads | while read -r b; do git show-ref --verify --quiet "refs/remotes/origin/$b" || echo "  $b (local only: back it up / push it)"; done
echo; echo "== Archive tags"; git tag -l 'archive/*' | sed 's/^/  /' | head -50
echo; echo "== Open PRs"; gh pr list --state open --json number,title,headRefName,updatedAt -q '.[] | "  #\(.number) \(.headRefName)  \(.title)  (updated \(.updatedAt[:10]))"' 2>/dev/null || echo "  (gh unavailable)"
echo; echo "Suggestion only: merged branches may be archived (tag archive/<name>) then deleted, with human OK."
