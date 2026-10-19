#!/usr/bin/env bash
# Agent-owned dev client lifecycle (gameDir mod/run, offline dev account, DebugBridge from mod/run/mods/).
# usage: bash scripts/qa/dev-client.sh start [--headless] | wait [timeout_s] | status | stop
#   start     launches `./gradlew --no-daemon :mod:runClient` detached in its own session (setsid nohup);
#             --headless wraps it in `env -u WAYLAND_DISPLAY xvfb-run -a` (default: visible window).
#             Refuses if ANY Minecraft client JVM (dev, Prism, vanilla) is running or a bridge port answers.
#   wait      blocks until the bridge answers (default 300 s), exit 4 on timeout.
#   status    prints pidfile/ownership/bridge state (JSON-ish lines), never changes anything.
#   stop      ONLY for a client this script started (pidfile + matching process start times): asks the game to
#             quit through the bridge (only if no foreign client is up and the bridge gameDir is this repo's
#             mod/run), waits, then signals OUR game JVM pids and the leader's process group (by number).
#             Exits 2 if it is still running afterwards. Never touches a client it did not start; never by name.
#   Status: verified with a real game on 2026-10-19 (visible and headless: start, wait, smoke-world, stop).
#   Still unproven: the exit-2 path (a game that survives KILL) and PID-reuse races (tested only with stand-ins).
#   Not detected: nothing beyond /proc command lines (a client in a container or another user's session).
# Files: mod/run/qa-runs/dev-client.pid ("<pgid> <starttime>"), mod/run/qa-runs/dev-client-<stamp>.log
# Exit: 0 ok; 1 refused (already running / not ours); 2 failed to start/stop; 4 timeout; 64 usage.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNS="$ROOT/mod/run/qa-runs"
PIDFILE="$RUNS/dev-client.pid"
BRIDGE="$ROOT/scripts/qa/bridge/bridge.py"
GAME_MARK='loom-cache/projects/mod/launch.cfg'   # in the game JVM command line (-Dfabric.dli.config=...)

proc_start() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null || true; }   # field 22 = start time (clock ticks)
proc_ppid() { awk '{print $4}' "/proc/$1/stat" 2>/dev/null || true; }
alive_as() { [ -d "/proc/$1" ] && [ "$(proc_start "$1")" = "$2" ]; }   # pid alive AND same process (not reused)

scan() {  # read-only /proc scan (no pkill/pgrep -f). $1 = repo|any
  local d c
  for d in /proc/[0-9]*; do
    c=$( { tr '\0' ' ' < "$d/cmdline"; } 2>/dev/null || true)   # processes may vanish mid-scan
    case "$1:$c" in
      repo:*"$ROOT/.gradle/$GAME_MARK"*) echo "${d#/proc/}" ;;
      # any Minecraft client JVM (Prism/vanilla/Fabric). A client without DebugBridge is only seen here.
      any:*"$ROOT/.gradle/$GAME_MARK"*|any:*net.minecraft.client.main.Main*|any:*KnotClient*|any:*org.prismlauncher.EntryPoint*) echo "${d#/proc/}" ;;
    esac
  done
}
game_pids() { scan repo; }

descends_from() {  # pid $1 has ancestor $2 (walks ppid; Gradle may fork a single-use daemon in between)
  local p="$1" n=0
  while [ -n "$p" ] && [ "$p" -gt 1 ] && [ $n -lt 32 ]; do
    [ "$p" = "$2" ] && return 0
    p=$(proc_ppid "$p"); n=$((n + 1))
  done
  return 1
}

bridge_gamedir() { python3 "$BRIDGE" status 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["gameDir"])' 2>/dev/null || true; }
bridge_up() { python3 "$BRIDGE" status >/dev/null 2>&1; }

# pidfile line 1: "<leader pid> <starttime>"; optional line 2: "game <pid> <starttime>" (recorded by `wait`)
leader() { head -1 "$PIDFILE" 2>/dev/null; }
owned_leader() { [ -f "$PIDFILE" ] || return 1; local pg st; read -r pg st < <(leader) || return 1; [[ "$pg" =~ ^[0-9]+$ ]] && alive_as "$pg" "$st"; }
owned_game() {  # recorded game JVM still alive as the same process
  [ -f "$PIDFILE" ] || return 1
  local tag gp gst; read -r tag gp gst < <(sed -n 2p "$PIDFILE") || return 1
  [ "$tag" = game ] && alive_as "$gp" "$gst" && echo "$gp"
}
owned() { owned_leader || owned_game > /dev/null; }
our_games() {  # repo game JVMs that descend from our leader, plus the recorded one
  local pg g; pg=$(leader | cut -d' ' -f1)
  { owned_game || true; for g in $(game_pids); do if owned_leader && descends_from "$g" "$pg"; then echo "$g"; fi; done; } | sort -u
}

cmd_start() {
  local headless=0
  [ "${1:-}" = "--headless" ] && headless=1
  mkdir -p "$RUNS"
  exec 9> "$RUNS/dev-client.lock"
  flock -n 9 || { echo "REFUSED: another dev-client.sh start is in progress" >&2; exit 1; }
  if owned; then echo "already running (ours): $(leader)"; exit 0; fi
  [ -f "$PIDFILE" ] && { echo "stale pidfile removed"; rm -f "$PIDFILE"; }
  local g; g=$(scan any | xargs)
  [ -z "$g" ] || { echo "REFUSED: a Minecraft client JVM is already running (pid $g), not started by this script" >&2; exit 1; }
  bridge_up && { echo "REFUSED: a DebugBridge already answers on 9876-9886 (another client is up)" >&2; exit 1; }
  local log; log="$RUNS/dev-client-$(date +%Y%m%d-%H%M%S).log"
  cd "$ROOT"
  local launch='./gradlew --no-daemon :mod:runClient'
  [ "$headless" = 1 ] && launch='env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew --no-daemon :mod:runClient'
  rm -f "$PIDFILE.new"
  # setsid may fork (when the caller is a group leader), so the new session leader records its OWN pid, then execs
  SP_PIDNEW="$PIDFILE.new" SP_LAUNCH="$launch" setsid bash -c \
    'echo "$$ $(awk "{print \$22}" /proc/$$/stat)" > "$SP_PIDNEW"; eval "exec nohup $SP_LAUNCH"' > "$log" 2>&1 < /dev/null 9>&- &
  for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$PIDFILE.new" ] && break; sleep 0.2; done
  [ -s "$PIDFILE.new" ] || { echo "FAILED: launcher did not start, see $log" >&2; exit 2; }
  mv "$PIDFILE.new" "$PIDFILE"
  sleep 1
  owned_leader || { echo "FAILED: launcher exited at once, see $log" >&2; rm -f "$PIDFILE"; exit 2; }
  echo "started leader $(leader | cut -d' ' -f1) ($([ "$headless" = 1 ] && echo headless || echo visible)); log $log"
  echo "next: bash scripts/qa/dev-client.sh wait"
}

cmd_wait() {
  local t="${1:-300}"
  python3 "$BRIDGE" wait --timeout-s "$t" || { echo "bridge not up after ${t}s (consent screen? crash? see the newest $RUNS/dev-client-*.log)" >&2; exit 4; }
  if owned_leader && ! owned_game > /dev/null; then   # remember our game JVM so stop works even if Gradle exits first
    local g; g=$(our_games | head -1)
    [ -n "$g" ] && { echo "game $g $(proc_start "$g")" >> "$PIDFILE"; echo "recorded game jvm $g"; }
  fi
}

cmd_status() {
  echo "minecraft_jvm_pids: $(scan any | xargs)"
  echo "repo_dev_game_pids: $(game_pids | xargs)"
  if owned; then echo "owned_by_script: yes (leader $(leader | cut -d' ' -f1), games: $(our_games | xargs))"
  elif [ -f "$PIDFILE" ]; then echo "owned_by_script: no (stale pidfile)"
  else echo "owned_by_script: no"; fi
  if bridge_up; then echo "bridge: up, gameDir $(bridge_gamedir)"; else echo "bridge: down"; fi
}

cmd_stop() {
  mkdir -p "$RUNS"
  exec 9> "$RUNS/dev-client.lock"
  flock -n 9 || { echo "REFUSED: another dev-client.sh start/stop is in progress" >&2; exit 1; }
  if ! owned; then
    if [ -f "$PIDFILE" ]; then
      # leader gone and no game recorded: a game we started may still run (Gradle daemons detach), but it cannot be
      # attributed safely. Keep the pidfile and let a human decide.
      if [ -z "$(sed -n 2p "$PIDFILE")" ] && [ -n "$(game_pids)" ]; then
        echo "FAILED: leader $(leader | cut -d' ' -f1) is gone, no game JVM was recorded (run 'wait' after start), and a dev game JVM is running (pid $(game_pids | xargs)): not touching it, pidfile kept" >&2
        exit 2
      fi
      echo "stale pidfile removed (process gone or reused)"; rm -f "$PIDFILE"
    fi
    echo "REFUSED: no client started by this script is running; not touching anything else" >&2; exit 1
  fi
  local pg pgst ours="" foreign="" g grace=5
  read -r pg pgst < <(leader)
  for g in $(our_games); do ours="$ours $g:$(proc_start "$g")"; done   # pid:starttime, re-checked before each signal
  ours="${ours# }"
  for g in $(scan any); do case " $ours " in *" $g:"*) ;; *) foreign="$foreign $g" ;; esac; done
  # graceful `quit` only when: our game JVM exists, NO foreign client is up (the port does not say who answers),
  # and the answering bridge reports this repo's gameDir
  if [ -n "$ours" ] && [ -z "$foreign" ] && [ "$(bridge_gamedir)" = "$ROOT/mod/run" ]; then
    grace=60
    python3 - "$BRIDGE" <<'PY' || true
import importlib.util, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("bridge", sys.argv[1]); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
br = b.Bridge(); print("quit:", br.request("quit", {}, timeout_s=10).get("success")); br.close()
PY
  elif [ -n "$foreign" ]; then echo "foreign client(s) up (pid$foreign): no bridge quit; signals go to our pids only"
  fi
  alive() { local e; for e in $ours; do alive_as "${e%%:*}" "${e#*:}" && return 0; done; alive_as "$pg" "$pgst" && [ -n "$(ps -o pid= -g "$pg" 2>/dev/null)" ]; }
  for _ in $(seq 1 "$grace"); do alive || break; sleep 1; done
  local sig e
  for sig in TERM KILL; do
    alive || break
    echo "still up: SIG$sig to game pid(s) [$ours] and process group $pg"
    for e in $ours; do alive_as "${e%%:*}" "${e#*:}" && kill "-$sig" "${e%%:*}" 2>/dev/null || true; done
    alive_as "$pg" "$pgst" && kill "-$sig" -- "-$pg" 2>/dev/null || true
    for _ in $(seq 1 15); do alive || break; sleep 1; done
  done
  if alive; then echo "FAILED: still running after TERM/KILL (game [$ours], group $pg); pidfile kept" >&2; exit 2; fi
  rm -f "$PIDFILE"; echo "stopped (leader $pg, game [$ours])"
}

case "${1:-}" in
  start) shift; cmd_start "$@" ;;
  wait) shift; cmd_wait "$@" ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  *) sed -n 2,17p "$0"; exit 64 ;;
esac
