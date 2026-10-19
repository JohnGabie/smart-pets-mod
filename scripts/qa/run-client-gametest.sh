#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
SHOTS="mod/build/run/clientGameTest/screenshots"
rm -rf "$SHOTS"
env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew :mod:runClientGameTest
shot=$(ls -1 "$SHOTS"/*.png 2>/dev/null | head -1 || true)
[ -n "$shot" ] || { echo "no screenshot produced" >&2; exit 4; }
bash scripts/qa/check-screenshot.sh "$shot"
grep -q "SMARTPETS_DEBUG_PONG" mod/build/run/clientGameTest/logs/latest.log || { echo "ping not seen" >&2; exit 5; }
