# ADR-0001: Stack pin (Minecraft 26.2, Fabric, JDK 25)

- Status: Proposed (awaiting human approval)
- Date: 2026-10-18
- Spike: V0-S0 (`docs/spec/V0-SPIKES.md`)
- Evidence: `MODLOG.md` entries dated 2026-10-17 and 2026-10-18

## Context
S0 must pin the Minecraft version, loader, Java and build tool versions before any code, and pick the target version by tool support (debug bridge, model/animation library, GeckoLib). Minecraft 26.1+ is not obfuscated and uses Mojang names.

## Decision

### Target: Minecraft 26.2, not 26.3
As of 2026-10-17 (Modrinth API), DebugBridge 2.1.0, the in-game observation bridge chosen for S0, has builds for 26.2 and 26.1.x and **no build for 26.3**. Fabric API and GeckoLib exist for both (GeckoLib 5.5.5 for 26.2, 5.5.7 for 26.3). Live in-game observation by agents is a core S0 requirement, so 26.2 wins.

### Pinned versions (all built and run locally)
| Component | Pin | Where |
|---|---|---|
| Minecraft | 26.2 | `gradle.properties` `minecraft_version` |
| Fabric Loader | 0.19.5 | `gradle.properties` `loader_version` |
| Fabric API | 0.161.0+26.2 | `gradle.properties` `fabric_api_version` (Modrinth version `ewUK83HI` for the Prism instance) |
| Fabric Loom | 1.18-SNAPSHOT | `gradle.properties` `loom_version`; plugin id `net.fabricmc.fabric-loom` |
| Gradle | 9.7.1 | `gradle/wrapper/gradle-wrapper.properties` |
| Java | Temurin JDK 25.0.4.1+1; `options.release = 25` | `scripts/dev/install-jdk25.sh` (sha256-checked), both `build.gradle` files |
| JUnit | 6.1.3 (BOM) | `core/build.gradle` |
| fabric-client-gametest-api-v1 | 6.0.2+0f4f1dca9e (inside Fabric API 0.161.0+26.2) | transitive |
| DebugBridge (dev only) | 2.1.0 for 26.2, Modrinth version `NO17UtXL` | `scripts/dev/fetch-debugbridge.sh` (sha512-checked, into git-ignored `mod/run/mods/`) |
| mcdev-mcp / mcmodding-mcp (dev only) | 2.2.1 / 0.5.0 | `.mcp.json` |

GeckoLib is not a dependency yet (out of scope for S0; S3 decides).

### Loom 1.17 vs 1.18-SNAPSHOT
Fabric's 26.2 announcement lists Loom 1.17 with Gradle 9.5.1. The official template branch `26.2` of `FabricMC/fabric-example-mod` uses Loom 1.18-SNAPSHOT with Gradle 9.7.1. **Decision: follow the template** (it is what Fabric maintains and tests against for the version). Verified: `./gradlew build` and `./gradlew :core:test` pass on Loom 1.18-SNAPSHOT / Gradle 9.7.1; `include project(':core')` works (see below). Risk accepted: a SNAPSHOT plugin can change under us; if a build breaks with no source change, suspect Loom first and pin a release Loom once one supports 26.2 cleanly.

### Core bundling: Jar-in-Jar, no shading
`mod` depends on the plain-Java `core` with `implementation project(':core')` + `include project(':core')`. The built jar `smartpets-0.0.0-dev.jar` contains `META-INF/jars/core-0.0.0-dev.jar` and `fabric.mod.json` lists it under `jars`. Shading is not needed. (`base.archivesName = 'smartpets'` is set, otherwise the jar is named `mod-*.jar`.)

### JDK location convention
JDK 25 lives in the user's home at `$HOME/.local/jdk-25` (no sudo), installed by `bash scripts/dev/install-jdk25.sh`, which also appends `org.gradle.java.home=$HOME/.local/jdk-25` (expanded) to the user-level `~/.gradle/gradle.properties` if no such line exists. The Gradle launcher may run on the system JDK 17; the daemon runs on JDK 25 through that property, and this works. The repo never contains a machine path. Tools launched outside Gradle that need Java 25 (for example `mcdev-mcp init`, see ADR-0002) need JDK 25 first on `PATH` and `JAVA_HOME` set.

### Mod license: GPL-3.0-or-later
The S0 plan said `All-Rights-Reserved` until the human decided. The human had already decided (`CLAUDE.md` §11): code under **GPL-3.0-or-later**. `fabric.mod.json` uses `GPL-3.0-or-later`. DebugBridge (MIT) is a dev-only tool and never shipped. Dependencies must stay GPLv3-compatible.

## Triggers to move to 26.3
Re-open this ADR when any of these holds:
1. DebugBridge (or an equivalent bridge that passes the ADR-0002 checks) publishes a 26.3 build; or
2. a needed library (GeckoLib or other) or a fix we need ships only for 26.3+; or
3. players we target have moved to 26.3 and 26.2 support in Fabric API stops.
Moving means: bump `gradle.properties` from the 26.3 template branch, re-run every command in `CLAUDE.md` §1, re-index `mcdev-mcp` for the new version, record in `MODLOG.md`.

## Consequences
- Every API name is verified against the 26.2 jars (javap or compile), never from memory.
- Two items of the dev stack are not yet verified end to end and need the human (DebugBridge consent screen, Prism instance); see ADR-0002 and `docs/spec/V0-SPIKES.md` S0.
- Deferred minors (logged, not blocking): `install-jdk25.sh` does not overwrite a stale `org.gradle.java.home` line; `enableGameTests = false` in `mod/build.gradle` until a server GameTest exists (when true, Loom hooks `runGameTest` into `check`, so `./gradlew build` would launch a game-test server).
