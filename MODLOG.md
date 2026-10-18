# MODLOG

Evidence journal. One entry per verified fact or surprise: date, versions that worked, route, how it was verified, gotchas (symptom -> cause -> fix). No game files, no decompiled dumps, no secrets.

## 2026-10-17 — planning facts (verified from public sources, not yet run locally)
- Template branch `26.2` of FabricMC/fabric-example-mod: loader 0.19.5, loom 1.18-SNAPSHOT, fabric_api 0.161.0+26.2, Gradle wrapper 9.7.1, release 25. Fabric's 26.2 post lists Loom 1.17 / Gradle 9.5.1 (discrepancy; follow the template).
- DebugBridge 2.1.0 exists for 26.2 and 26.1.x; NO build for 26.3 (Modrinth API, 2026-10-17). GeckoLib has 26.2 (5.5.5) and 26.3 (5.5.7). Decision: target 26.2.
- Client GameTest API (Fabric API branch 26.2): `ClientGameTestContext#getInput()` returns `TestInput` with key/mouse hold/press, `lookAt(yaw,pitch)`, `lookAt(BlockPos)`, `typeChars`; `TestSingleplayerContext#getServer()` returns `TestServerContext#runCommand(String)`; chunk waiting is `getConnection().waitForChunksRender()` (the docs example using `getClientLevel()` on the context is outdated). Scripted input IS available (answers the earlier open question).
- Machine: 8 cores, ~7 GB RAM; Ubuntu 24.04 Wayland; `xvfb`, `ffmpeg`, `mesa-utils`, `libopenal1`, `sox` installed; Prism not installed yet; flatpak has no remotes configured.
- Screenshot oracle validated with ffmpeg signalstats: black image => range 16..16 (BLANK), test pattern => 16..235 (OK).
