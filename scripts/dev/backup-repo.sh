#!/usr/bin/env bash
# Verified backup of the whole repository (all refs) as a git bundle + the local journals.
# Usage: SMARTPETS_BACKUP_DIR=<dir outside the repo> bash scripts/dev/backup-repo.sh   (default: $HOME/backups/smart-pets-mod)
# Keeps the newest KEEP bundles (default 8). Never touches the repository itself.
set -euo pipefail
KEEP="${KEEP:-8}"
DEST="${SMARTPETS_BACKUP_DIR:-$HOME/backups/smart-pets-mod}"
ROOT="$(git rev-parse --show-toplevel)"
case "$DEST" in "$ROOT"|"$ROOT"/*) echo "backup dir must be outside the repository" >&2; exit 1;; esac
mkdir -p "$DEST"
stamp="$(date +%Y%m%d-%H%M%S-%N | cut -c1-19)"
bundle="$DEST/smart-pets-mod-$stamp.bundle"
git -C "$ROOT" bundle create "$bundle" --all
git -C "$ROOT" bundle verify "$bundle" >/dev/null 2>&1
if [ -d "$ROOT/.journal" ]; then tar -C "$ROOT" -czf "$DEST/journal-$stamp.tar.gz" .journal; fi
# prune
ls -1t "$DEST"/smart-pets-mod-*.bundle 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$DEST"/journal-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
echo "backup ok: $bundle ($(du -h "$bundle" | cut -f1)); refs: $(git -C "$ROOT" for-each-ref | wc -l)"
