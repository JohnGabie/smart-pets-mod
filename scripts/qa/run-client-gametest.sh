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
for marker in SMARTPETS_S11_OK; do
  grep -q "$marker" mod/build/run/clientGameTest/logs/latest.log || { echo "marker not seen: $marker" >&2; exit 6; }
done
# S11 command guards: exact per-invocation lines from the mod logger (the vanilla echo is ignored via the "(smartpets)" tag).
LOG=mod/build/run/clientGameTest/logs/latest.log
count() { grep -c -E "$1" "$LOG" || true; }
[ "$(count '\(smartpets\) SMARTPETS_TIME ')" = 3 ] || { echo "expected 3 SMARTPETS_TIME invocations" >&2; exit 7; }
[ "$(count '\(smartpets\) SMARTPETS_TIME day=1 clock=25000 game=[0-9]+$')" = 2 ] || { echo "expected 2 plain day=1 clock=25000 lines (overworld + nether)" >&2; exit 8; }
[ "$(count '\(smartpets\) SMARTPETS_TIME day=0 clock=1000 game=[0-9]+ anomaly=CLOCK_BACKWARDS$')" = 1 ] || { echo "expected 1 CLOCK_BACKWARDS line" >&2; exit 9; }
