#!/usr/bin/env bash
# usage: check-screenshot.sh <png> -> exit 0 only if the image has real content
set -euo pipefail
f="$1"; [ -s "$f" ] || { echo "missing/empty: $f" >&2; exit 2; }
stats=$(ffmpeg -v error -i "$f" -vf "signalstats,metadata=mode=print:file=-" -frames:v 1 -f null - 2>&1 | tr -d '\r')
ymin=$(echo "$stats" | sed -n 's/.*signalstats.YMIN=\([0-9.]*\).*/\1/p' | head -1)
ymax=$(echo "$stats" | sed -n 's/.*signalstats.YMAX=\([0-9.]*\).*/\1/p' | head -1)
[ -n "$ymin" ] && [ -n "$ymax" ] || { echo "could not read stats" >&2; exit 3; }
awk -v a="$ymin" -v b="$ymax" 'BEGIN{ exit !((b-a) >= 40) }' \
  && echo "OK range=$ymin..$ymax" || { echo "BLANK range=$ymin..$ymax" >&2; exit 1; }
