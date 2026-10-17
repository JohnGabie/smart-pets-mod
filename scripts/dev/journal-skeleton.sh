#!/usr/bin/env bash
# Creates a context diary skeleton in .journal/ (git-ignored) with machine-collected facts.
# The human-facing context sections are left as TODO-CONTEXT markers for the agent to fill BEFORE compaction.
# Usage: bash scripts/dev/journal-skeleton.sh [reason]   -> prints the file path
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
mkdir -p .journal
reason="${1:-pre-compact}"
f=".journal/$(date +%Y-%m-%d-%H%M%S)-$reason.md"
{
echo "# Context diary — $(date '+%Y-%m-%d %H:%M') — $reason"
echo
echo "## Facts collected automatically"
echo "- Branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
echo "- Working tree: $(git status --porcelain | wc -l) changed files"
echo '```'; git status -sb | head -15; echo '```'
echo "- Last commits:"; echo '```'; git log --oneline -n 8; echo '```'
echo "- Worktrees:"; echo '```'; git worktree list; echo '```'
if command -v gh >/dev/null 2>&1; then echo "- Open PRs:"; echo '```'; gh pr list --state open --json number,headRefName,title -q '.[] | "#\(.number) \(.headRefName) \(.title)"' 2>/dev/null || true; echo '```'; fi
echo
cat <<'TPL'
## Context (agent fills every section, then deletes the HTML comment markers)
### 1. Goal and current phase  <!-- TODO-CONTEXT -->
### 2. Decisions made and WHY (include rejected options)  <!-- TODO-CONTEXT -->
### 3. Human preferences and corrections (verbatim where possible)  <!-- TODO-CONTEXT -->
### 4. Done and verified (with evidence: command/output/PR)  <!-- TODO-CONTEXT -->
### 5. In flight (branches, PRs, background agents/tasks and their ids, files being edited)  <!-- TODO-CONTEXT -->
### 6. Next steps, in order  <!-- TODO-CONTEXT -->
### 7. Open questions for the human  <!-- TODO-CONTEXT -->
### 8. Gotchas and commands that worked / failed  <!-- TODO-CONTEXT -->
### 9. Files to re-read first after compaction  <!-- TODO-CONTEXT -->
### 10. Do NOT redo (already done or already decided)  <!-- TODO-CONTEXT -->
### 11. Promote to durable docs (MODLOG / ADR / specs / CLAUDE.md) — list items and whether done  <!-- TODO-CONTEXT -->
TPL
} > "$f"
echo "$f"
