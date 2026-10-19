#!/usr/bin/env bash
# Agent-owned dev client lifecycle (gameDir mod/run, offline dev account, DebugBridge from mod/run/mods/).
# usage: bash scripts/qa/dev-client.sh start [--headless] | wait [timeout_s] | status | stop
#   start     launches `./gradlew --no-daemon :mod:runClient` detached in its own session (setsid nohup);
#             --headless wraps it in `env -u WAYLAND_DISPLAY xvfb-run -a` (default: visible window).
#             Refuses if a dev game JVM is already running or a bridge port (9876-9886) answers.
#   wait      blocks until the bridge answers (default 300 s), exit 4 on timeout.
#   status    prints pidfile/ownership/bridge state (JSON-ish lines), never changes anything.
#   stop      ONLY for a client this script started (pidfile + matching process start time): asks the game to
#             quit through the bridge, waits, then signals the process GROUP recorded in the pidfile (by number).
#             Never touches a client it did not start; never kills by name.
# Files: mod/run/qa-runs/dev-client.pid ("<pgid> <starttime>"), mod/run/qa-runs/dev-client-<stamp>.log
# Exit: 0 ok; 1 refused (already running / not ours); 2 failed to start/stop; 4 timeout; 64 usage.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNS="$ROOT/mod/run/qa-runs"
PIDFILE="$RUNS/dev-client.pid"
BRIDGE="$ROOT/scripts/qa/bridge/bridge.py"
GAME_MARK='loom-cache/projects/mod/launch.cfg'   # in the game JVM command line (-Dfabric.dli.config=...)

proc_start() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null || true; }   # field 22 = start time (clock ticks)

game_pids() {  # dev game JVMs of THIS repo, read-only scan of /proc (no pkill/pgrep -f)
  local d c
  for d in /proc/[0-9]*; do
    c=$( { tr '\0' ' ' < "$d/cmdline"; } 2>/dev/null || true)   # processes may vanish mid-scan
    case "$c" in *"$ROOT/.gradle/$GAME_MARK"*) echo "${d#/proc/}";; esac
  done
}

bridge_up() { python3 "$BRIDGE" status >/dev/null 2>&1; }

owned() {  # pidfile exists, its process-group leader is alive and has the recorded start time
  [ -f "$PIDFILE" ] || return 1
  local pg st
  read -r pg st < "$PIDFILE" || return 1
  [[ "$pg" =~ ^[0-9]+$ ]] || return 1
  [ -d "/proc/$pg" ] && [ "$(proc_start "$pg")" = "$st" ]
}

group_alive() { [ -n "$(ps -o pid= -g "$1" 2>/dev/null)" ]; }

cmd_start() {
  local headless=0
  [ "${1:-}" = "--headless" ] && headless=1
  if owned; then echo "already running (ours): pgid $(cut -d' ' -f1 "$PIDFILE")"; exit 0; fi
  [ -f "$PIDFILE" ] && { echo "stale pidfile removed"; rm -f "$PIDFILE"; }
  local g; g=$(game_pids | xargs)
  [ -z "$g" ] || { echo "REFUSED: a dev game JVM is already running (pid $g), not started by this script" >&2; exit 1; }
  bridge_up && { echo "REFUSED: a DebugBridge already answers on 9876-9886 (another client is up)" >&2; exit 1; }
  mkdir -p "$RUNS"
  local log; log="$RUNS/dev-client-$(date +%Y%m%d-%H%M%S).log"
  cd "$ROOT"
  local launch='./gradlew --no-daemon :mod:runClient'
  [ "$headless" = 1 ] && launch='env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew --no-daemon :mod:runClient'
  rm -f "$PIDFILE.new"
  # setsid may fork (when the caller is a group leader), so the new session leader records its OWN pid, then execs
  SP_PIDNEW="$PIDFILE.new" SP_LAUNCH="$launch" setsid bash -c \
    'echo "$$ $(awk "{print \$22}" /proc/$$/stat)" > "$SP_PIDNEW"; eval "exec nohup $SP_LAUNCH"' > "$log" 2>&1 < /dev/null &
  for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$PIDFILE.new" ] && break; sleep 0.2; done
  [ -s "$PIDFILE.new" ] || { echo "FAILED: launcher did not start, see $log" >&2; exit 2; }
  mv "$PIDFILE.new" "$PIDFILE"
  local pid; pid=$(cut -d' ' -f1 "$PIDFILE")
  sleep 1
  owned || { echo "FAILED: launcher exited at once, see $log" >&2; rm -f "$PIDFILE"; exit 2; }
  echo "started pgid $pid ($([ "$headless" = 1 ] && echo headless || echo visible)); log $log"
  echo "next: bash scripts/qa/dev-client.sh wait"
}

cmd_wait() {
  local t="${1:-300}"
  python3 "$BRIDGE" wait --timeout-s "$t" || { echo "bridge not up after ${t}s (consent screen? crash? see the newest $RUNS/dev-client-*.log)" >&2; exit 4; }
}

cmd_status() {
  local g; g=$(game_pids | xargs)
  echo "game_jvm_pids: ${g:-none}"
  if owned; then echo "owned_by_script: yes (pgid $(cut -d' ' -f1 "$PIDFILE"))"
  elif [ -f "$PIDFILE" ]; then echo "owned_by_script: no (stale pidfile)"
  else echo "owned_by_script: no"; fi
  if bridge_up; then echo "bridge: up"; python3 "$BRIDGE" status | head -c 400; echo; else echo "bridge: down"; fi
}

cmd_stop() {
  if ! owned; then
    [ -f "$PIDFILE" ] && { echo "stale pidfile removed (process gone or reused)"; rm -f "$PIDFILE"; }
    echo "REFUSED: no client started by this script is running; not touching anything else" >&2; exit 1
  fi
  local pg; pg=$(cut -d' ' -f1 "$PIDFILE")
  # graceful: DebugBridge `quit` (needs session_control_enabled). Sent ONLY if every running dev game JVM is in
  # our process group: the bridge port does not say which process answers, so a foreign client must not be up.
  local g mine=1 any=0
  for g in $(game_pids); do any=1; [ "$(ps -o pgid= -p "$g" 2>/dev/null | tr -d ' ')" = "$pg" ] || mine=0; done
  local grace=5
  if [ "$any" = 1 ] && [ "$mine" = 1 ] && bridge_up; then
    grace=60
    python3 - "$BRIDGE" <<'PY' || true
import importlib.util, sys
spec = importlib.util.spec_from_file_location("bridge", sys.argv[1]); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
br = b.Bridge(); print("quit:", br.request("quit", {}, timeout_s=10).get("success")); br.close()
PY
  fi
  for _ in $(seq 1 "$grace"); do group_alive "$pg" || break; sleep 1; done
  if group_alive "$pg"; then echo "still up after $grace s: SIGTERM to process group $pg"; kill -TERM -- "-$pg" 2>/dev/null || true
    for _ in $(seq 1 15); do group_alive "$pg" || break; sleep 1; done
  fi
  if group_alive "$pg"; then echo "SIGKILL to process group $pg"; kill -KILL -- "-$pg" 2>/dev/null || true; sleep 1; fi
  group_alive "$pg" && { echo "FAILED to stop process group $pg" >&2; exit 2; }
  rm -f "$PIDFILE"; echo "stopped (pgid $pg)"
}

case "${1:-}" in
  start) shift; cmd_start "$@" ;;
  wait) shift; cmd_wait "$@" ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  *) sed -n 2,12p "$0"; exit 64 ;;
esac
