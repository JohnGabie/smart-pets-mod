# Live QA bridge toolkit (DebugBridge, MC 26.2)

Drives a RUNNING dev client (gameDir `mod/run`, offline dev account, DebugBridge 2.1.0 in `mod/run/mods/`) from plain
shell, with no MCP needed. Live results are exploratory evidence. Acceptance still needs a headless client GameTest
or another cited oracle (ADR-0002).

| File | What |
|---|---|
| `../dev-client.sh` | start (`--headless`) / wait / status / stop an agent-owned dev client (pidfile, process group, never touches a client it did not start) |
| `bridge.py` | stdlib-only DebugBridge client (own RFC 6455 code): `status`, `wait`, `exec -f/-e [--lib] [--timeout ms]`, `snapshot`, `screenshot [--out]`, `wait-in-world`, `raw <type>` (refuses quit/disconnect/joinServer) |
| `sp-lib.groovy` | helper library, loaded into the persistent Groovy binding (`exec --lib` does `evaluate(new File(...))`) |
| `scenarios/*.cmds` | setup as PLAIN VANILLA COMMANDS, one per line, run as the player (`~`, `@s`); `#` comments; `# wait N ticks` / `# wait N ms`; header `# needs: test-world` or `in-world` |
| `scenarios/*.groovy` | assertions next to the `.cmds` file (`spNearby`/`spInfo`/`spExpect`), header `// timeoutMs: N`, ends with `return spReport()` |
| `scenarios/INDEX.md` | scenario catalog. Search it before writing a new scenario |
| `lint-scenario.py` | static checks for `.cmds` and `.groovy` (the runner runs it first) |
| `../run-bridge-scenario.sh` | `<name> [--repeat N] [--seed S]`: runs setup + assertions in ONE bridge call per run, saves per-run JSON, prints a summary |

## Commands (all were run against the live client on 2026-10-19)
```
bash scripts/qa/run-bridge-scenario.sh smoke-world                  # one run, JSON summary, exit 0/1/2
bash scripts/qa/run-bridge-scenario.sh smoke-world --repeat 3 --seed 7   # run i gets SP_SEED = 7 + i - 1
python3 scripts/qa/bridge/bridge.py exec --lib -e 'return spInfo()'
python3 scripts/qa/bridge/bridge.py screenshot --out /tmp/shot.jpg && bash scripts/qa/check-screenshot.sh /tmp/shot.jpg
python3 scripts/qa/bridge/lint-scenario.py scripts/qa/bridge/scenarios/smoke-world.*
bash scripts/qa/dev-client.sh status
```
Reports: `mod/run/qa-runs/<stamp>-<name>/run-<i>.json` (+ `run-<i>-fail.jpg` on failure). Every helper also appends
JSONL to `mod/run/qa-runs/<runId>.jsonl`. `mod/run/` is git-ignored.

Exit codes. bridge.py: 0 ok, 1 result `ok:false`, 2 bridge/script error, 3 no bridge, 4 timeout, 5 gameDir is not
`mod/run` (override with `SP_EXPECT_GAMEDIR=any`), 64 usage. Runner: same codes, plus 65 when lint fails.
dev-client.sh: 0 ok, 1 refused, 2 failed, 4 timeout, 64 usage.

## Writing a scenario
1. Search `scenarios/INDEX.md` first. Reuse or extend an existing scenario.
2. `<name>.cmds`: headers `# scenario:`, `# purpose:`, `# needs:`, `# covers:` (spec link), then vanilla commands.
   Tamed pet with vanilla commands only: `summon minecraft:wolf ~3 ~ ~ {PersistenceRequired:1b}` then
   `data modify entity @e[type=minecraft:wolf,distance=..6,limit=1,sort=nearest] Owner set from entity @s UUID`.
   Zombies burn in daylight. Give them a helmet: `item replace entity @e[type=minecraft:zombie,...] armor.head with minecraft:leather_helmet`.
3. `<name>.groovy`: assertions only, outside `sync{}` except for reads. `SP_SEED` and `SP_RUN` are set (use them to vary positions).
4. Add a row to `scenarios/INDEX.md`. Run with `--repeat` to find flaky behavior.

## Helper status (live, dev client on the maintainer's desktop, window unfocused, 2026-10-19)
VERIFIED = run live by the author with the result shown. UNVERIFIED = written but not exercised. Evidence: the JSON
results quoted in `MODLOG.md` (2026-10-19 entry). Raw logs are in `mod/run/qa-runs/` (local only).

| Helper | Status | Evidence (short) |
|---|---|---|
| `spBegin/spLog/spExpect/spStep/spReport` | VERIFIED (spStep UNVERIFIED) | JSONL lines parse; report `{ok,runId,ms,setup,steps}` |
| `spInfo` | VERIFIED | screen/pos/gamemode/focused/grabbed/paused/clock |
| `spFast` / `spRestoreDisplay` | VERIFIED | `sync{}` hop 1000 ms (vsync on, unfocused) -> 33 ms (vsync off + AFK reset); restore needs the saved original (see gotchas) |
| `spEnsureInGame` | VERIFIED | PauseScreen re-opened 1.5 s after `setScreen(null)` with `pauseOnLostFocus=true`; with snippet A: `closed:[PauseScreen]`, screen null at 0.8 s and 3 s, unfocused |
| `spWorlds` | VERIFIED | `["New World","sp-test-flat"]` |
| `spCloseWorld` | VERIFIED | `disconnectFromWorld(DEFAULT_QUIT_MESSAGE)` -> TitleScreen (9 ms to ack, test world in smoke runs) |
| `spCreateTestWorld` | VERIFIED | `createFreshLevel` + stable FLAT preset: in world in 4.1 s, CREATIVE, y=4 flat |
| `spOpenWorld` | VERIFIED | reopen of `sp-test-flat` in the smoke runs (6/6); cancels a BackupConfirmScreen instead of confirming it |
| `spEnsureInWorld` / `spWaitInWorld` | VERIFIED | via `spRunCmds` (`# needs: test-world`) |
| `spCommand` | VERIFIED | `player.connection.sendCommand` (no slash); `time set night/day` -> clock 13005/1005 |
| `spTime/spWeather/spDifficulty/spGamerule` | VERIFIED | rain on/off observed via `level.isRaining()`; difficulty EASY read back; gamerules accepted (chat) |
| `spGamemode` | VERIFIED | SURVIVAL/CREATIVE read back from `gameMode.getPlayerMode()` |
| `spGive/spClearInventory` | VERIFIED | via craft test (1 log in, 0 left) |
| `spTeleportSetup/spSetBlock/spFill` | VERIFIED | blocks read back (`dirt`, `glass`, `smooth_stone`) |
| `spArena` | VERIFIED | floor smooth_stone, wall glass read back |
| `spClearArena` | VERIFIED | after the fix (kill mobs, wait 1.2 s, kill items/xp): only the player left |
| `spSummon/spSummonPet/spSummonMonster` | VERIFIED | wolf+cat tame/ownedByMe true; zombie, skeleton, creeper (ExplosionRadius 0, Fuse 32767), spider uuids returned |
| `spKillEntities` | VERIFIED | by type and by uuid (dead mobs linger ~20 ticks client-side with alive=false; spNearby filters them) |
| `spNearby` | VERIFIED | type/pos/health/tame/owner/ownedByMe |
| `spRunCmds` | VERIFIED | smoke-world.cmds: 20 commands, `# wait`, `# needs` |
| `spWalk` | VERIFIED | forward 3.19 blocks in 867 ms, key released after |
| `spHold` | VERIFIED (jump height not measured) | `keyJump` held 300 ms, no error |
| `spLook` | VERIFIED | (90, 20) unchanged 1 s later |
| `spLookAt` | VERIFIED | used by spBreak/spPlace (aim not measured on its own) |
| `spBreak` | VERIFIED | survival dirt by hand: air after 1631 ms / 15 ticks, 1 dirt in inventory; creative stone: 132 ms |
| `spPlace` | VERIFIED | `useItemOn` Success, dirt placed, inventory 1 -> 0 |
| `spClick` | VERIFIED | via spCraft2x2 |
| `spCraft2x2` | VERIFIED (planks only) | 1 oak log -> 4 planks; server-side inventory also 4 (no desync) |
| `spWaitUntil` | VERIFIED | used by all waits above |
| `spInvCount/spBlockId/spBlockPos` | VERIFIED | used above |
| `dev-client.sh status/stop refusal/start refusal/wait` | VERIFIED | refuses with a foreign client up; stop on a foreign client: REFUSED exit 1 |
| `dev-client.sh start/stop` of a real client | UNVERIFIED | mechanics verified with a `sleep` stand-in (pidfile, setsid group, TERM); a real game launch was not run (one instance at a time; the maintainer's client was up) |
