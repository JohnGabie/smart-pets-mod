# V0 — Toolchain and Risk Spikes

Goal: before building features, prove the toolchain and the hardest unknowns, so V1 rests on facts. Each spike ends with an ADR in `docs/adr/` (decision, evidence, fallback chosen). A spike is PASS, PASS-WITH-FALLBACK, or FAIL (spec change needed → human decides).
Order is by dependency. Executors work in parallel where marked. No spike code is production code unless the ADR says it graduates.

## Exit criteria for V0
- Every spike has an ADR. Toolchain verified end to end. Spec updated from findings and re-approved. V1 plan written by the architect with the first playable slice.

---
## S0 — Toolchain and QA harness (blocking, do first)
Question: can an agent build, launch, observe, test, and review the mod end to end?
Deliver:
- Pin: Minecraft version, loader, Java, build tool versions, in `CLAUDE.md`/repo. Decide target version using tool support (debug bridge, model library, GeckoLib).
- Scaffold: Gradle multi-project (`core` plain Java, `platform` mod), CI-less local build, unit tests running, one sample GameTest.
- Dev instance: disposable launcher instance, offline/dev account, never the personal profile.
- Observation: in-game debug bridge + MCP (state, screenshot, short video, entities, chat); decompiled-source MCP for the pinned version; modding-docs MCP; Blockbench MCP. Verify each really answers for the pinned version.
- GameTest client run with screenshots, headless if possible (needs virtual display tools installed by the human with sudo).
- Dev-only debug commands (spawn pet with genome, set age/needs, dump record, time warp) and an event journal.
- GitHub flow: branch → PR → reviewer verdict via labels/comments → human merge (repo is private; branch protection unavailable on this plan, rule is convention).
PASS: a trivial mod builds, launches in the dev instance, an agent obtains a screenshot + state through MCP, GameTest produces a screenshot, the reviewer→QA loop runs once on a trivial PR.
Fallback: if a tool fails for the pinned version, choose another tool or version; record in ADR.

### S0 status (2026-10-18): PASS-WITH-FALLBACK for the verified part; PENDING HUMAN VERIFICATION for the rest
Not a full PASS yet. ADRs: [ADR-0001 stack pin](../adr/0001-stack-pin.md), [ADR-0002 observation stack](../adr/0002-observation-stack.md). Evidence: `MODLOG.md`.

Verified (run and observed):
- Pin: Minecraft 26.2 (not 26.3: no DebugBridge build), Fabric Loader 0.19.5, Fabric API 0.161.0+26.2, Loom 1.18-SNAPSHOT, Gradle 9.7.1, Temurin JDK 25 (user-level). Fallbacks taken: Loom 1.18-SNAPSHOT from the template instead of the announced 1.17; JDK in the user's home instead of a system install.
- Scaffold: `core` (plain Java) + `mod` (Fabric), core bundled Jar-in-Jar; `./gradlew build` and `./gradlew :core:test` (5 tests) pass.
- Headless client GameTest: `bash scripts/qa/run-client-gametest.sh` produces a non-blank screenshot (`OK range=16..235`) under Xvfb with Mesa llvmpipe; a failing test fails the runner.
- Dev-only command `/smartpets debug ping` (only with `-Dsmartpets.dev=true`) and the `core` `EventJournal`; the ping is checked by the runner.
- `mcdev-mcp init -v 26.2` indexes the decompiled 26.2 source (needs JDK 25 first on `PATH` and `JAVA_TOOL_OPTIONS=-Xmx3g`).
- Dev client `./gradlew :mod:runClient` boots to the title screen with DebugBridge 2.1.0 loaded.
- Per-task reviewer loop ran on every S0 task (branches stacked, one per task).

PENDING HUMAN VERIFICATION:
(a) DebugBridge port/log line and the `mc_*` MCP tools. Blocked by DebugBridge's first-run consent screen (a human click) and by Claude Code needing a restart to approve the project MCP servers.
1. Restart Claude Code in the repo; approve the project MCP servers (`mcdev-mcp`, `mcmodding`).
2. Start `env -u WAYLAND_DISPLAY xvfb-run -a ./gradlew :mod:runClient` (or a visible client), click "I Understand - Enable Mod" once (or explicitly authorize pre-seeding the dev config), confirm a port in 9876-9886 and the DebugBridge log line.
3. Call `mc_version`, `mc_search` (Wolf), `mc_connect`, `mc_snapshot`, `mc_screenshot`; verify the PNG with `bash scripts/qa/check-screenshot.sh <path>`.

(b) Prism "SmartPets Dev" instance creation and launch (the launcher UI is human-only; `scripts/dev/install-to-prism.sh` is tested against a temporary mods folder only).
1. Open Prism: `flatpak run org.prismlauncher.PrismLauncher` (first run creates its data dir; choose an offline/dev account, not your main one).
2. Add instance -> Minecraft 26.2 -> Fabric Loader 0.19.5; name `SmartPets Dev`.
3. Instance Settings -> Java: pick Java 25 (Prism-managed or the installed JDK 25; if the flatpak sandbox cannot see the host JDK, use Prism-managed Java). Do NOT install DebugBridge here.
4. Find the mods dir: `find ~/.var/app/org.prismlauncher.PrismLauncher -type d -path '*SmartPets*' -name mods` (if none, launch the instance once and run the find again).
5. `PRISM_MODS_DIR=<that path> bash scripts/dev/install-to-prism.sh`
6. Launch the instance; report yes/no: reaches the main menu, and the instance's `latest.log` contains `SmartPets initialized`.

Also open: the PR flow (labels, reviewer verdict on the PR, human merge in stack order) happens when the human merges the S0 branches.

Follow-ups:
- Blockbench MCP and short video capture (`mc_record_video`) move to S3.
- Fabric 26.3: stay on 26.2 until a trigger in ADR-0001 fires.
- Deferred minors (details in ADR-0002): runner checks only the first PNG; oracle checks only the luma range (weak for dark scenes); `enableGameTests = false` until a server GameTest exists; `EventJournal` null/mutability contract; `fetch-debugbridge.sh` leaves a bad jar in place if the sha512 check fails.

## S1 — Voice cue recognition (highest risk)
Question: can learned arbitrary sounds/words be recognized reliably, in any language, locally, inside the game?
Method: (1) offline harness in pure Java `core` with recorded WAV fixtures (author + one other speaker; at least two languages; ambient noise; speech that is not a cue); features (e.g., MFCC) + alignment-based matching (e.g., DTW) or a small embedding model; strictness parameter tied to dog intelligence. (2) In-game capture (push-to-talk) on the pinned stack, off the main thread. (3) Latency and CPU.
PASS: ≥3 cues × ≥10 recordings each; recall ≥90% at ≤2% false accepts on ≥30 min of non-cue speech/noise; ≤500 ms key-release→command; negligible frame impact; works on the author's Linux audio stack.
Fallback ladder: tuned matcher → pretrained small keyword-spotting model with user-trained words → text/key cues only (voice becomes optional extra).
Needs the human: record samples, judge feel.

## S2 — Procedural coats
Question: can unique coats compose deterministically from genes + seed at runtime, cheaply?
Method: pixel-art masks + palette; compose into dynamic textures; cache by key; same input → same image on any client.
PASS: ≥50 distinct dogs on screen with no frame regression >5% vs baseline; determinism test; works with the chosen model path; looks good to the human (the "aww" check).
Fallback: pre-baked variant atlas selected by genes+seed.

## S3 — Custom entity + model + animation
Question: custom `dog` entity with own Blockbench model and animations (idle, walk, sit, lie, sleep), item in mouth, armor layer.
Method: model/animations produced via Blockbench tooling; animation library availability for the pinned version verified first.
PASS: all five animations play with clean transitions, armor renders, item-in-mouth works, screenshots reviewed by the human for style.
Fallback: vanilla model parts + hand-coded keyframes.

## S4 — Persistence, pet registry, catch-up (parallel with S1, mostly pure)
Question: pet record in world saved data with schema versions; entity as a view; catch-up math on load.
PASS: save/quit/reload keeps records; v1→v2 migration test; catch-up across 1, 10, 100 elapsed days with caps matches unit tests; unknown fields preserved.

## S5 — Off-simulation "go home" travel (1000–2000 blocks)
Question: can a pet "walk home" without loaded chunks and arrive correctly, including across quit/reload?
Method: travel model on the pet record (distance, speed, risks, skill); arrival event at the home anchor; no chunk loading; visible departure/arrival.
PASS: deterministic with seed; survives quitting; cost per tick negligible; arrival feels non-teleport (departure on foot, arrival from the edge or at the door).
Fallback: command limited to the simulated area.

## S6 — AI core and danger scenarios
Question: utility-AI engine in `core` + adapter drives a dog through GameTest scenarios.
Scenarios: lava edge, cliff, creeper approach, never target player/ally, disengage on order, hole avoidance, door/ladder/trapdoor paths, 20 dogs at once.
PASS: scenario suite passes; per-pet tick cost within budget; no oscillation (commitment works).

## S7 — Sleep gating hook
Question: can bed-sleep eligibility be conditioned on nearby pets being asleep without breaking vanilla/multiplayer sleep logic?
PASS: GameTest: pets awake → blocked with a clear message; asleep → allowed; config off → vanilla. Prefer API events over mixins; document any mixin.
Fallback: soft rule (message and mood penalty, no block).

## S8 — Server-authoritative networking
Question: client (mic/key/UI) → server command packet with speaker id, validated and rate-limited, in the integrated server.
PASS: round trip works; invalid packets rejected; same path will serve V3.

## S9 — Pet digging
Question: dig only loose blocks, honor mobGriefing/protection, stuck detection, head toward owner's scent/sound.
PASS: cave-in scenario in GameTest; never touches structures; config off works.

## S10 — Behavior-spec framework
Question: can plain-text scenarios run against both a fast core simulation and the real game, with matrix coverage and property tests finding unforeseen cases? (design: `BEHAVIOR-SPECS.md`)
Deliver: Cucumber-JVM (JUnit Platform) + jqwik wired into `core`; `PetWorld` driver interface with a core driver; journal-based assertions; matrix expander/reporter for `specs/matrix/*`; `UNSPECIFIED_SITUATION` capture; one `@platform` scenario passing in GameTest through the server-side command handler.
PASS: the sample features run green or red for the right reason; the matrix report lists unspecified cells; a property suite finds a seeded deliberate bug; the same `@platform` scenario passes in core and in the game.
Fallback: minimal in-house runner for `.feature` text; GameTest-only for platform scenarios.

## S11 — Time source
Question: which world clock gives the monotonic day counter; behavior with sleeping, `/time set`, daylight cycle off.
PASS: documented behavior + tests; `age_days` monotonic function adopted.

## Suggested order and parallelism
S0 → then in parallel: S10, S11, S4, S1(offline part) [pure/core, cheap models ok] · S3, S2 [rendering] · S6, S7, S8 [platform]. S5 after S4. S9 after S6. S1 in-game part after S0+S8.
Model tiers (see `agents/modelos.md`): S0, S3, S5, S7 hard parts → STRONG; S4, S6, S8, S9 → MEDIUM; fixtures, lang files, boilerplate → FAST.

## Human-needed during V0
Install system packages needing sudo (virtual display/video tools, JDK if not user-level); record voice samples; judge visuals/sounds; approve ADRs; confirm target version.
