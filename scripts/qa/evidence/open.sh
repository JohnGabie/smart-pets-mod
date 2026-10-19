#!/usr/bin/env bash
# Validate the evidence bank, then open the read-only viewer. Never writes data.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
arg=""; [ "${1:-}" = "--example" ] && arg="--example"
bash "$here/check.sh" $arg
url="file://$here/index.html"; [ -n "$arg" ] && url="$url?example=1"
echo "$url"
if command -v xdg-open >/dev/null; then xdg-open "$url" >/dev/null 2>&1 || echo "xdg-open failed; open the URL manually"; else echo "xdg-open not found; open the URL manually"; fi
