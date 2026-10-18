#!/usr/bin/env bash
# Warns when the public face of the project (site status, README roadmap) is stale. Exit 1 if stale (usable as a gate).
# Usage: bash scripts/qa/docs-freshness.sh [max_age_days=14]
set -euo pipefail
MAX="${1:-14}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
[ -f site/data/status.json ] || { echo "no site/data/status.json yet"; exit 0; }
upd=$(python3 -c 'import json;print(json.load(open("site/data/status.json"))["updated"])')
age=$(python3 - "$upd" <<'PY'
import sys,datetime
print((datetime.date.today()-datetime.date.fromisoformat(sys.argv[1])).days)
PY
)
stale=0
echo "status.json updated: $upd ($age days ago, limit $MAX)"
[ "$age" -gt "$MAX" ] && { echo "STALE: older than $MAX days"; stale=1; }
last_status=$(git log -1 --format=%ct -- site/data/status.json 2>/dev/null)
[ -n "$last_status" ] || last_status=$(stat -c %Y site/data/status.json)  # untracked: use file mtime
for p in docs/adr docs/spec docs/superpowers/plans specs; do
  [ -e "$p" ] || continue
  t=$(git log -1 --format=%ct -- "$p" 2>/dev/null); [ -n "$t" ] || continue
  if [ "$t" -gt "$last_status" ]; then echo "STALE?: $p changed after the last status.json update (check phases/spikes/dev tab)"; stale=1; fi
done
# README roadmap should mention every phase id/name
python3 - <<'PY' || stale=1
import json,sys
s=json.load(open("site/data/status.json")); r=open("README.md").read()
miss=[p["name"] for p in s["phases"] if p["name"].split("—")[0].strip() not in r]
if miss: print("README missing phases:", miss); sys.exit(1)
PY
[ "$stale" -eq 0 ] && echo "docs-freshness: OK" || { echo "docs-freshness: ACTION NEEDED (update site/data/status.json, README roadmap, dev tab if the spec changed)"; exit 1; }
