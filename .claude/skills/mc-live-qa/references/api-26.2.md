# Minecraft 26.2 client API facts used by sp-lib.groovy

Mojang names, read in decompiled 26.2 source (mcdev-mcp cache) and then exercised live on 2026-10-19 unless marked
SOURCE-ONLY. The bridge is DebugBridge 2.1.0 (Groovy 5).

## Screens, focus, pause
- Screens live in `Gui`: `mc.gui.screen()` and `mc.gui.setScreen(Screen)`. Close generically with `screen.onClose()`.
  Container screens also send the close packet.
- `Minecraft#pauseIfInactive`: when the window is unfocused and `options.pauseOnLostFocus` is set, PauseScreen
  reopens 500 ms after any close. Live: reopened 1.5 s after `setScreen(null)`. The fix is
  `mc.options.pauseOnLostFocus = false` (public field, in memory), then `onClose()`.
- `MouseHandler#grabMouse` does nothing while the window is unfocused, so attack keys never break blocks. Use
  `mc.gameMode.startDestroyBlock(BlockPos, Direction)`, then call `continueDestroyBlock(pos, dir)` once per tick
  until the block is air, then `stopDestroyBlock()`.
- Frame pacing: `sync{}` runs on the next frame. `FramerateLimitTracker` throttles AFK clients (no input for 60 s:
  30 fps; 10 min: 10 fps) and `onInputReceived()` resets that. With vsync on and an unfocused window the
  compositor delivered 1 fps. `options.enableVsync().set(false)` brought it to 30 fps (the limit in maxFps).
- `mc.isWindowActive()`, `mc.mouseHandler.isMouseGrabbed()`, `mc.isPaused()`.

## Input
- Movement: `mc.options.keyUp/keyDown/keyLeft/keyRight/keyJump/keyShift/keySprint.setDown(bool)`. Opening any
  screen calls `KeyMapping.releaseAll()`.
- Look: `player.setYRot/setXRot/setYHeadRot` plus fields `yRotO/xRotO`. The value was stable 1 s later.
- Place: `mc.gameMode.useItemOn(player, InteractionHand.MAIN_HAND, new BlockHitResult(Vec3, Direction, BlockPos, false))`.
- Inventory: `mc.gameMode.handleContainerInput(containerId, slot, button, ContainerInput.X, player)`. `ContainerInput`
  is `net.minecraft.world.inventory.ContainerInput` (PICKUP, QUICK_MOVE, SWAP, CLONE, THROW, QUICK_CRAFT,
  PICKUP_ALL). Player inventory menu = container 0. Result slot 0, 2x2 grid slots 1..4, main 9..35, hotbar 36..44.
  Live: a log in slot 36, one right-click into slot 1, then QUICK_MOVE on slot 0 gave 4 planks, and the server agreed.

## Commands
- `mc.player.connection.sendCommand('time set day')` (no leading slash) runs as the player, with cheats on.
- 26.2 gamerule ids are snake_case: `advance_time`, `advance_weather`, `spawn_mobs`, `spawn_monsters`,
  `mob_griefing`, `keep_inventory`, `send_command_feedback`, ...
- No `Level#getDayTime()` in 26.2. Use `level.getOverworldClockTime()` (and `getGameTime()`).
- Vanilla taming without NBT tricks: `data modify entity <wolf> Owner set from entity @s UUID`. Loading the
  entity's data calls `setTame(true)`.
- Creeper NBT: `ExplosionRadius` (byte), `Fuse` (short = maxSwell), `ignited`, `powered`.
- `/place template <ns:name> <pos>` works on templates held in memory (structure block SAVE fired by a
  redstone block) and on bundled ones (`minecraft:igloo/top`): chat said "Loaded template". SOURCE-ONLY: a
  redstone-triggered save is memory-only (`StructureBlock` calls `saveStructure(false)`). The structure block
  UI "SAVE" button writes `<world>/generated/<ns>/structure/<name>.nbt`. Datapacks ship
  `data/<ns>/structure/<name>.nbt`. Copying a saved `.nbt` into another world's `generated/` or a datapack
  is UNVERIFIED.

## World lifecycle
- Open a saved world: `mc.createWorldOpenFlows().openWorld(levelId, {} as Runnable)` inside `sync{}`. It took about 4 s.
- Close: `mc.disconnectFromWorld(ClientLevel.DEFAULT_QUIT_MESSAGE)` (the PauseScreen "Save and Quit" path) lands
  on TitleScreen.
- Create: `WorldOpenFlows#createFreshLevel(levelId, LevelSettings, WorldOptions, Function<HolderLookup.Provider,
  WorldDimensions>, Screen parent)`. `LevelSettings(name, GameType, LevelSettings.DifficultySettings(Difficulty,
  hardcore, locked), allowCommands, WorldDataConfiguration.DEFAULT)`, `WorldOptions(seed, structures, bonusChest)`.
  - Use the `WorldPresets.FLAT` preset (`reg.lookupOrThrow(Registries.WORLD_PRESET).getOrThrow(FLAT).value()
    .createWorldDimensions()`). `WorldPresets.createTestWorldDimensions` (FLAT_ALL_DIMENSIONS) is not
    `Lifecycle.stable()`, so every reopen shows BackupConfirmScreen.
  - The Function runs outside bridge dispatch. Pass it raw objects and return raw objects (`getTarget()`),
    otherwise you get a ClassCastException GroovyJavaObject -> WorldDimensions, or MissingMethodException.
- Current world folder: `mc.getSingleplayerServer().storageSource.getLevelId()`.

## Bridge / Groovy sandbox
- `evaluate(new File(path))` and `new GroovyShell()` are allowed. Closures assigned without `def` persist across
  calls. `sync`, `java`, `mc`, `player` resolve inside evaluated files. Use `mc.player`/`mc.level`, not the
  pre-bound `player`/`level`, after a world change.
- Groovy 5 here has no `Date.format` and no `groovy.json` (`ClassNotFoundException`). Use `java.time` and the
  library's `spJson`.
- `execute` honours a per-call `timeoutMs` (1000..300000). A 20 s sleep ran with `timeoutMs` 30000, and a 2 s
  timeout killed a 4 s script.
- `screenshot` returns `{path,width,height}` of a JPEG written by the mod (427x240 at downscale 2). Chat:
  request type `chatHistory`.
