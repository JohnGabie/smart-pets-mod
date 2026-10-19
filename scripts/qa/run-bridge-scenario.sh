#!/usr/bin/env bash
# Run a live-QA scenario against the RUNNING dev client through DebugBridge (no MCP needed).
# usage: bash scripts/qa/run-bridge-scenario.sh <name|path> [--repeat N] [--seed S] [--no-lint]
#   <name> resolves to scripts/qa/bridge/scenarios/<name>.cmds (setup, vanilla commands) and/or <name>.groovy
#   (assertions, ends with `return spReport()`). Both run in ONE bridge call per repetition.
#   --repeat N: run N times (setup is re-run each time); --seed S: run i gets SP_SEED = S + i - 1 (default: random).
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
fails=(); worst=0
for i in $(seq 1 "$repeat"); do
  s=$(( seed + i - 1 ))
  f="$out/run-$i.groovy"
  {
    echo "SP_SEED = ${s}L; SP_RUN = $i"
    echo "spBegin('$sname-r$i')"
    if [ -n "$cmds" ]; then
      echo "def __setup = spRunCmds('$cmds')"
      echo "spExpect('setup ($(basename "$cmds"))', __setup.ok, __setup)"
      echo "if (!__setup.ok) return spReport()"
    fi
    if [ -n "$groovy" ]; then cat "$groovy"; else echo "return spReport()"; fi
  } > "$f"
  set +e
  python3 "$B/bridge.py" exec --lib -f "$f" --timeout "$timeout_ms" > "$out/run-$i.json"
  rc=$?
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
