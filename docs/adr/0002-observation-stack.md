# ADR-0002: Observation and QA stack for Minecraft 26.2

- Status: Proposed (awaiting human approval). Partly verified: see "Verification state".
- Date: 2026-10-18
- Spike: V0-S0 (`docs/spec/V0-SPIKES.md`)
- Evidence: `MODLOG.md` entries dated 2026-10-18 (S0 Tasks 3 to 6)

## Context
S0 asks whether an agent can build, launch, observe, test and review the mod end to end on the pinned stack (ADR-0001). Oracles over opinion: screenshots, GameTests, logs, the event journal.

## Decision
The observation stack is, in order of trust:
1. **Unit tests in `core`** (JUnit 6, no Minecraft).
2. **Headless Fabric client GameTest under Xvfb + screenshot oracle + log grep** (primary in-game oracle; fully verified).
3. **Dev-only debug commands + event journal** (`/smartpets debug ping`, `EventJournal` in `core`).
4. **mcdev-mcp** (decompiled 26.2 source search) and **mcmodding-mcp** (modding docs) as MCP servers, pinned in `.mcp.json`.
5. **DebugBridge 2.1.0 + mcdev-mcp `mc_*` tools** for live state/screenshot of a running client (installed; not yet verified, consent gate).

## Verification state
| Tool | State | Evidence |
|---|---|---|
| `./gradlew build`, `./gradlew :core:test` | Works | 5 core tests pass (2 boundary + 3 journal) |
| Headless client GameTest + screenshot oracle | Works | `OK range=16..235`, exit 0; a deliberately failing test makes the runner exit 1 |
| Dev command in game | Works | only the `SMARTPETS_DEBUG_PONG` log line was observed; without `-Dsmartpets.dev=true` the command does not exist. The journal entry the command writes is not read back by any in-game test (journal is covered by 3 core unit tests only) |
| `mcdev-mcp init -v 26.2` (CLI) | Works with workarounds | 6513 classes / 537 packages, 402673 call refs |
| mcdev-mcp / mcmodding-mcp as MCP servers in Claude Code | PENDING HUMAN | `claude mcp list`: "Pending approval"; Claude Code must be restarted in the repo and the servers approved |
| DebugBridge port + `mc_*` tools | PENDING HUMAN | mod loads, but no port 9876-9886 opens until a human accepts its first-run consent screen |
| Short video capture (`mc_record_video`) | Not exercised | deferred (S3 or the human check below) |
| Blockbench MCP | Not in S0 | moved to S3 |

## Headless GL findings
- Command: `bash scripts/qa/run-client-gametest.sh`, which runs `env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew :mod:runClientGameTest`, then `scripts/qa/check-screenshot.sh` on the first PNG in `mod/build/run/clientGameTest/screenshots/`, then greps `mod/build/run/clientGameTest/logs/latest.log` for `SMARTPETS_DEBUG_PONG`.
- `WAYLAND_DISPLAY` must be unset (the host is Wayland). No other variable: under Xvfb Mesa picks llvmpipe by itself (`glxinfo -B`: llvmpipe, LLVM 20.1.2, OpenGL 4.5 Core, Mesa 25.2.8). `LIBGL_ALWAYS_SOFTWARE=1` is not needed.
- Screenshots are **854x480** (the game's default window size), not the Xvfb screen size. File names get a counter prefix (`0000_s0-world.png`).
- Time: about 2 minutes on a cold Gradle daemon with cached assets, about 20 s warm.
- Benign noise that does not fail the run: Realms/certificate 401 (offline dev account), "Illegal option value 0 for Anisotropic Filtering", at shutdown "GL ERROR 65547: X11: Standard cursor shape unavailable".
- Oracle (`check-screenshot.sh`): ffmpeg `signalstats`, PASS if luma max - min >= 40. Verified on synthetic images: black and white are BLANK (exit 1), test pattern OK (exit 0), missing file exit 2.
- Runner exit codes: 1 GameTest/Gradle failure or blank image, 2/3 oracle cannot read the file, 4 no screenshot, 5 ping not seen in the log.
- Never run two game instances at once (7 GB RAM machine).

## Client GameTest API (verified, fabric-client-gametest-api-v1 6.0.2+0f4f1dca9e)
Checked with javap and by compiling and running: `ClientGameTestContext#takeScreenshot(String)`, `#getInput() : TestInput`, `#worldBuilder().create() : TestSingleplayerContext` (AutoCloseable), `getConnection().waitForChunksRender()`, `getServer().runCommand(String)` (exercised by the ping test), `waitTicks`. The `TestInput` methods (key/mouse, `lookAt(yaw,pitch)`, `typeChars`) were read in the Fabric API 26.2 sources during planning, not confirmed with javap; no scripted input has been exercised yet. Full list in `MODLOG.md`. Loom `fabricApi { configureTests { ... } }` creates the `gametest` source set and the run `clientGameTest`; configure that run with `loom { runs { configureEach { if (name == "clientGameTest") ... } } }` (declaring `runs { clientGameTest { } }` fails: name already exists).

## mcdev-mcp init recipe (26.2)
```
PATH=<jdk25>/bin:$PATH JAVA_HOME=<jdk25> JAVA_TOOL_OPTIONS=-Xmx3g npx -y mcdev-mcp@2.2.1 init -v 26.2
```
`<jdk25>` is `$HOME/.local/jdk-25` (ADR-0001). Both workarounds are required:
- Without `JAVA_TOOL_OPTIONS=-Xmx3g` the Vineflower decompile child JVM runs with the default heap (about 1.9 GB here) and hangs for 30+ minutes in GC.
- With JDK 17 first on `PATH`, java-callgraph2 fails with `UnsupportedClassVersionError` (class file 69).
The cache lives outside the repo in `~/.cache/mcdev-mcp` (about 1.0 GB). The `-v 26.1` fallback was not needed.

## Package vetting (before trusting)
- `mcdev-mcp` 2.2.1: repo use-ai-for-mc/mcdev-mcp (same org as DebugBridge), MIT, no install scripts. **Caveat:** `init` clones java-callgraph2 from GitHub **unpinned** and builds it with Gradle at init time (network code not covered by the npm pin). Accepted for a dev machine; revisit if the project gets CI.
- `mcmodding-mcp` 0.5.0: repo OGMatrix/mcmodding-mcp, MIT. Its `postinstall` was read in full: it only downloads a docs DB from that repo's GitHub releases, sha256-verified, into `~/.local/share/mcmodding-mcp`. The DB content is trusted as documentation, not as code.
- DebugBridge 2.1.0: MIT, 7.7 MB (embeds Java-WebSocket, groovy, gson), depends on minecraft 26.2. Dev-only: lives in git-ignored `mod/run/mods/`, never in the Prism instance or a personal profile.

## DebugBridge consent gate
At first run DebugBridge shows a developer-mode consent screen ("I Understand - Enable Mod" / "Cancel - Disable Mod"; config key `developerModeAccepted` in `mod/run/config/debugbridge.json`; log "Developer mode not yet accepted, will show warning screen"). Its WebSocket server only starts after acceptance. Agents must not bypass this: the human clicks it once in the dev run dir, or explicitly authorizes pre-seeding that dev config.

## How agents invoke each tool
- Build/test: `./gradlew build`, `./gradlew :core:test`.
- In-game oracle: `bash scripts/qa/run-client-gametest.sh` (exit 0 = world rendered, screenshot not blank, dev ping seen).
- Single image: `bash scripts/qa/check-screenshot.sh <png>`.
- DebugBridge jar: `bash scripts/dev/fetch-debugbridge.sh`; dev client: `env -u WAYLAND_DISPLAY xvfb-run -a ./gradlew :mod:runClient` (boot to title screen verified; bridge pending).
- Decompiled source / docs: MCP tools of `mcdev-mcp` and `mcmodding` once approved (pending).
- Live state: `mc_connect`, `mc_snapshot`, `mc_screenshot` from mcdev-mcp against DebugBridge (pending).
- Stop a game by PID only, never by name.

## Limits and deferred minors
- The runner checks only the first PNG; tests that take several shots must check each or name the one they want.
- The oracle checks only the luma range: weak for dark scenes (a dark cave can fail, a garbled frame with contrast can pass). Use `assertScreenshotEquals/Contains` or a stronger oracle when a scene needs it.
- The runner greps `latest.log` without clearing the logs directory first.
- `enableGameTests = false` until a server GameTest exists (see ADR-0001).
- `EventJournal`: no null contract (null `type` or `data` is not rejected explicitly) and `Entry.data` is a mutable map exposed through `snapshot()`; ping entry tick is a placeholder 0. Fix before S10 relies on it.
- `fetch-debugbridge.sh` (fixed at S0 close): downloads to a temp file, asserts the filename is `debugbridge-26.2-2.1.0.jar`, and moves it into `mod/run/mods/` only after sha512 passes. Still takes `files[0]` of the Modrinth version.
- `install-to-prism.sh`: relative `PRISM_MODS_DIR` is resolved after `cd` to the repo root; old Fabric API jars are not removed on a version bump.
