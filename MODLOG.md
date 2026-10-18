# MODLOG

Evidence journal. One entry per verified fact or surprise: date, versions that worked, route, how it was verified, gotchas (symptom -> cause -> fix). No game files, no decompiled dumps, no secrets.

## 2026-10-17 — planning facts (verified from public sources, not yet run locally)
- Template branch `26.2` of FabricMC/fabric-example-mod: loader 0.19.5, loom 1.18-SNAPSHOT, fabric_api 0.161.0+26.2, Gradle wrapper 9.7.1, release 25. Fabric's 26.2 post lists Loom 1.17 / Gradle 9.5.1 (discrepancy; follow the template).
- DebugBridge 2.1.0 exists for 26.2 and 26.1.x; NO build for 26.3 (Modrinth API, 2026-10-17). GeckoLib has 26.2 (5.5.5) and 26.3 (5.5.7). Decision: target 26.2.
- Client GameTest API (Fabric API branch 26.2): `ClientGameTestContext#getInput()` returns `TestInput` with key/mouse hold/press, `lookAt(yaw,pitch)`, `lookAt(BlockPos)`, `typeChars`; `TestSingleplayerContext#getServer()` returns `TestServerContext#runCommand(String)`; chunk waiting is `getConnection().waitForChunksRender()` (the docs example using `getClientLevel()` on the context is outdated). Scripted input IS available (answers the earlier open question).
- Machine: 8 cores, ~7 GB RAM; Ubuntu 24.04 Wayland; `xvfb`, `ffmpeg`, `mesa-utils`, `libopenal1`, `sox` installed; Prism not installed yet; flatpak has no remotes configured.
- Screenshot oracle validated with ffmpeg signalstats: black image => range 16..16 (BLANK), test pattern => 16..235 (OK).

## 2026-10-18 — scaffold builds (core + mod)
- Built locally: Minecraft 26.2, loader 0.19.5, loom 1.18-SNAPSHOT, fabric_api 0.161.0+26.2, Gradle 9.7.1 on JDK 25, release 25. `./gradlew :core:test` (2 tests) and `./gradlew build` both pass.
- `net.minecraft.resources.Identifier` and `Identifier.fromNamespaceAndPath` compile as written on 26.2.
- Core is bundled with Jar-in-Jar (`include project(':core')`): jar contains `META-INF/jars/core-0.0.0-dev.jar` and fabric.mod.json lists it under `jars`. No shading needed.
- Gotcha: without `base.archivesName = 'smartpets'` in `mod/build.gradle` the jar would be named `mod-*.jar`; added it so the jar is `smartpets-0.0.0-dev.jar`.
- Gotcha: the Gradle launcher JVM is 17 but the daemon uses JDK 25 via `org.gradle.java.home` in the user-level gradle.properties; this works.
- License in fabric.mod.json is GPL-3.0-or-later (human decision), overriding the brief.

## 2026-10-18 — headless client GameTest runs (S0 Task 3)
- Works: `bash scripts/qa/run-client-gametest.sh` = `env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew :mod:runClientGameTest`, then `scripts/qa/check-screenshot.sh` on the first PNG in `mod/build/run/clientGameTest/screenshots/`. Exit 0, about 2 minutes end to end (asset download was already cached by Gradle/Loom).
- No extra env var needed: under Xvfb Mesa already uses llvmpipe (software, `glxinfo -B`: "llvmpipe (LLVM 20.1.2)", OpenGL 4.5 Core, Mesa 25.2.8). The game logs "Using graphics backend OpenGL ... 4.5 (Core Profile) Mesa 25.2.8". `LIBGL_ALWAYS_SOFTWARE=1` was not needed.
- Screenshot `0000_s0-world.png` (854x480, the default window size, not the Xvfb screen size): superflat world, sky, grass, HUD. Oracle result `OK range=16..235`. Fabric prefixes the file name with a counter (`0000_`).
- Oracle verified first on synthetic images: black 320x180 => `BLANK range=16..16` exit 1; ffmpeg testsrc => `OK range=16..235` exit 0; white => `BLANK range=235..235` exit 1; missing file => exit 2.
- Real API (fabric-client-gametest-api-v1 6.0.2+0f4f1dca9e, inside fabric-api 0.161.0+26.2, checked with javap): `FabricClientGameTest#runTest(ClientGameTestContext)`; `ClientGameTestContext#takeScreenshot(String) : Path`, `#takeScreenshot(TestScreenshotOptions)`, `#assertScreenshotEquals/Contains`, `#getInput() : TestInput`, `#worldBuilder() : TestWorldBuilder`, `#waitTick/waitTicks/waitFor/waitForScreen`, `#runOnClient/computeOnClient`; `TestWorldBuilder#create() : TestSingleplayerContext`, `#createServer()`, `#setUseConsistentSettings`, `#adjustSettings`; `TestSingleplayerContext` (AutoCloseable) `#getConnection() : TestServerConnection`, `#getServer() : TestServerContext`, `#getWorldSave()`; `TestServerConnection#waitForChunksRender()` (also `waitForChunksDownload`, `getClientPlayer`, `getClientLevel`, `getServerLevel`); `TestServerContext#runCommand(String)`. The brief's names matched; no deviation.
- Loom `fabricApi { configureTests { ... } }` creates the `gametest` source set and the tasks `runClientGameTest`, `runGameTest`, `acceptGameTestEula`, `deleteGameTestRunDir`.
- Benign log noise: Realms/certificate 401 (offline dev account), "Illegal option value 0 for Anisotropic Filtering", and at shutdown "GL ERROR 65547: X11: Standard cursor shape unavailable" (Xvfb has no cursor theme). None fail the run.
- Verified: a failing client GameTest fails the runner. With `throw new AssertionError("deliberate")` after the screenshot, the log shows "Client gametests failed with an exception" and `:mod:runClientGameTest FAILED`, the script exits 1, and no OK line prints. Reverted afterward. The runner `cd`s to the repo root, so it works from any cwd (this check was run from another directory).
- Gotcha: `enableGameTests = true` makes Loom hook `runGameTest` (a headless game-test server) into `check`, so `./gradlew build` would launch it (`./gradlew build --dry-run` lists `:mod:runGameTest`). Set to false until a server GameTest exists; with false, the dry run lists no gametest tasks and `./gradlew build` passes.
