#!/usr/bin/env bash
# Run a live-QA scenario against the RUNNING dev client through DebugBridge (no MCP needed).
# usage: bash scripts/qa/run-bridge-scenario.sh <name|path> [--repeat N] [--seed S] [--no-lint]
#   <name> resolves to scripts/qa/bridge/scenarios/<name>.cmds (setup, vanilla commands) and/or <name>.groovy
#   (assertions, ends with `return spReport()`). Both run in ONE bridge call per repetition.
#   --repeat N: run N times (setup is re-run each time); --seed S: run i gets SP_SEED = S + i - 1 (default: random).
#   The seed is ONLY the SP_SEED value scenarios may use (positions, choices); world RNG, mob AI and timing are NOT
#   seeded, so a repeat explores real variation and a "same seed" rerun is not a replay.
#   Env: SP_FAST=1 (vsync off in memory for speed, restored at exit), SP_ALLOW_ANY_WORLD=1 (lift the sp-test* guard,
#   logged). The runner ALWAYS calls spRestoreDisplay() at exit (also on failure/interrupt).
# Output: per-run JSON in mod/run/qa-runs/<stamp>-<name>/run-<i>.json, a summary JSON on stdout.
# Exit: 0 all runs ok; 1 a run failed an expectation; 2 bridge/script error; 3 no bridge; 64 usage; 65 lint failed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
B="$ROOT/scripts/qa/bridge"
name=""; repeat=1; seed=""; lint=1
while [ $# -gt 0 ]; do
  case "$1" in
    --repeat) repeat="${2:?}"; shift 2 ;;
    --seed) seed="${2:?}"; shift 2 ;;
    --no-lint) lint=0; shift ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    *) [ -z "$name" ] || { echo "unexpected arg: $1" >&2; exit 64; }; name="$1"; shift ;;
  esac
done
[ -n "$name" ] || { echo "usage: $0 <scenario> [--repeat N] [--seed S]" >&2; exit 64; }
[[ "$repeat" =~ ^[0-9]+$ ]] && [ "$repeat" -ge 1 ] || { echo "--repeat must be >= 1" >&2; exit 64; }
[ -n "$seed" ] || seed=$(( $(date +%s) % 100000 ))
[[ "$seed" =~ ^-?[0-9]+$ ]] || { echo "--seed must be an integer" >&2; exit 64; }

base="${name%.cmds}"; base="${base%.groovy}"
[ -e "$base.cmds" ] || [ -e "$base.groovy" ] || base="$B/scenarios/$base"
cmds="$base.cmds"; groovy="$base.groovy"
[ -e "$cmds" ] || cmds=""; [ -e "$groovy" ] || groovy=""
[ -n "$cmds$groovy" ] || { echo "no scenario files for '$name' (looked for $base.cmds / .groovy)" >&2; exit 64; }
sname="$(basename "$base")"
[[ "$sname" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "scenario name must match ^[A-Za-z0-9_-]+\$: $sname" >&2; exit 64; }

if [ "$lint" = 1 ]; then
  python3 "$B/lint-scenario.py" ${cmds:+"$cmds"} ${groovy:+"$groovy"} >&2 || exit 65
fi
timeout_ms=120000
if [ -n "$groovy" ]; then
  t=$(sed -n 's|^//[[:space:]]*timeoutMs:[[:space:]]*\([0-9]*\).*|\1|p' "$groovy" | head -1)
  [ -n "$t" ] && timeout_ms="$t"
fi

out="$ROOT/mod/run/qa-runs/$(date +%Y%m%d-%H%M%S)-$sname"
mkdir -p "$out"
restore() {  # put back every client option the library changed (vsync, pauseOnLostFocus); best effort
  python3 "$B/bridge.py" exec --lib --timeout 60000 -e 'return spRestoreDisplay()' > "$out/restore.json" 2>&1 || true
}
trap restore EXIT
b64() { printf '%s' "$1" | base64 -w0; }   # paths/names reach Groovy as base64 data, never as code
fails=(); worst=0
for i in $(seq 1 "$repeat"); do
  s=$(( seed + i - 1 ))
  f="$out/run-$i.groovy"
  {
    echo "SP_SEED = ${s}L; SP_RUN = $i"
    echo "def __d = { String b -> new String(java.util.Base64.getDecoder().decode(b), 'UTF-8') }"
    echo "spBegin(__d('$(b64 "$sname-r$i")'))"
    if [ -n "$cmds" ]; then
      echo "def __setup = spRunCmds(__d('$(b64 "$cmds")'))"
      echo "spExpect('setup', __setup.ok, __setup)"
      echo "if (!__setup.ok) return spReport()"
    fi
    if [ -n "$groovy" ]; then cat "$groovy"; else echo "return spReport()"; fi
  } > "$f"
  set +e
  t_start=$(date +%s)
  python3 "$B/bridge.py" exec --lib -f "$f" --timeout "$timeout_ms" > "$out/run-$i.json"
  rc=$?
  if [ "$rc" -eq 2 ] && grep -q 'connection closed' "$out/run-$i.json"; then
    # the script keeps running in the game; wait for the report file spReport() writes (runId ends with -<name>-r<i>)
    echo "run $i: bridge connection dropped (world reload?); waiting for the on-disk report" >&2
    rep=""
    while [ $(( $(date +%s) - t_start )) -lt $(( timeout_ms / 1000 + 10 )) ]; do
      rep=$(find "$ROOT/mod/run/qa-runs" -maxdepth 1 -name "*-$sname-r$i.report.json" -newer "$f" 2>/dev/null | head -1)
      [ -n "$rep" ] && break; sleep 2
    done
    if [ -n "$rep" ]; then
      python3 - "$rep" "$out/run-$i.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
json.dump({"ok": bool(r.get("ok")), "result": r, "recovered": "from on-disk report after a dropped bridge connection"}, open(sys.argv[2], "w"))
PY
      if python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1]))["ok"] else 1)' "$out/run-$i.json"; then rc=0; else rc=1; fi
    fi
  fi
  set -e
  if [ "$rc" -ne 0 ]; then
    fails+=("$i"); [ "$rc" -gt "$worst" ] && worst=$rc
    python3 "$B/bridge.py" screenshot --out "$out/run-$i-fail.jpg" > /dev/null 2>&1 || true
  fi
  echo "run $i/$repeat seed=$s exit=$rc" >&2
done

python3 - "$out" "$repeat" "$seed" "$sname" "${fails[*]:-}" <<'PY'
import json, os, sys
out, n, seed, name, fails = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split()
first = None
for i in fails:
    try:
        r = json.load(open(os.path.join(out, "run-%s.json" % i)))
    except Exception as e:
        r = {"error": "unreadable report: %s" % e}
    res = r.get("result") if isinstance(r.get("result"), dict) else {}
    bad = [s for s in res.get("steps", []) if not s.get("ok")]
    shot = os.path.join(out, "run-%s-fail.jpg" % i)
    first = {"run": int(i), "error": r.get("error"), "failedSteps": bad[:3],
             "screenshot": shot if os.path.exists(shot) else None}
    break
print(json.dumps({"ok": not fails, "scenario": name, "runs": n, "passed": n - len(fails),
                  "passRate": round((n - len(fails)) / n, 3), "seed": seed,
                  "failedRuns": [int(x) for x in fails], "firstFailure": first, "reports": out},
                 separators=(",", ":")))
PY
if [ "${#fails[@]}" -gt 0 ]; then [ "$worst" -eq 1 ] && exit 1; exit "$worst"; fi
exit 0
