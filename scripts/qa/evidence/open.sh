#!/usr/bin/env bash
# Validate the evidence bank, then open the read-only viewer. Never writes data.
# --example opens example.html (a shim that redirects to index.html?example=1), so
# it works even for xdg-open handlers that drop query strings.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
page="$here/index.html"; arg=""
if [ "${1:-}" = "--example" ]; then page="$here/example.html"; arg="--example"; fi
rc=0; bash "$here/check.sh" $arg || rc=$?
if [ "$rc" -ne 0 ]; then
  if [ -z "$arg" ] && [ ! -f "${EVIDENCE_DIR:-$root/.evidence}/data.js" ]; then
    echo "WARN: no data yet; opening the viewer so its help message shows."
  else
    echo "Not opening: fix the validation errors above." >&2; exit "$rc"
  fi
fi
command -v node >/dev/null || { echo "node not found" >&2; exit 2; }
url="$(node -e 'console.log(require("url").pathToFileURL(process.argv[1]).href)' "$page")"
echo "$url"
if command -v xdg-open >/dev/null; then xdg-open "$url" >/dev/null 2>&1 || echo "xdg-open failed; open the URL manually"; else echo "xdg-open not found; open the URL manually"; fi
