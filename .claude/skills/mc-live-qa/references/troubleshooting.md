# Troubleshooting (symptom -> cause -> fix)

| Symptom | Cause | Fix |
|---|---|---|
| Pause menu comes back about 0.5 s after closing it | unfocused window + `pauseOnLostFocus` (`Minecraft#pauseIfInactive`) | `spEnsureInGame()` (sets it false in memory, `onClose()`, re-checks after 800 ms) |
| Every `sync{}` / wrapper call takes ~1 s; snapshot fps 1 | vsync on + unfocused/occluded window (compositor throttling); AFK limiter after 60 s idle | `SP_FAST=1` (vsync off in memory + `onInputReceived()`), measured 33 ms/hop; the runner restores at exit, ad-hoc users call `spRestoreDisplay()` |
| `options.txt` now has `enableVsync:false` | the game persisted options while spFast had vsync off (observed) | `spRestoreDisplay()` restores the remembered value AND saves; if the binding was lost, set it back by hand (`mc.options.enableVsync().set(true); mc.options.save()`) |
| Holding attack does not break blocks | mouse not grabbed while unfocused; `continueAttack` needs the grab | `spBreak(x,y,z)` (gameMode start/continue destroy) |
| Held movement keys stop | any opened screen calls `KeyMapping.releaseAll()` | `spEnsureInGame()` before `spWalk`/`spHold` (they do it) |
| World creation returns to TitleScreen; log "Failed to load datapacks" + ClassCastException GroovyJavaObject | the dimensions Function returned a bridge wrapper | return `spRaw(...)`, pass raw keys (already in the lib) |
| Reopening the test world shows BackupConfirmScreen | world made with a non-stable preset (FLAT_ALL_DIMENSIONS) | the lib uses `WorldPresets.FLAT`; `spOpenWorld` cancels the prompt and reports it. Delete and recreate only `sp-test-flat` (yours), never a maintainer world |
| `saves/sp-test-flat/` exists with only `session.lock` + empty `datapacks/` | an aborted create | `spCreateTestWorld` removes exactly that stub shape; anything else is reported, not deleted |
| A killed mob is still in `spNearby` for ~1 s | death animation: the client entity lingers with `alive=false` | `spNearby` filters `alive`; `spClearArena` kills mobs, waits 1.2 s, then kills items/xp |
| Zombie loses health in a day scenario | sunlight burning | helmet: `item replace entity <zombie> armor.head with minecraft:leather_helmet` |
| `No signature of method: format for class: java.util.Date` | Groovy 5 without groovy-dateutil | `java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern(...))` |
| `No such property: groovy` | groovy-json is not on the bridge classpath | `spJson(...)` from the lib |
| `No method 'getDayTime()'` | 26.2 replaced day time with clocks | `level.getOverworldClockTime()` |
| `No method 'getChat()' on Gui` | 26.2 Gui API changed | bridge request `chatHistory` (`bridge.py raw chatHistory '{"limit":8}'`) or `mc_chat_history` |
| bridge.py exit 5 | bridge answers from another gameDir | only the dev instance `mod/run` is allowed; `SP_EXPECT_GAMEDIR=any` exists for deliberate exceptions |
| `dev-client.sh start` REFUSED | a dev game JVM of this repo or a bridge port is already up | one instance at a time; ask the human before touching it |
| Run fails with `setup` and `status: FAILED` | a setup command was rejected (typo, bad NBT, selector found nothing for `data`/`item`) | read `failed.feedback` and `failed.line`; widen selectors (`distance=..24`) |
| `SP_GUARD: refusing ... in world 'X'` | the open world is not `sp-test*` | `spEnsureInWorld('sp-test-flat')` / `# needs: test-world`; override only on the human's request (`SP_ALLOW_ANY_WORLD=1`, logged) |
| `connection closed by bridge` mid-run, most often during close/reopen at ~1 fps | the bridge drops the WebSocket around a world reload; the script keeps running | the runner waits for `qa-runs/<runId>.report.json` (`recovered`); or run with `SP_FAST=1` |
| Player dies in a survival scenario (DeathScreen) | a monster had time to attack (slow mode) | kill or move monsters before `gamemode survival`; `spEnsureInGame` respawns |
| Script dies near 5 s | per-call `timeoutMs` missing (bridge.py default is 10 s; MCP default is 10 s) | pass `--timeout`/`timeoutMs` (max 300000); the debugbridge.json 5000 does not cap it |
| Relative `~` coordinates are off by one in Y | commands run at the server-side player position (feet block) | read the position with `spBlockPos()` after setup; assert on entities/blocks found, not on exact Y |
