# V0-S0 Toolchain and QA Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Project roles, tiers and the PR flow in `CLAUDE.md` and `agents/` apply to every task.

**Goal:** A pinned, reproducible toolchain where an agent can build the mod, run unit tests, run a headless in-game test that produces a screenshot, observe a running game through MCP, and push work through branch → PR → reviewer → QA → human merge.

**Architecture:** Gradle multi-project: `core` (plain Java, zero Minecraft imports) and `mod` (Fabric, unobfuscated Minecraft 26.2). Verification oracles: JUnit for `core`; Fabric client GameTest (run under a virtual display) for `mod`; DebugBridge + mcdev-mcp for live inspection.

**Tech Stack:** Minecraft 26.2, Fabric Loader 0.19.5, Fabric API 0.161.0+26.2, Loom 1.18-SNAPSHOT, Gradle 9.7.1 (wrapper), Temurin JDK 25.0.4.1+1, JUnit 6.1.3, Node 20, DebugBridge 2.1.0 (26.2), mcdev-mcp 2.2.1, GeckoLib 5.5.5 (26.2, later spikes).

**Spec:** `docs/spec/V0-SPIKES.md` (S0), `docs/spec/SPEC.md` §3 (architecture), `docs/spec/BEHAVIOR-SPECS.md`, `CLAUDE.md`.

## Global Constraints

- Target: Minecraft **26.2** (not 26.3: DebugBridge has no 26.3 build as of 2026-10-17; GeckoLib and Fabric API do). Re-evaluate in a later ADR.
- Versions come from the official template branch `26.2` of `FabricMC/fabric-example-mod`: loader `0.19.5`, loom `1.18-SNAPSHOT`, fabric_api `0.161.0+26.2`, wrapper Gradle `9.7.1`, `options.release = 25`. (Fabric's 26.2 announcement lists Loom 1.17 / Gradle 9.5.1; follow the template, record the discrepancy in the ADR.)
- `core` must never import `net.minecraft` or `net.fabricmc` (enforced by a test).
- Working mod id `smartpets`, package `dev.smartpets` (provisional; final naming is an open decision, SPEC §24).
- Mod license field is `All-Rights-Reserved` until the human decides (SPEC §24).
- No absolute paths, usernames, emails, tokens in any committed file. The JDK path lives only in the user-level `~/.gradle/gradle.properties`.
- Debug tools (DebugBridge, dev commands) only in disposable dev instances; never committed (`run/` is git-ignored); dev command only when `-Dsmartpets.dev=true`.
- Do not copy the template's icon, license, or example mixins (asset provenance, YAGNI).
- Machine: 8 cores, ~7 GB RAM: never run two game instances at once; Gradle heap stays `-Xmx1G`.
- Session is Wayland: headless runs use `xvfb-run` with `WAYLAND_DISPLAY` unset.
- One task = one branch = one PR; Conventional Commit messages; commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; human merges.
- Commands in this plan are run from the repository root unless stated.

## Review Focus

- Gradle silently using JDK 17 (system default) instead of JDK 25 → confusing class-version errors. Test: `./gradlew -version` must show JDK 25 (Task 1).
- Headless screenshot is black/blank (software GL, wrong display backend) yet the test "passes" because a file exists. Test: `scripts/qa/check-screenshot.sh` fails on a uniform image (Task 3).
- DebugBridge jar for the wrong Minecraft version fails to load silently. Test: log line and open port are asserted (Task 4).
- A dev-only command or journal dump reachable in a normal run. Test: command absent without the flag (Task 5).
- Personal data or machine paths committed through configs/scripts. Test: `scripts/qa/leak-check.sh` runs in every task's verification (Task 2).
- Template artifacts (example mixins, icon, `modid` leftovers) shipped into the jar. Test: jar listing contains none (Task 2).

## File Structure

```
settings.gradle, build.gradle, gradle.properties, gradlew*, gradle/wrapper/*   (root build)
core/build.gradle
core/src/main/java/dev/smartpets/core/{CoreInfo.java, EventJournal.java}
core/src/test/java/dev/smartpets/core/{CoreBoundaryTest.java, EventJournalTest.java}
mod/build.gradle
mod/src/main/java/dev/smartpets/{SmartPetsMod.java, DevMode.java, DevCommands.java}
mod/src/main/resources/fabric.mod.json
mod/src/client/java/dev/smartpets/client/SmartPetsClient.java
mod/src/gametest/java/dev/smartpets/gametest/SmartPetsClientGameTest.java
mod/src/gametest/resources/fabric.mod.json
scripts/dev/{install-jdk25.sh, fetch-debugbridge.sh, install-to-prism.sh}
scripts/qa/{check-screenshot.sh, run-client-gametest.sh, leak-check.sh}
.mcp.json                      (project-scoped MCP servers; no secrets)
docs/adr/{0001-stack-pin.md, 0002-observation-stack.md}
```

---

### Task 1: User-level JDK 25 and Gradle JDK pin

Tier: RÁPIDO. Branch: `chore/s0-jdk`.

**Files:**
- Create: `scripts/dev/install-jdk25.sh`

**Interfaces:**
- Produces: JDK at `$HOME/.local/jdk-25`; `~/.gradle/gradle.properties` containing `org.gradle.java.home=<that path>`. Later tasks assume `./gradlew` runs on JDK 25.

- [ ] **Step 1: Write the install script**

```bash
#!/usr/bin/env bash
# Installs Temurin JDK 25 into the user's home (no sudo) and points Gradle at it.
set -euo pipefail
URL="https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1/OpenJDK25U-jdk_x64_linux_hotspot_25.0.4.1_1.tar.gz"
SHA256="dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e"
DEST="$HOME/.local/jdk-25"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -x "$DEST/bin/java" ] && "$DEST/bin/java" -version 2>&1 | grep -q '25\.0\.4'; then echo "JDK already installed"; else
  curl -fL "$URL" -o "$TMP/jdk.tgz"
  echo "$SHA256  $TMP/jdk.tgz" | sha256sum -c -
  rm -rf "$DEST"; mkdir -p "$DEST"
  tar -xzf "$TMP/jdk.tgz" -C "$DEST" --strip-components=1
fi
mkdir -p "$HOME/.gradle"
touch "$HOME/.gradle/gradle.properties"
grep -q '^org.gradle.java.home=' "$HOME/.gradle/gradle.properties" \
  || echo "org.gradle.java.home=$DEST" >> "$HOME/.gradle/gradle.properties"
"$DEST/bin/java" -version
```

- [ ] **Step 2: Run it**

Run: `bash scripts/dev/install-jdk25.sh`
Expected: `sha256sum` prints `OK`; last lines show `openjdk version "25.0.4.1"` (Temurin).

- [ ] **Step 3: Verify the Gradle pin**

Run: `grep '^org.gradle.java.home' ~/.gradle/gradle.properties`
Expected: a line ending in `/.local/jdk-25`. (The Gradle JVM check happens in Task 2 with the wrapper.)

- [ ] **Step 4: Commit**

```bash
git add scripts/dev/install-jdk25.sh
git commit -m "chore: add user-level JDK 25 install script"
```

---

### Task 2: Multi-project scaffold (core + mod), leak check, green build

Tier: MÉDIO. Branch: `feat/s0-scaffold`. Depends on Task 1.

**Files:**
- Create: `settings.gradle`, `build.gradle`, `gradle.properties`, `gradle/wrapper/*`, `gradlew`, `gradlew.bat`
- Create: `core/build.gradle`, `core/src/main/java/dev/smartpets/core/CoreInfo.java`, `core/src/test/java/dev/smartpets/core/CoreBoundaryTest.java`
- Create: `mod/build.gradle`, `mod/src/main/java/dev/smartpets/SmartPetsMod.java`, `mod/src/client/java/dev/smartpets/client/SmartPetsClient.java`, `mod/src/main/resources/fabric.mod.json`
- Create: `scripts/qa/leak-check.sh`

**Interfaces:**
- Produces: `./gradlew :core:test`, `./gradlew build`, jar at `mod/build/libs/smartpets-*.jar`; class `dev.smartpets.core.CoreInfo.NAME`; `dev.smartpets.SmartPetsMod.MOD_ID` and `id(String)`.

- [ ] **Step 1: Fetch the official template (read-only source)**

```bash
T="$(mktemp -d)"; git clone --depth 1 --branch 26.2 https://github.com/FabricMC/fabric-example-mod.git "$T/fem"
cp -r "$T/fem/gradle" "$T/fem/gradlew" "$T/fem/gradlew.bat" .
cp "$T/fem/gradle.properties" gradle.properties
```
Expected: `gradle/wrapper/gradle-wrapper.properties` contains `gradle-9.7.1-bin.zip`.

- [ ] **Step 2: Write the root build files**

`settings.gradle`:
```groovy
pluginManagement {
	repositories {
		maven { name = 'Fabric'; url = 'https://maven.fabricmc.net/' }
		mavenCentral()
		gradlePluginPortal()
	}
}
rootProject.name = 'smartpets'
include 'core', 'mod'
```
`build.gradle`:
```groovy
// Root project intentionally empty: see core/ and mod/.
```
Edit `gradle.properties`: keep the template values for `org.gradle.*`, `minecraft_version=26.2`, `loader_version=0.19.5`, `loom_version=1.18-SNAPSHOT`, `fabric_api_version=0.161.0+26.2`; set `version=0.0.0-dev` and `group=dev.smartpets`.

- [ ] **Step 3: Write the failing `core` tests**

`core/build.gradle`:
```groovy
plugins { id 'java-library' }
repositories { mavenCentral() }
java {
	sourceCompatibility = JavaVersion.VERSION_25
	targetCompatibility = JavaVersion.VERSION_25
}
tasks.withType(JavaCompile).configureEach { it.options.release = 25 }
dependencies {
	testImplementation platform('org.junit:junit-bom:6.1.3')
	testImplementation 'org.junit.jupiter:junit-jupiter'
	testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}
test { useJUnitPlatform() }
```
`core/src/test/java/dev/smartpets/core/CoreBoundaryTest.java`:
```java
package dev.smartpets.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class CoreBoundaryTest {
	@Test
	void coreHasAName() {
		assertEquals("smartpets-core", CoreInfo.NAME);
	}

	@Test
	void coreNeverImportsMinecraftOrFabric() throws IOException {
		try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
			List<Path> offenders = files.filter(p -> p.toString().endsWith(".java"))
				.filter(p -> {
					try {
						String s = Files.readString(p);
						return s.contains("net.minecraft") || s.contains("net.fabricmc");
					} catch (IOException e) {
						throw new RuntimeException(e);
					}
				}).toList();
			assertTrue(offenders.isEmpty(), "Minecraft/Fabric imports in core: " + offenders);
		}
	}
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `./gradlew :core:test`
Expected: FAIL (compile error: `CoreInfo` not found). First run downloads Gradle 9.7.1; `./gradlew -version` must report JDK 25 (if not, re-check Task 1).

- [ ] **Step 5: Implement `core`**

`core/src/main/java/dev/smartpets/core/CoreInfo.java`:
```java
package dev.smartpets.core;

public final class CoreInfo {
	public static final String NAME = "smartpets-core";

	private CoreInfo() {
	}
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: PASS (2 tests).

- [ ] **Step 7: Write the `mod` module**

`mod/build.gradle`:
```groovy
plugins {
	id 'net.fabricmc.fabric-loom' version "${loom_version}"
	id 'maven-publish'
}

loom {
	splitEnvironmentSourceSets()
	mods {
		"smartpets" {
			sourceSet sourceSets.main
			sourceSet sourceSets.client
		}
	}
}

dependencies {
	minecraft "com.mojang:minecraft:${project.minecraft_version}"
	implementation "net.fabricmc:fabric-loader:${project.loader_version}"
	implementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_api_version}"
	implementation project(':core')
	include project(':core')
}

processResources {
	def version = project.version
	inputs.property "version", version
	filesMatching("fabric.mod.json") { expand "version": version }
}

tasks.withType(JavaCompile).configureEach { it.options.release = 25 }

java {
	withSourcesJar()
	sourceCompatibility = JavaVersion.VERSION_25
	targetCompatibility = JavaVersion.VERSION_25
}
```
`mod/src/main/resources/fabric.mod.json`:
```json
{
	"schemaVersion": 1,
	"id": "smartpets",
	"version": "${version}",
	"name": "Smart Pets",
	"description": "Smarter, more useful pets (working title).",
	"authors": ["Smart Pets contributors"],
	"license": "All-Rights-Reserved",
	"environment": "*",
	"entrypoints": {
		"main": ["dev.smartpets.SmartPetsMod"],
		"client": ["dev.smartpets.client.SmartPetsClient"]
	},
	"depends": {
		"fabricloader": ">=0.19.5",
		"minecraft": "~26.2",
		"java": ">=25",
		"fabric-api": "*"
	}
}
```
`mod/src/main/java/dev/smartpets/SmartPetsMod.java`:
```java
package dev.smartpets;

import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SmartPetsMod implements ModInitializer {
	public static final String MOD_ID = "smartpets";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		LOGGER.info("SmartPets initialized (core: {})", dev.smartpets.core.CoreInfo.NAME);
	}

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}
}
```
`mod/src/client/java/dev/smartpets/client/SmartPetsClient.java`:
```java
package dev.smartpets.client;

import net.fabricmc.api.ClientModInitializer;

public class SmartPetsClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
	}
}
```

- [ ] **Step 8: Write the leak check**

`scripts/qa/leak-check.sh`:
```bash
#!/usr/bin/env bash
# Fails if tracked or staged files contain machine paths, e-mails or token-like strings.
set -euo pipefail
files=$(git ls-files; git diff --cached --name-only)
hits=$(echo "$files" | sort -u | xargs -r grep -InE '/home/[a-z0-9_-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|ghp_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{12,}|BEGIN (RSA |EC )?PRIVATE KEY' -- 2>/dev/null \
  | grep -v 'users.noreply.github.com' | grep -v 'noreply@anthropic.com' || true)
if [ -n "$hits" ]; then echo "LEAK CHECK FAILED:"; echo "$hits"; exit 1; fi
echo "leak-check: clean"
```

- [ ] **Step 9: Build and verify the jar**

Run: `./gradlew build && ls mod/build/libs/ && unzip -l mod/build/libs/smartpets-0.0.0-dev.jar | grep -E 'META-INF/jars|fabric.mod.json'`
Expected: BUILD SUCCESSFUL; jar present; listing shows `fabric.mod.json` and a `META-INF/jars/core-*.jar` entry. If the nested jar is absent, replace `include project(':core')` with `jar { from project(':core').sourceSets.main.output }` (shading) and record the choice in `MODLOG.md`.
Also: `unzip -l mod/build/libs/smartpets-0.0.0-dev.jar | grep -Ei 'icon|mixin|modid'` → no output.

- [ ] **Step 10: Leak check, log, commit**

Run: `bash scripts/qa/leak-check.sh` → `leak-check: clean`.
Append to `MODLOG.md`: date, versions that built, whether JiJ or shading was used, any gotcha.
```bash
git add -A && git commit -m "feat: scaffold core and mod modules on Fabric 26.2"
```

---

### Task 3: Headless client GameTest with screenshot oracle

Tier: FORTE (first contact with the harness; most risk). Branch: `feat/s0-gametest`. Depends on Task 2.

**Files:**
- Modify: `mod/build.gradle`
- Create: `mod/src/gametest/java/dev/smartpets/gametest/SmartPetsClientGameTest.java`, `mod/src/gametest/resources/fabric.mod.json`
- Create: `scripts/qa/check-screenshot.sh`, `scripts/qa/run-client-gametest.sh`

**Interfaces:**
- Consumes: Task 2 build.
- Produces: `bash scripts/qa/run-client-gametest.sh` (exit 0 = test passed AND screenshot has content); screenshots in `mod/build/run/clientGameTest/screenshots/`. Later spikes put scenarios in `mod/src/gametest/`.
- Verified API (Fabric API 26.2 branch, confirm in the sources of 0.161.0+26.2): `ClientGameTestContext#takeScreenshot(String) : Path`, `#worldBuilder()`, `#getInput() : TestInput` (key/mouse/`lookAt(yaw,pitch)`/`typeChars`), `TestSingleplayerContext#getConnection().waitForChunksRender()`, `#getServer().runCommand(String)`. (The online docs example `getClientLevel()` is outdated.)

- [ ] **Step 1: Write the screenshot oracle first (it is the test of the test)**

`scripts/qa/check-screenshot.sh`:
```bash
#!/usr/bin/env bash
# usage: check-screenshot.sh <png> -> exit 0 only if the image has real content
set -euo pipefail
f="$1"; [ -s "$f" ] || { echo "missing/empty: $f" >&2; exit 2; }
stats=$(ffmpeg -v error -i "$f" -vf "signalstats,metadata=mode=print:file=-" -frames:v 1 -f null - 2>&1 | tr -d '\r')
ymin=$(echo "$stats" | sed -n 's/.*signalstats.YMIN=\([0-9.]*\).*/\1/p' | head -1)
ymax=$(echo "$stats" | sed -n 's/.*signalstats.YMAX=\([0-9.]*\).*/\1/p' | head -1)
[ -n "$ymin" ] && [ -n "$ymax" ] || { echo "could not read stats" >&2; exit 3; }
awk -v a="$ymin" -v b="$ymax" 'BEGIN{ exit !((b-a) >= 40) }' \
  && echo "OK range=$ymin..$ymax" || { echo "BLANK range=$ymin..$ymax" >&2; exit 1; }
```

- [ ] **Step 2: Verify the oracle on known images**

```bash
D="$(mktemp -d)"
ffmpeg -v error -y -f lavfi -i color=c=black:s=320x180 -frames:v 1 "$D/black.png"
ffmpeg -v error -y -f lavfi -i testsrc=s=320x180 -frames:v 1 "$D/busy.png"
bash scripts/qa/check-screenshot.sh "$D/black.png"; echo "exit=$?"
bash scripts/qa/check-screenshot.sh "$D/busy.png";  echo "exit=$?"
```
Expected: black → `BLANK range=16..16`, `exit=1`; busy → `OK range=16..235`, `exit=0`.

- [ ] **Step 3: Configure the game test source set**

Append to `mod/build.gradle`:
```groovy
fabricApi {
	configureTests {
		createSourceSet = true
		modId = "smartpets-test"
		enableGameTests = true
		enableClientGameTests = true
		eula = true
	}
}
```
`mod/src/gametest/resources/fabric.mod.json`:
```json
{
	"schemaVersion": 1,
	"id": "smartpets-test",
	"version": "1.0.0",
	"name": "Smart Pets tests",
	"environment": "*",
	"entrypoints": {
		"fabric-client-gametest": ["dev.smartpets.gametest.SmartPetsClientGameTest"]
	}
}
```

- [ ] **Step 4: Write the client game test**

`mod/src/gametest/java/dev/smartpets/gametest/SmartPetsClientGameTest.java`:
```java
package dev.smartpets.gametest;

import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;

@SuppressWarnings("UnstableApiUsage")
public class SmartPetsClientGameTest implements FabricClientGameTest {
	@Override
	public void runTest(ClientGameTestContext context) {
		try (TestSingleplayerContext singleplayer = context.worldBuilder().create()) {
			singleplayer.getConnection().waitForChunksRender();
			context.takeScreenshot("s0-world");
		}
	}
}
```
If this fails to compile, open the real signatures (`./gradlew :mod:genSources`, or the Fabric API sources jar) and adapt; record the real API in `MODLOG.md`.

- [ ] **Step 5: Write the headless runner**

`scripts/qa/run-client-gametest.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
SHOTS="mod/build/run/clientGameTest/screenshots"
rm -rf "$SHOTS"
env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew :mod:runClientGameTest
shot=$(ls -1 "$SHOTS"/*.png 2>/dev/null | head -1 || true)
[ -n "$shot" ] || { echo "no screenshot produced" >&2; exit 4; }
bash scripts/qa/check-screenshot.sh "$shot"
```

- [ ] **Step 6: Run it**

Run: `bash scripts/qa/run-client-gametest.sh`
Expected: first run downloads Minecraft assets (several minutes, needs network); game test passes; final line `OK range=...`. If the image is `BLANK`, try `LIBGL_ALWAYS_SOFTWARE=1` in the script's `env` and record what fixed it. If the window cannot open, run `glxinfo -B` under `xvfb-run` to inspect OpenGL and record the finding.

- [ ] **Step 7: Leak check, log, commit**

Run: `bash scripts/qa/leak-check.sh`. Add the exact working invocation and any env var to `MODLOG.md` and to `CLAUDE.md` §1 ("Commands").
```bash
git add -A && git commit -m "test: add headless client GameTest with screenshot oracle"
```

---

### Task 4: Observation stack (DebugBridge + mcdev-mcp + mcmodding-mcp)

Tier: MÉDIO + a human restart of Claude Code. Branch: `feat/s0-observation`. Depends on Task 3.

**Files:**
- Create: `scripts/dev/fetch-debugbridge.sh`, `.mcp.json`

**Interfaces:**
- Produces: `mod/run/mods/debugbridge-26.2-2.1.0.jar` (git-ignored); MCP servers `mcdev-mcp` and `mcmodding` registered at project scope; WebSocket on 9876–9886 while the dev client runs.

- [ ] **Step 1: Write the fetch script (checksum-verified, Modrinth API)**

`scripts/dev/fetch-debugbridge.sh`:
```bash
#!/usr/bin/env bash
# Downloads DebugBridge for MC 26.2 (Modrinth version id NO17UtXL) into the dev run dir.
set -euo pipefail
UA="User-Agent: smartpets-dev-setup/0.1"
meta=$(curl -fsS -H "$UA" "https://api.modrinth.com/v2/version/NO17UtXL")
url=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["url"])')
sha=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["hashes"]["sha512"])')
name=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["filename"])')
mkdir -p mod/run/mods
curl -fsSL "$url" -o "mod/run/mods/$name"
echo "$sha  mod/run/mods/$name" | sha512sum -c -
ls -l mod/run/mods
```

- [ ] **Step 2: Run it**

Run: `bash scripts/dev/fetch-debugbridge.sh`
Expected: `debugbridge-26.2-2.1.0.jar: OK`.

- [ ] **Step 3: Register the MCP servers (project scope, no secrets)**

```bash
claude mcp add --scope project mcdev-mcp -- npx -y mcdev-mcp serve
claude mcp add --scope project mcmodding -- npx -y mcmodding-mcp
npx -y mcdev-mcp init -v 26.2
claude mcp list
```
Expected: `.mcp.json` created; `init` downloads, decompiles, indexes (about 2–5 minutes, ~2 GB disk); `claude mcp list` shows both servers. If `mcdev-mcp init -v 26.2` fails, try `-v 26.1` and record; the failure is itself the S0 finding.

- [ ] **Step 4: Start the dev client with DebugBridge and check the port**

Run (in a second terminal or background): `env -u WAYLAND_DISPLAY xvfb-run -a ./gradlew :mod:runClient`
Then: `sleep 90; ss -ltn | grep -E ':98(7[6-9]|8[0-6])'` and `grep -i debugbridge mod/run/logs/latest.log | head`
Expected: a listening port in 9876–9886 and a DebugBridge log line. If the log says the mod was skipped or incompatible, record the exact text (wrong MC version is the likely cause).

- [ ] **Step 5: Human step — reload Claude Code and use the tools**

Ask the human to restart Claude Code in this repo and approve the project MCP servers. Then, with the client running, call in order: `mc_version`, `mc_search` (query `Wolf`), `mc_connect`, `mc_snapshot`, `mc_screenshot`.
Expected: a class result for `Wolf` from the 26.2 sources; a snapshot JSON (dimension, time); a PNG path. Verify the PNG with `bash scripts/qa/check-screenshot.sh <path>`.

- [ ] **Step 6: Stop the client, leak check, log, commit**

Stop the game (`mc_quit_client` or kill by PID, never by name). Run `bash scripts/qa/leak-check.sh`. Log versions and any surprise in `MODLOG.md`. Confirm `git status` shows no `mod/run/` files.
```bash
git add -A && git commit -m "chore: add DebugBridge fetch script and project MCP servers"
```

---

### Task 5: Event journal (core) and dev-only debug command (mod)

Tier: MÉDIO. Branch: `feat/s0-journal`. Depends on Task 3.

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/EventJournal.java`, `core/src/test/java/dev/smartpets/core/EventJournalTest.java`
- Create: `mod/src/main/java/dev/smartpets/DevMode.java`, `mod/src/main/java/dev/smartpets/DevCommands.java`
- Modify: `mod/src/main/java/dev/smartpets/SmartPetsMod.java`, `mod/build.gradle`, `mod/src/gametest/java/dev/smartpets/gametest/SmartPetsClientGameTest.java`

**Interfaces:**
- Produces:
  - `EventJournal(int capacity)`; `void record(long tick, String type, Map<String,String> data)`; `List<EventJournal.Entry> snapshot()`; `String toJsonLines()`; `record Entry(long tick, String type, Map<String,String> data)`.
  - `DevMode.enabled() : boolean` reading `Boolean.getBoolean("smartpets.dev")`.
  - Command `/smartpets debug ping` replies `SMARTPETS_DEBUG_PONG` and writes one journal entry of type `DEBUG_PING`.

- [ ] **Step 1: Write the failing journal tests**

`core/src/test/java/dev/smartpets/core/EventJournalTest.java`:
```java
package dev.smartpets.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class EventJournalTest {
	@Test
	void keepsOrderAndDropsOldestBeyondCapacity() {
		EventJournal j = new EventJournal(2);
		j.record(1, "A", Map.of());
		j.record(2, "B", Map.of());
		j.record(3, "C", Map.of());
		var snap = j.snapshot();
		assertEquals(2, snap.size());
		assertEquals("B", snap.get(0).type());
		assertEquals("C", snap.get(1).type());
	}

	@Test
	void writesOneJsonObjectPerLineWithEscaping() {
		EventJournal j = new EventJournal(10);
		j.record(7, "SAY", Map.of("text", "he said \"hi\"\nnext"));
		String out = j.toJsonLines();
		assertEquals(1, out.lines().count());
		assertTrue(out.contains("\\\"hi\\\""));
		assertTrue(out.contains("\\n"));
		assertTrue(out.startsWith("{\"tick\":7,\"type\":\"SAY\""));
	}

	@Test
	void snapshotIsACopy() {
		EventJournal j = new EventJournal(3);
		j.record(1, "A", Map.of());
		var snap = j.snapshot();
		j.record(2, "B", Map.of());
		assertEquals(1, snap.size());
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test`
Expected: FAIL (compile error: `EventJournal` not found).

- [ ] **Step 3: Implement the journal**

`core/src/main/java/dev/smartpets/core/EventJournal.java`:
```java
package dev.smartpets.core;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Bounded in-memory event log. Behavior specs and QA assert on this, never on internals. */
public final class EventJournal {
	public record Entry(long tick, String type, Map<String, String> data) {
	}

	private final int capacity;
	private final ArrayDeque<Entry> entries = new ArrayDeque<>();

	public EventJournal(int capacity) {
		if (capacity < 1) {
			throw new IllegalArgumentException("capacity must be >= 1");
		}
		this.capacity = capacity;
	}

	public synchronized void record(long tick, String type, Map<String, String> data) {
		if (entries.size() == capacity) {
			entries.removeFirst();
		}
		entries.addLast(new Entry(tick, type, new TreeMap<>(data)));
	}

	public synchronized List<Entry> snapshot() {
		return new ArrayList<>(entries);
	}

	public synchronized String toJsonLines() {
		StringBuilder sb = new StringBuilder();
		for (Entry e : entries) {
			sb.append("{\"tick\":").append(e.tick()).append(",\"type\":\"").append(esc(e.type())).append("\",\"data\":{");
			boolean first = true;
			for (var kv : e.data().entrySet()) {
				if (!first) {
					sb.append(',');
				}
				first = false;
				sb.append('"').append(esc(kv.getKey())).append("\":\"").append(esc(kv.getValue())).append('"');
			}
			sb.append("}}\n");
		}
		return sb.toString();
	}

	private static String esc(String s) {
		StringBuilder o = new StringBuilder();
		for (char c : s.toCharArray()) {
			switch (c) {
				case '"' -> o.append("\\\"");
				case '\\' -> o.append("\\\\");
				case '\n' -> o.append("\\n");
				case '\r' -> o.append("\\r");
				case '\t' -> o.append("\\t");
				default -> o.append(c < 0x20 ? String.format("\\u%04x", (int) c) : String.valueOf(c));
			}
		}
		return o.toString();
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing in-game assertion**

In `SmartPetsClientGameTest.runTest`, inside the `try` block after `waitForChunksRender()`, add:
```java
			singleplayer.getServer().runCommand("smartpets debug ping");
			context.waitTicks(5);
```
and add to `mod/build.gradle` inside `loom { }` a dev run option so the flag is set for game tests:
```groovy
	runs {
		clientGameTest { property "smartpets.dev", "true" }
	}
```
(If the run name differs in Loom 1.18, list tasks with `./gradlew :mod:tasks --all | grep -i run` and use the real name; record it.)
Then assert via the log: extend `scripts/qa/run-client-gametest.sh` with a last line:
```bash
grep -q "SMARTPETS_DEBUG_PONG" mod/build/run/clientGameTest/logs/latest.log || { echo "ping not seen" >&2; exit 5; }
```
Run: `bash scripts/qa/run-client-gametest.sh`
Expected: FAIL (`ping not seen`: command does not exist yet; the server logs "Unknown command").

- [ ] **Step 6: Implement the dev command**

`mod/src/main/java/dev/smartpets/DevMode.java`:
```java
package dev.smartpets;

public final class DevMode {
	private DevMode() {
	}

	public static boolean enabled() {
		return Boolean.getBoolean("smartpets.dev");
	}
}
```
`mod/src/main/java/dev/smartpets/DevCommands.java`:
```java
package dev.smartpets;

import dev.smartpets.core.EventJournal;
import java.util.Map;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

public final class DevCommands {
	public static final EventJournal JOURNAL = new EventJournal(2000);

	private DevCommands() {
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets")
				.then(Commands.literal("debug")
					.then(Commands.literal("ping").executes(ctx -> {
						JOURNAL.record(0, "DEBUG_PING", Map.of());
						SmartPetsMod.LOGGER.info("SMARTPETS_DEBUG_PONG");
						ctx.getSource().sendSuccess(() -> Component.literal("SMARTPETS_DEBUG_PONG"), false);
						return 1;
					})))));
	}
}
```
Call `DevCommands.register();` as the first line of `SmartPetsMod.onInitialize()`. If any import fails to resolve, look up the real 26.2 class with `mc_search` / the sources and record it.

- [ ] **Step 7: Run to verify it passes, and that the command is absent without the flag**

Run: `bash scripts/qa/run-client-gametest.sh` → ends with `OK range=...` and no `ping not seen`.
Then: in a normal run the command must not exist: temporarily run the game test with the property removed (`-Dsmartpets.dev=false`) and confirm the log contains `Unknown or incomplete command` for `smartpets debug ping` (record the evidence in `MODLOG.md`, then restore).

- [ ] **Step 8: Leak check, log, commit**

```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "feat: add EventJournal and dev-only debug ping command"
```

---

### Task 6: Prism Launcher dev instance (human-assisted)

Tier: RÁPIDO + human. Branch: `chore/s0-prism`. Depends on Task 2.

**Files:**
- Create: `scripts/dev/install-to-prism.sh`

**Interfaces:**
- Produces: a Prism instance "SmartPets Dev" (Fabric Loader 0.19.5, Minecraft 26.2, Java 25) and `bash scripts/dev/install-to-prism.sh` copying the built mod and Fabric API into that instance.

- [ ] **Step 1: Install Prism (user scope, no sudo)**

```bash
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y flathub org.prismlauncher.PrismLauncher
```
Expected: install completes. Verify: `flatpak list --user | grep -i prism`.

- [ ] **Step 2: Human step — create the instance**

Ask the human: open Prism → Add instance → Minecraft 26.2 → Fabric Loader 0.19.5; name it `SmartPets Dev`; in Settings → Java choose the Prism-managed Java 25 (or the installed JDK path). Use an offline/dev account unless they decide otherwise; never enable DebugBridge here.

- [ ] **Step 3: Write the install script**

`scripts/dev/install-to-prism.sh`:
```bash
#!/usr/bin/env bash
# Copies the built mod + Fabric API into a Prism instance. Usage: PRISM_MODS_DIR=<instance>/minecraft/mods bash scripts/dev/install-to-prism.sh
set -euo pipefail
: "${PRISM_MODS_DIR:?set PRISM_MODS_DIR to the instance mods folder}"
./gradlew :mod:build
mkdir -p "$PRISM_MODS_DIR"
cp mod/build/libs/smartpets-*.jar "$PRISM_MODS_DIR"/
meta=$(curl -fsS -H "User-Agent: smartpets-dev-setup/0.1" "https://api.modrinth.com/v2/version/ewUK83HI")
url=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["url"])')
name=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["filename"])')
sha=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["hashes"]["sha512"])')
[ -f "$PRISM_MODS_DIR/$name" ] || curl -fsSL "$url" -o "$PRISM_MODS_DIR/$name"
echo "$sha  $PRISM_MODS_DIR/$name" | sha512sum -c -
ls -l "$PRISM_MODS_DIR"
```
(`ewUK83HI` is the Modrinth version id of Fabric API `0.161.0+26.2`; the script must not copy the source jar.)

- [ ] **Step 4: Run it and have the human launch**

Find the mods dir: `find ~/.var/app/org.prismlauncher.PrismLauncher -type d -path '*SmartPets*' -name mods`. Run the script with `PRISM_MODS_DIR` set to it. The human launches the instance.
Expected: game reaches the main menu; log (`latest.log` in the instance) contains `SmartPets initialized`. The human reports yes/no.

- [ ] **Step 5: Leak check, log, commit**

```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "chore: add Prism install script for the dev instance"
```

---

### Task 7: Review → QA → human-merge loop on a real PR

Tier: orchestrator (FORTE for the reviewer). Depends on Tasks 2–5.

- [ ] **Step 1: Push the Task 2 branch and open its PR**

```bash
git push -u origin feat/s0-scaffold
gh pr create --base main --head feat/s0-scaffold --label v0-spike --title "feat: scaffold core and mod modules on Fabric 26.2" --body-file .github/pull_request_template.md
```
Fill the template honestly (what was verified, what was not).

- [ ] **Step 2: Dispatch the Reviewer**

Dispatch one agent on the FORTE tier with: the full text of `agents/agent-revisor.md`, `CLAUDE.md`, the PR diff (`gh pr diff`), the task text from this plan, and the instruction to run build/tests itself and to call QA. Do NOT give it the executor's chat history.
Expected: a verdict in the format of the role file.

- [ ] **Step 3: Dispatch QA from the Reviewer's request**

QA agent (MÉDIO) gets `agents/agent-qa.md`, the acceptance criteria below, and the PR branch. Criteria: `./gradlew build` green; `./gradlew :core:test` 2 tests pass; `scripts/qa/leak-check.sh` clean; jar contains no icon/mixin/`modid`; jar contains the nested core jar (or the documented shading fallback).
Expected: a QA report in the role-file format with evidence.

- [ ] **Step 4: Apply labels and verdict**

```bash
gh pr edit <N> --add-label qa-passed --add-label approved-by-reviewer   # or changes-requested
gh pr comment <N> --body-file <verdict file>
```
(If rejected: send the problem list back to the executor, max 3 cycles.)

- [ ] **Step 5: Human merges; log the loop**

Human merges. Append to `MODLOG.md`: how many cycles, what the reviewer caught, what was awkward in the flow (for improving the role files).

---

### Task 8: Close S0 (ADRs, commands, spec updates)

Tier: Architect (FORTE). Branch: `docs/s0-close`. Depends on Tasks 1–7.

**Files:**
- Create: `docs/adr/0001-stack-pin.md`, `docs/adr/0002-observation-stack.md`
- Modify: `CLAUDE.md` (§1 commands), `docs/spec/V0-SPIKES.md` (S0 status), `docs/spec/BEHAVIOR-SPECS.md`, `README.md`

- [ ] **Step 1: ADR-0001 (stack pin)** — record: Minecraft 26.2 and why not 26.3 (DebugBridge coverage), every pinned version, the Loom 1.17-vs-1.18-SNAPSHOT discrepancy and the decision, JiJ vs shading outcome, JDK location convention, what would trigger moving to 26.3.
- [ ] **Step 2: ADR-0002 (observation stack)** — record: which tools worked for 26.2, the exact commands, the headless-GL findings, limits seen, how agents invoke them.
- [ ] **Step 3: Update `CLAUDE.md` §1** — replace "A DEFINIR" with the real commands: `./gradlew build`, `./gradlew :core:test`, `bash scripts/qa/run-client-gametest.sh`, `bash scripts/qa/leak-check.sh`, `bash scripts/dev/fetch-debugbridge.sh`, dev instance rules. Keep the rule "never invent commands": list only what was run in this plan.
- [ ] **Step 4: Update `docs/spec/BEHAVIOR-SPECS.md`** — the client GameTest API exposes scripted input (`TestInput`: key/mouse, `lookAt(yaw,pitch)`, `typeChars`) and `TestServerContext#runCommand`; replace the "not documented" caveat with this verified fact (keep the server-side command-handler route as the preferred one).
- [ ] **Step 5: Mark S0 PASS / PASS-WITH-FALLBACK in `docs/spec/V0-SPIKES.md`** with links to the ADRs; list follow-ups (Blockbench MCP moves to S3; Fabric 26.3 decision).
- [ ] **Step 6: Leak check, PR, human merge**

```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "docs: close V0-S0 with ADRs and verified commands"
```

---

## Out of scope for S0 (explicit)

Blockbench MCP and art tooling (S3); voice capture (S1); behavior-spec runner (S10); any pet logic; GeckoLib dependency; Fabric 26.3.

## Self-Review Notes

- Spec coverage (S0 bullets): pin versions (T2, ADR T8), scaffold + unit test + sample GameTest (T2, T3), dev instance (T4 `runClient`, T6 Prism), observation MCPs (T4), headless GameTest + screenshot (T3), dev commands + journal (T5), GitHub flow (T7). Gap: "video" capture is not exercised (mcdev-mcp `mc_record_video`); add a one-line check in T4 Step 5 if time allows, else defer to S3.
- Unverified until run: Loom 1.18-SNAPSHOT behavior with `include project(...)`, the exact run-config name in Task 5, DebugBridge under Xvfb. Each has a fallback or a recording step.
