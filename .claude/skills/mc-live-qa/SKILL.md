---
name: mc-live-qa
description: Drive the RUNNING Smart Pets Minecraft dev client (DebugBridge, gameDir mod/run) in batched, logged scenarios to set up and check in-game situations, such as opening or closing a world, the disposable flat test world, day/night, weather, creative/survival, an arena, summoning a tamed wolf/cat or zombies/skeletons/creepers, walking, looking, breaking/placing blocks, crafting, waiting for a condition, and collecting JSON + screenshot evidence. Use it whenever a QA, review or debugging task needs to see or reproduce behavior in the live game, when the pause menu "won't close", when mc_execute calls are slow, or when a scenario must be repeated to find flaky behavior. Do not use it for headless acceptance tests (Fabric client GameTest, scripts/qa/run-client-gametest.sh), unit tests in core, or the maintainer's personal/Prism profile.
---

# mc-live-qa

Thin entry point. The durable tools are repo scripts, so any agent or model can use them without this skill:
`scripts/qa/bridge/README.md` (formats, helper status), `scripts/qa/bridge/scenarios/INDEX.md` (catalog).

## 1. Safety gate (check before any write action)
- Dev instance only: `python3 scripts/qa/bridge/bridge.py status` must report `gameDir` ending in `mod/run`
  (bridge.py refuses `exec` otherwise, exit 5). Never use the Prism instance or a personal profile.
- Ownership: drive a client only if the maintainer said in this session that the visible client is free to use,
  or you started it yourself. `bash scripts/qa/dev-client.sh start [--headless]` / `wait` / `stop` was run with a real game on 2026-10-19
  (visible and headless: start, wait, smoke-world 1/1, stop; no process, port or pidfile left). Otherwise use read-only calls only (`bridge.py status|snapshot|screenshot|raw chatHistory`).
- Never quit, leave or join on a client you did not start. `dev-client.sh stop` refuses anything it did not start.
- Lint is a safety net, not a sandbox: do not work around it. Flags (`SP_FAST`, `SP_ALLOW_ANY_WORLD`) apply to one
  `bridge.py exec` call only and are reset afterwards.
- World guard: every world-changing helper refuses unless the open world is `sp-test*`.
  `SP_ALLOW_ANY_WORLD=1` overrides it and is logged. Only use it if the human asks.
  One game instance at a time (7 GB RAM): no second client and no GameTest run while a client is up.
- The maintainer's worlds are theirs. Do test work in `sp-test-flat` (disposable, created by the library).
- Teleport, give and kill are SETUP. They are logged as such and never belong in a "no teleport" check.
- Never edit `mod/run/config/debugbridge.json`. The consent screen is clicked by the human.

## 2. Procedure
1. Find the scenario: search `scripts/qa/bridge/scenarios/INDEX.md`. Reuse or extend before writing a new one.
2. Setup goes in `<name>.cmds` as plain vanilla commands, one per line, run as the player (`~`, `@s`). Use
   `# wait N ticks` and `# needs: test-world`. Assertions go in `<name>.groovy`, ending with `return spReport()`.
3. Lint and run: `bash scripts/qa/run-bridge-scenario.sh <name>` (add `--repeat N --seed S` to explore flaky
   behavior; the Groovy side sees `SP_SEED` and `SP_RUN`. Only SP_SEED is seeded, not world RNG or mob AI).
4. Evidence: the summary JSON, `mod/run/qa-runs/<stamp>-<name>/run-<i>.json`, the JSONL log, and screenshots
   (`bridge.py screenshot --out f.jpg` + `bash scripts/qa/check-screenshot.sh f.jpg`). Look at a screenshot
   with the Read tool when the claim is visual.
5. Add or update the INDEX.md row (spec link, status, date). Live results are exploratory: say so, and propose
   a GameTest for anything that must stay true.
6. Ad-hoc `bridge.py exec` calls are not covered by the runner's exit trap: end them with `spRestoreDisplay()`
   if you used `SP_FAST=1`. Leave the client in a world or on the title screen, survival, and report the final state.

## 3. Batching rules (speed)
- One scenario = one bridge call. Never one tool call per game action. `timeoutMs` up to 300000 works: the
  `script.max_execution_time_ms: 5000` in debugbridge.json does not cap a per-call `timeoutMs` (verified 20 s).
- Do game-thread work inside `sync { }`. Sleep and wait OUTSIDE `sync{}`, because a sleep inside it freezes the
  game, and with it ticks and held keys.
- Each `sync{}` hop waits for a frame. An unfocused window with vsync on runs at about 1 fps (1 s per hop; smoke
  takes about 2.5 min). `SP_FAST=1` (env) lets `spFast()` turn vsync off in memory, and smoke drops to about 10 s.
  The runner ALWAYS calls `spRestoreDisplay()` at exit, which restores vsync/pauseOnLostFocus and saves options.
- A failed setup command (red chat feedback that is not a known no-op) fails the run. Read `failed.feedback`.
- At about 1 fps the bridge WebSocket may drop during a world reload while the script keeps running. The runner
  recovers the result from `qa-runs/<runId>.report.json`.
- Ad-hoc call from MCP: `mc_execute` with `evaluate(new File('<repo>/scripts/qa/bridge/sp-lib.groovy'))` once per
  client session (closures persist in the binding), or the shell: `bridge.py exec --lib -e '...'`.

## 4. Step vocabulary (sp-lib.groovy; status per helper in the README)
World: `spWorlds spOpenWorld(name) spCloseWorld() spCreateTestWorld(name,[gamemode,difficulty]) spEnsureInWorld(name)`.
Screen: `spEnsureInGame() spInfo() spFast() spRestoreDisplay()`.
Setup: `spRunCmds(path) spCommand(cmd) spTime spWeather spGamemode spDifficulty spGamerule spGive spClearInventory
spTeleportSetup spSetBlock spFill spArena(size,material) spClearArena spSummon(id,dx,dz,nbt) spSummonPet('wolf'|'cat')
spSummonMonster(kind) spKillEntities(typeOrUuidOrSelector)`.
Read: `spNearby(radius,type) spBlockId spInvCount spBlockPos`.
Act: `spWalk(dir,blocks,ms) spHold(key,ms) spLook(yaw,pitch) spLookAt(x,y,z) spBreak(x,y,z) spPlace(x,y,z)
spClick(cid,slot,button,input) spCraft2x2(srcSlot,[gridSlots],item) spWaitUntil(cond,ms,poll)`.
Assert: `spExpect(name, cond, data)` and then `return spReport()`.

## 5. Report format
Return what the runner prints, and add a short QA note:
```
Scenario: <name> (INDEX row #) — runs N, passRate, seed
Steps failed: <name: data> (first failure)
Evidence: <reports dir>, <screenshot paths>, check-screenshot result
Setup commands used (from report.setup): teleport/give/kill listed
Exploratory (live bridge) — acceptance needs: <GameTest proposal or oracle>
Final client state: <world, gamemode, screen>
```

## 6. References
- `references/api-26.2.md`: verified 26.2 API facts (focus/pause, screens, gameMode, world create/close, commands).
- `references/troubleshooting.md`: symptom -> cause -> fix.
