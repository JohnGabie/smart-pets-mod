#!/usr/bin/env bash
# SessionStart hook (source: compact/resume). Re-injects the newest context diary so work can continue.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0
latest="$(ls -1t .journal/*.md 2>/dev/null | head -1 || true)"
[ -n "$latest" ] || exit 0
echo "== Latest context diary ($latest) — read it, then continue from 'Next steps'; do not redo 'Do NOT redo' items =="
head -n 220 "$latest"
exit 0
