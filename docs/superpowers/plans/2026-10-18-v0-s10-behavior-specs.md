# V0-S10 Behavior-Spec Framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Project roles, tiers and the PR flow in `CLAUDE.md` and `agents/` apply to every task.

**Goal:** The plain-text scenarios in `specs/behaviors/` run as tests against a fast pure-Java simulation and (one scenario) against the real game. Assertions read the event journal. A matrix expander lists the decision-table cells no rule covers, `UNSPECIFIED_SITUATION` events become triage rows, and a property suite catches a deliberately seeded bug.

**Architecture:** `core` gets a small deterministic simulation (`dev.smartpets.core.sim`: `SimWorld` with a tick loop, `SimConfig`, and `SimScript`, a one-line text protocol). A `java-test-fixtures` source set in `core` holds the driver-agnostic glue: the `PetWorld` driver interface, `CorePetWorld`, the Cucumber steps `PetSteps` and `UnspecifiedCollector`. Core tests run Cucumber through the JUnit Platform Suite engine, plus the matrix expander and an in-house property runner. `mod` sends the same `SimScript` lines through a dev-only server command (`/smartpets debug sim …`), ticks the simulation on the server tick, and measures the real wolf-to-player distance. The client GameTest starts Cucumber in the game JVM with a `GamePetWorld` driver and runs one `@platform` scenario.

**Tech Stack (checked on Maven Central 2026-10-18):** Cucumber-JVM **8.0.4** (`cucumber-bom`, `cucumber-java`, `cucumber-junit-platform-engine`; MIT; Java 17 baseline). The engine POM pins `junit-bom` **6.1.3**, the same as ours. `junit-platform-suite` 6.1.3. **No jqwik** (see Global Constraints). Everything else as ADR-0001: Minecraft 26.2, Fabric API 0.161.0+26.2 (contains `fabric-lifecycle-events-v1` 4.1.4), Loom 1.18-SNAPSHOT, Gradle 9.7.1, JDK 25, JUnit 6.1.3.

**Spec:** `docs/spec/V0-SPIKES.md` (S10), `docs/spec/BEHAVIOR-SPECS.md`, `specs/GLOSSARY.md`, `specs/behaviors/*.feature`, `specs/matrix/cue-handling.md`, `specs/UNSPECIFIED.md`, ADR-0001, ADR-0002, `CLAUDE.md`.

## Global Constraints

- **jqwik (checked, not assumed):** the latest version is 1.10.2. Its `jqwik-engine` POM depends on `junit-platform-engine` **1.14.4** (the JUnit 5 line). The 1.10.1 release notes say future releases "if ever realised, will be built on JUnit Platform 6". So jqwik does not support JUnit 6 yet. The project is also in maintenance mode, and since 1.10 its maintainers state it is not meant to be used by AI coding agents, which build this project. **Fallback (spike text: "minimal in-house runner"):** a small seeded property runner with shrinking (`Props`, Task 5) on plain JUnit Jupiter. Adopting jqwik would need an ADR.
- Cucumber runs through `@Suite`, with `cucumber.junit-platform.discovery.as-root-engine=false` so Gradle does not discover the features twice. Checked in the 8.0.4 sources: `PendingException` becomes `TestAbortedException` (Gradle: skipped), and an undefined step becomes `UndefinedStepException` (a failure). After a failed hook, steps run in `SKIP` mode, so an undefined step there is not reported as undefined.
- **`@pending`** is a new tag, decided by the architect in this plan. The hook `@Before("@pending")` throws `PendingException`, so each such scenario is skipped with a reason. `FeatureInventoryTest` lists them in `core/build/reports/behavior/pending.md` and fails if the runnable set drifts. Every `@proposed` scenario stays `@pending` until the human approves it (BEHAVIOR-SPECS workflow step 4).
- Runnable now: **17 of 67** scenarios, all `@decided`/`@open`, the cue-handling slice of features 01 and 02. **50 are pending.** Executors never edit `.feature` text. Task 1 only appends `@pending`, using the script in Task 1.
- `core` main and testFixtures have no `net.minecraft`/`net.fabricmc` imports. Task 3 extends `CoreBoundaryTest` to cover testFixtures.
- Simulation numbers are examples and live only in `SimConfig.defaults()`: hearing 16 blocks, attention 60 ticks (3 s), 3 wake calls.
- Simulation code is spike code (CLAUDE.md §1). ADR-0005 decides whether it graduates.
- Dev commands and the server-tick hook register only after the existing `DevMode.enabled()` guard (`-Dsmartpets.dev=true`).
- New dependencies are test-only (Cucumber, MIT). Nothing new ships in the mod jar.
- The repo is public: no absolute paths, user names or e-mails in committed files. The feature-directory path is computed in `mod/build.gradle` and lands only in `build/`.
- One task = one branch = one PR, with Conventional Commits. Each commit ends with the session's `Co-Authored-By:` trailer (CLAUDE.md §7). Run `bash scripts/qa/leak-check.sh` before each commit. The human merges.
- Never run two game instances. Run commands from the repo root.

## Review Focus

- Scenarios skipped without a trace. Test: `pending.md` lists exactly 50, and Gradle prints each as SKIPPED with the `@pending` reason (T1, T3).
- A `@proposed` behavior implemented as if it were decided. Test: `FeatureInventoryTest` enforces that `@proposed` implies `@pending`. Reviewer: R11, R12, R14–R16 and R19 produce only `UNSPECIFIED_SITUATION` + `head_tilt` in `SimWorld`.
- Green for the wrong reason. Test: with `-PsimFaults=ignore_protected_targets`, exactly the two "never targets" scenarios fail and the journal is printed (T3), and the property suite must fail on the same fault (T5).
- Ambiguous or greedy step expressions. Cucumber reports ambiguity as a failure. Dog names use `{dog}` = `[A-Z][a-z]+`, never `{word}`.
- Drift between the matrix table and its rules. Test: the table's ids must equal the ```` ```rules ```` ids, and unknown dimensions or values throw (T4).
- An in-game run that passes with zero scenarios. Test: Cucumber must exit 0, `PetSteps.PASSED == 1`, and a real measured `PET_PLACED` distance must be about 6 (T6).

## File Structure

```
core/build.gradle, core/src/test/resources/junit-platform.properties
core/src/main/java/dev/smartpets/core/EventJournal.java                (modify: null contract, immutable data)
core/src/main/java/dev/smartpets/core/sim/{SimConfig,SimWorld,SimScript}.java
core/src/testFixtures/java/dev/smartpets/spec/{PetWorld,PetWorlds,CorePetWorld,UnspecifiedCollector}.java
core/src/testFixtures/java/dev/smartpets/spec/steps/PetSteps.java
core/src/test/java/dev/smartpets/core/{EventJournalTest,CoreBoundaryTest}.java (modify)
core/src/test/java/dev/smartpets/core/sim/SimWorldTest.java
core/src/test/java/dev/smartpets/spec/{FeatureInventoryTest,BehaviorSuiteTest}.java
core/src/test/java/dev/smartpets/spec/matrix/{Matrix,MatrixReportTest}.java
core/src/test/java/dev/smartpets/spec/props/{Props,Scripts,BehaviorPropertiesTest}.java
specs/behaviors/*.feature (tags only), specs/GLOSSARY.md, specs/matrix/cue-handling.md
mod/build.gradle, mod/src/main/java/dev/smartpets/DevCommands.java      (modify)
mod/src/gametest/java/dev/smartpets/gametest/{GamePetWorld,PlatformScenarios}.java, SmartPetsClientGameTest.java (modify)
scripts/qa/run-client-gametest.sh                                       (modify)
docs/adr/0005-behavior-spec-framework.md, docs/spec/{V0-SPIKES,BEHAVIOR-SPECS}.md, MODLOG.md, CLAUDE.md, site/data/status.json, README.md
```
Order: T1 → (T2 ∥ T4) → T3 → (T5 ∥ T6) → T7. Each file has one owning task.

---

### Task 1: Dependencies, journal hardening, `@pending` inventory

Tier: MEDIUM. Branch: `feat/s10-deps`.

**Files:** Modify `core/build.gradle`, `EventJournal.java`, `EventJournalTest.java`, `specs/behaviors/*.feature` (tags), `specs/GLOSSARY.md`. Create `core/src/test/resources/junit-platform.properties`, `core/src/test/java/dev/smartpets/spec/FeatureInventoryTest.java`.

**Interfaces:** Produces the testFixtures source set and Cucumber on the test and testFixtures classpaths. `specs/` becomes test resources (`behaviors/…`, `matrix/…`). `-PsimFaults=<csv>` maps to the system property `smartpets.sim.faults`. `EventJournal.Entry` rejects nulls and has unmodifiable `data`. Writes `core/build/reports/behavior/pending.md`.

- [ ] **Step 1: Failing tests**

Append to `EventJournalTest` (add `import static org.junit.jupiter.api.Assertions.assertThrows;`):
```java
	@Test
	void rejectsNullsAndExposesImmutableData() {
		EventJournal j = new EventJournal(2);
		assertThrows(NullPointerException.class, () -> j.record(1, null, Map.of()));
		java.util.HashMap<String, String> m = new java.util.HashMap<>();
		m.put("k", null);
		assertThrows(NullPointerException.class, () -> j.record(1, "A", m));
		j.record(1, "A", Map.of("k", "v"));
		assertThrows(UnsupportedOperationException.class, () -> j.snapshot().get(0).data().put("x", "y"));
	}
```
`core/src/test/java/dev/smartpets/spec/FeatureInventoryTest.java`:
```java
package dev.smartpets.spec;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;
import org.junit.jupiter.api.Test;

/** Every scenario is tagged, the runnable set is explicit, and pending scenarios are listed, never silently skipped. */
class FeatureInventoryTest {
	record Sc(String file, int line, String name, Set<String> tags) {}

	static final Pattern SCENARIO = Pattern.compile("Scenario(?: Outline)?:\\s*(.+)");
	static final Set<String> RUNNABLE = Set.of(
		"Calling the name with no command", "Attention expires if no command follows",
		"Another dog's name does not get Rex's attention", "A dog that never learned its name only reacts to unknown sound",
		"Name beyond hearing range is ignored", "Waking a sleeping dog by name", "Repeating the name rapidly gives no extra effect",
		"Name then command", "Unknown cue after the name gives a head tilt", "Refusal is visible, not silent",
		"Attack on a hostile mob the player is looking at", "Attack never targets the player", "Attack never targets an ally dog",
		"A frightened dog refuses to attack a much stronger mob", "Commands are ignored while downed",
		"Sitting when already sitting is a no-op", "Two cues spoken back to back");

	static List<Sc> scan() throws IOException {
		List<Sc> out = new ArrayList<>();
		try (Stream<Path> fs = Files.list(Path.of("../specs/behaviors"))) {
			for (Path f : fs.filter(p -> p.toString().endsWith(".feature")).sorted().toList()) {
				List<String> lines = Files.readAllLines(f);
				Set<String> tags = new HashSet<>();
				for (int i = 0; i < lines.size(); i++) {
					String l = lines.get(i).strip();
					if (l.startsWith("@")) tags.addAll(List.of(l.split("\\s+")));
					Matcher m = SCENARIO.matcher(l);
					if (m.matches()) { out.add(new Sc(f.getFileName().toString(), i + 1, m.group(1).strip(), Set.copyOf(tags))); tags.clear(); }
				}
			}
		}
		return out;
	}

	@Test
	void everyScenarioIsTaggedAndPendingOnesAreReported() throws IOException {
		List<Sc> all = scan();
		assertEquals(67, all.size(), "scenario count changed: update this inventory with the Architect");
		for (Sc s : all) {
			assertEquals(1, s.tags().stream().filter(Set.of("@decided", "@proposed", "@open")::contains).count(), s.name());
			if (s.tags().contains("@proposed")) assertTrue(s.tags().contains("@pending"), "@proposed needs human OK: " + s.name());
		}
		Set<String> runnable = all.stream().filter(s -> !s.tags().contains("@pending")).map(Sc::name).collect(Collectors.toSet());
		assertEquals(RUNNABLE, runnable);
		all.stream().filter(s -> runnable.contains(s.name())).forEach(s -> assertTrue(s.tags().contains("@core"), s.name()));
		List<Sc> pending = all.stream().filter(s -> s.tags().contains("@pending")).toList();
		StringBuilder md = new StringBuilder("# Pending behavior scenarios (generated by FeatureInventoryTest)\n\n| Feature:line | Scenario | Tags |\n|---|---|---|\n");
		pending.forEach(s -> md.append("| ").append(s.file()).append(':').append(s.line()).append(" | ").append(s.name())
			.append(" | ").append(String.join(" ", new TreeSet<>(s.tags()))).append(" |\n"));
		Files.createDirectories(Path.of("build/reports/behavior"));
		Files.writeString(Path.of("build/reports/behavior/pending.md"), md);
		assertEquals(50, pending.size());
	}
}
```

- [ ] **Step 2: Wire the build and see it fail**

`core/build.gradle` (full file):
```groovy
plugins {
	id 'java-library'
	id 'java-test-fixtures'
}
repositories { mavenCentral() }
java {
	sourceCompatibility = JavaVersion.VERSION_25
	targetCompatibility = JavaVersion.VERSION_25
}
tasks.withType(JavaCompile).configureEach { it.options.release = 25 }
// Feature files and matrices are test resources (classpath "behaviors/...", "matrix/...").
sourceSets { test { resources { srcDir '../specs' } } }
dependencies {
	testImplementation platform('org.junit:junit-bom:6.1.3')
	testImplementation 'org.junit.jupiter:junit-jupiter'
	testImplementation 'org.junit.platform:junit-platform-suite'
	testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
	testFixturesApi platform('io.cucumber:cucumber-bom:8.0.4')
	testFixturesApi 'io.cucumber:cucumber-java'
	testImplementation platform('io.cucumber:cucumber-bom:8.0.4')
	testImplementation 'io.cucumber:cucumber-junit-platform-engine'
}
test {
	useJUnitPlatform()
	systemProperty 'smartpets.sim.faults', providers.gradleProperty('simFaults').getOrElse('')
	testLogging { events 'failed', 'skipped'; exceptionFormat 'full' }
}
```
`core/src/test/resources/junit-platform.properties`:
```properties
cucumber.junit-platform.discovery.as-root-engine=false
cucumber.publish.quiet=true
cucumber.plugin=summary
```
Run: `./gradlew :core:test`
Expected: FAIL. `rejectsNullsAndExposesImmutableData` gets no NPE, and `FeatureInventoryTest` reports `expected: <[17 names]> but was: <[67 names]>`. Also run `./gradlew :core:dependencies --configuration testRuntimeClasspath | grep -E 'junit-platform-engine|cucumber-core'`: it must show `6.1.3` and `8.0.4`, and no `1.14.x`.

- [ ] **Step 3: Implement the journal contract**

In `EventJournal.java`, replace the record and `record(...)`, then add imports `java.util.Collections` and `java.util.Objects`:
```java
	public record Entry(long tick, String type, Map<String, String> data) {
		public Entry {
			Objects.requireNonNull(type, "type");
			Objects.requireNonNull(data, "data");
			data.values().forEach(v -> Objects.requireNonNull(v, "data value"));
			data = Collections.unmodifiableMap(new TreeMap<>(data));
		}
	}
```
```java
	public synchronized void record(long tick, String type, Map<String, String> data) {
		Entry e = new Entry(tick, type, data);
		if (entries.size() == capacity) {
			entries.removeFirst();
		}
		entries.addLast(e);
	}
```

- [ ] **Step 4: Tag the pending scenarios (mechanical)**

```bash
python3 -I - <<'EOF'
import pathlib, re
src = pathlib.Path('core/src/test/java/dev/smartpets/spec/FeatureInventoryTest.java').read_text()
start = src.index('RUNNABLE = Set.of(')
keep = set(re.findall(r'"([^"]+)"', src[start:src.index(');', start)]))
assert len(keep) == 17, len(keep)
for f in sorted(pathlib.Path('specs/behaviors').glob('*.feature')):
    lines = f.read_text().split('\n')
    for i, l in enumerate(lines):
        m = re.match(r'\s*Scenario(?: Outline)?:\s*(.+)$', l)
        if m and m.group(1).strip() not in keep:
            assert lines[i - 1].strip().startswith('@'), (f.name, i)
            if '@pending' not in lines[i - 1]:
                lines[i - 1] += ' @pending'
    f.write_text('\n'.join(lines))
EOF
git diff --stat specs/behaviors && grep -c '@pending' specs/behaviors/*.feature
```
Expected: only tag lines change. Counts: 01→3, 02→8, 03→11, 04→9, 05→10, 06→9. Then add a row to the `specs/GLOSSARY.md` tag table: `| @pending | Not runnable yet (no simulation support, or awaiting human OK). Reported as skipped and listed in core/build/reports/behavior/pending.md; never silently skipped. |`

- [ ] **Step 5: Verify and commit**

Run: `./gradlew :core:test && wc -l core/build/reports/behavior/pending.md`
Expected: PASS (7 tests). `pending.md` has 54 lines.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "test(s10): wire Cucumber 8.0.4, harden EventJournal, tag pending scenarios"
```

---

### Task 2: Core simulation slice

Tier: MEDIUM. Branch: `feat/s10-sim`. Depends on Task 1.

**Files:** Create `core/src/main/java/dev/smartpets/core/sim/{SimConfig,SimWorld,SimScript}.java`, `core/src/test/java/dev/smartpets/core/sim/SimWorldTest.java`.

**Interfaces:**
- `new SimScript(SimConfig)`, `String exec(String line)`, `SimWorld world()`.
- Protocol: `reset <seed>` · `dog <Name>` · `namecue <Name> <token|->` · `cue <Name> <token> <COMMAND> <mastery>` · `bond <Name> <pct>` · `state <Name> <state|sitting>` · `distance <Name> <blocks|out>` · `will <Name> <0..1>` · `mob <kind> <blocks>` · `look <target>` · `say <token>` · `wait <seconds>` · `tick`.
- Journal events (data always has `pet` except where noted): `ATTENTION_GAINED`, `ATTENTION_EXPIRED`, `REACTION{reaction}`, `COMMAND_PERFORMED{command}`, `COMMAND_REFUSED{command,reason}`, `COMMAND_REDUNDANT{command}`, `ATTACK_STARTED{target}`, `WAKE_STEP_n`, `WOKE_UP`, `PET_PLACED{distance}`, `UNSPECIFIED_SITUATION{situation,default}`. Without `pet`: `MOB_PLACED`, `ENGINE_ERROR{error}`, `FAULT_INJECTED{faults}`.

- [ ] **Step 1: Failing tests**

`core/src/test/java/dev/smartpets/core/sim/SimWorldTest.java`:
```java
package dev.smartpets.core.sim;

import static org.junit.jupiter.api.Assertions.*;

import dev.smartpets.core.EventJournal;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SimWorldTest {
	private SimScript s = new SimScript(SimConfig.defaults());

	private void run(String... lines) { for (String l : lines) s.exec(l); }
	private List<String> types() { return s.world().journal().snapshot().stream().map(EventJournal.Entry::type).toList(); }
	private boolean has(String type, String key, String value) {
		return s.world().journal().snapshot().stream().anyMatch(e -> e.type().equals(type) && value.equals(e.data().get(key)));
	}

	@BeforeEach
	void setUp() { run("reset 42", "dog Rex", "namecue Rex felicia", "cue Rex potato SIT 1", "cue Rex blitz ATTACK 1", "will Rex 1"); }

	@Test
	void nameGainsAttentionOnceAndItExpiresAfterTheWindow() {
		run("say felicia", "say felicia", "wait 2.9");
		assertFalse(types().contains("ATTENTION_EXPIRED"));
		run("wait 0.2");
		assertTrue(types().contains("ATTENTION_EXPIRED"));
		assertEquals(1, Collections.frequency(types(), "ATTENTION_GAINED"));
		assertTrue(has("REACTION", "reaction", "look_at_player"));
	}

	@Test
	void nameThenCommandPerformsAndASecondCommandIsUnspecified() {
		run("say felicia", "say potato", "say blitz");
		assertTrue(has("COMMAND_PERFORMED", "command", "SIT"));
		assertTrue(has("UNSPECIFIED_SITUATION", "situation", "two_commands"));
	}

	@Test
	void attackOnPlayerIsRefusedUnlessTheFaultIsInjected() {
		run("look player", "say felicia", "say blitz");
		assertTrue(has("COMMAND_REFUSED", "reason", "protected_target"));
		assertFalse(types().contains("ATTACK_STARTED"));
		s = new SimScript(SimConfig.defaults().withFaults("ignore_protected_targets"));
		setUp();
		run("look player", "say felicia", "say blitz");
		assertTrue(has("ATTACK_STARTED", "target", "player"));
		assertTrue(types().contains("FAULT_INJECTED"));
	}

	@Test
	void wakeLadderNeedsThreeCallsAsleepAndOneDozing() {
		run("state Rex asleep", "say felicia");
		assertTrue(types().contains("WAKE_STEP_1") && !types().contains("WOKE_UP"));
		run("say felicia", "say felicia", "state Rex dozing", "say felicia");
		assertEquals(2, Collections.frequency(types(), "WOKE_UP"));
	}

	@Test
	void outOfRangeOrDownedHearsNothingAndSameSeedSameJournal() {
		run("distance Rex out", "say felicia", "distance Rex 4", "state Rex downed", "say felicia");
		assertFalse(types().contains("ATTENTION_GAINED"));
		run("reset 7", "dog Rex", "namecue Rex felicia", "cue Rex potato SIT 1", "say felicia", "say potato");
		String first = s.world().journal().toJsonLines();
		run("reset 7", "dog Rex", "namecue Rex felicia", "cue Rex potato SIT 1", "say felicia", "say potato");
		assertEquals(first, s.world().journal().toJsonLines());
		assertThrows(IllegalArgumentException.class, () -> s.exec("fly Rex"));
	}
}
```
Run: `./gradlew :core:test --tests 'dev.smartpets.core.sim.*'`. Expected: FAIL (compile error: `SimScript` not found).

- [ ] **Step 2: Implement**

`SimConfig.java`:
```java
package dev.smartpets.core.sim;

import java.util.Set;

/** Example values (CLAUDE.md §2), to tune by playing. The only place these numbers live. */
public record SimConfig(double hearingRange, int attentionTicks, int wakeCallsWhenAsleep, int ticksPerSecond, int journalCapacity,
	Set<String> faults) {
	public SimConfig { faults = Set.copyOf(faults); }

	public static SimConfig defaults() { return new SimConfig(16, 60, 3, 20, 4096, Set.of()); }

	/** Test-only fault injection for the S10 seeded-bug check. Comma-separated, empty = none. Journaled as FAULT_INJECTED. */
	public SimConfig withFaults(String csv) {
		return new SimConfig(hearingRange, attentionTicks, wakeCallsWhenAsleep, ticksPerSecond, journalCapacity,
			csv.isBlank() ? Set.of() : Set.of(csv.split(",")));
	}

	public boolean hasFault(String f) { return faults.contains(f); }
}
```
`SimWorld.java`:
```java
package dev.smartpets.core.sim;

import dev.smartpets.core.EventJournal;
import java.util.*;

/** S10 spike: deterministic cue-handling slice (cue-handling.md R1, R2, R4-R10, R13, R18). Disposable unless ADR-0005 graduates it. */
public final class SimWorld {
	private static final Set<String> HOSTILE = Set.of("zombie", "creeper");
	private static final Set<String> STRONGER = Set.of("iron_golem");

	private record Cue(String command, int mastery) {}

	private static final class Pet {
		final String name;
		final Map<String, Cue> cues = new HashMap<>();
		String nameCue, state = "calm";
		boolean sitting;
		double distance = 4, willingness = -1;
		int bond = 50, commandsSinceName, wakeCalls;
		long attentionUntil = -1;
		Pet(String name) { this.name = name; }
	}

	private final SimConfig config;
	private final SplittableRandom rng;
	private final EventJournal journal;
	private final Map<String, Pet> pets = new LinkedHashMap<>();
	private String lookTarget = "nothing";
	private long tick;

	public SimWorld(SimConfig config, long seed) {
		this.config = config;
		this.rng = new SplittableRandom(seed);
		this.journal = new EventJournal(config.journalCapacity());
		if (!config.faults().isEmpty()) log("FAULT_INJECTED", Map.of("faults", String.join(",", new TreeSet<>(config.faults()))));
	}

	public EventJournal journal() { return journal; }
	public void addDog(String name) { pets.putIfAbsent(name, new Pet(name)); }
	public void teachName(String dog, String token) { pet(dog).nameCue = token; }
	public void teachCue(String dog, String token, String command, int mastery) { pet(dog).cues.put(token, new Cue(command, mastery)); }
	public void setBond(String dog, int percent) { pet(dog).bond = percent; }
	public void setWillingness(String dog, double w) { pet(dog).willingness = w; }
	public void lookAt(String target) { lookTarget = target; }
	public void addMob(String kind, double blocks) { log("MOB_PLACED", Map.of("mob", kind, "distance", String.valueOf(blocks))); }

	public void setState(String dog, String state) {
		Pet p = pet(dog);
		if (state.equals("sitting")) p.sitting = true; else p.state = state;
	}

	public void setDistance(String dog, double blocks) {
		pet(dog).distance = blocks;
		log("PET_PLACED", data(pet(dog), "distance", String.valueOf(blocks)));
	}

	public void tick() {
		tick++;
		for (Pet p : pets.values()) {
			if (p.attentionUntil >= 0 && tick >= p.attentionUntil) { p.attentionUntil = -1; log("ATTENTION_EXPIRED", data(p)); }
		}
	}

	public void advanceSeconds(double seconds) { for (long i = Math.round(seconds * config.ticksPerSecond()); i > 0; i--) tick(); }

	public void say(String token) {
		try {
			for (Pet p : pets.values()) hear(p, token);
		} catch (RuntimeException e) {
			log("ENGINE_ERROR", Map.of("error", String.valueOf(e)));
			throw e;
		}
	}

	private void hear(Pet p, String token) {
		if (p.distance > config.hearingRange() || p.state.equals("downed")) return;                 // R1, R2
		boolean sleeping = p.state.equals("asleep") || p.state.equals("dozing");
		if (token.equals(p.nameCue)) { onName(p, sleeping); return; }
		if (pets.values().stream().anyMatch(o -> o != p && token.equals(o.nameCue))) return;        // R8
		if (sleeping) return;                                                                         // R5
		Cue cue = p.cues.get(token);
		if (cue == null) { react(p, "head_tilt"); return; }                                          // R7, R9: unknown sound
		if (p.attentionUntil <= tick) { unspecified(p, "command_without_attention"); return; }       // R14-R16 are @proposed
		if (p.commandsSinceName++ > 0) { unspecified(p, "two_commands"); return; }                   // R18 is @open
		switch (cue.command()) {
			case "SIT" -> sit(p);
			case "ATTACK" -> attack(p);
			default -> unspecified(p, "command_not_simulated:" + cue.command());
		}
	}

	private void onName(Pet p, boolean sleeping) {
		if (sleeping) {                                                                               // R4 wake ladder
			int needed = p.state.equals("dozing") ? 1 : config.wakeCallsWhenAsleep();
			if (++p.wakeCalls >= needed) { p.state = "calm"; p.wakeCalls = 0; log("WOKE_UP", data(p)); }
			else { log("WAKE_STEP_" + p.wakeCalls, data(p)); react(p, "wake_step_" + p.wakeCalls); }
			return;
		}
		if (p.attentionUntil > tick) return;                                                          // repeated name: no extra effect (@open)
		p.attentionUntil = tick + config.attentionTicks();
		p.commandsSinceName = 0;
		log("ATTENTION_GAINED", data(p));                                                            // R6
		react(p, "look_at_player");
	}

	private void sit(Pet p) {
		if (p.sitting) log("COMMAND_REDUNDANT", data(p, "command", "SIT"));
		else if (!willing(p)) refuse(p, "SIT", "unwilling", "ignore");
		else { p.sitting = true; log("COMMAND_PERFORMED", data(p, "command", "SIT")); }
	}

	private void attack(Pet p) {
		String t = lookTarget;
		boolean guarded = t.equals("player") || pets.containsKey(t);
		if (guarded && !config.hasFault("ignore_protected_targets")) refuse(p, "ATTACK", "protected_target", "head_tilt"); // R10
		else if (STRONGER.contains(t) && p.state.equals("scared")) refuse(p, "ATTACK", "fear", "whine");               // R13
		else if (!guarded && !HOSTILE.contains(t)) unspecified(p, "attack_target:" + t);                               // R11, R12 @proposed
		else if (!willing(p)) refuse(p, "ATTACK", "unwilling", "ignore");
		else { log("ATTACK_STARTED", data(p, "target", t)); log("COMMAND_PERFORMED", data(p, "command", "ATTACK")); }
	}

	private boolean willing(Pet p) { return rng.nextDouble() < (p.willingness >= 0 ? p.willingness : p.bond / 100.0); }
	private void refuse(Pet p, String command, String reason, String reaction) { log("COMMAND_REFUSED", data(p, "command", command, "reason", reason)); react(p, reaction); }
	private void unspecified(Pet p, String situation) { log("UNSPECIFIED_SITUATION", data(p, "situation", situation, "default", "head_tilt")); react(p, "head_tilt"); }
	private void react(Pet p, String reaction) { log("REACTION", data(p, "reaction", reaction)); }
	private void log(String type, Map<String, String> d) { journal.record(tick, type, d); }

	private static Map<String, String> data(Pet p, String... kv) {
		Map<String, String> m = new TreeMap<>(Map.of("pet", p.name));
		for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
		return m;
	}

	private Pet pet(String name) {
		Pet p = pets.get(name);
		if (p == null) throw new IllegalArgumentException("unknown pet: " + name);
		return p;
	}
}
```
`SimScript.java`:
```java
package dev.smartpets.core.sim;

/** One-line text protocol shared by the core driver and the in-game dev command: one route, two speeds. */
public final class SimScript {
	private final SimConfig config;
	private volatile SimWorld world;

	public SimScript(SimConfig config) { this.config = config; this.world = new SimWorld(config, 0); }

	public SimWorld world() { return world; }

	public synchronized String exec(String line) {
		String[] a = line.strip().split("\\s+");
		SimWorld w = world;
		switch (a[0]) {
			case "reset" -> world = new SimWorld(config, Long.parseLong(a[1]));
			case "dog" -> w.addDog(a[1]);
			case "namecue" -> w.teachName(a[1], a[2].equals("-") ? null : a[2]);
			case "cue" -> w.teachCue(a[1], a[2], a[3], Integer.parseInt(a[4]));
			case "bond" -> w.setBond(a[1], Integer.parseInt(a[2]));
			case "state" -> w.setState(a[1], a[2]);
			case "distance" -> w.setDistance(a[1], a[2].equals("out") ? Double.POSITIVE_INFINITY : Double.parseDouble(a[2]));
			case "will" -> w.setWillingness(a[1], Double.parseDouble(a[2]));
			case "mob" -> w.addMob(a[1], Double.parseDouble(a[2]));
			case "look" -> w.lookAt(a[1]);
			case "say" -> w.say(a[1]);
			case "wait" -> w.advanceSeconds(Double.parseDouble(a[1]));
			case "tick" -> w.tick();
			default -> throw new IllegalArgumentException("unknown sim op: " + a[0]);
		}
		return "ok " + line.strip();
	}
}
```

- [ ] **Step 3: Verify and commit**

Run: `./gradlew :core:test`. Expected: PASS, 12 tests (5 sim + 7 earlier), and `CoreBoundaryTest` still green.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "feat(s10): add deterministic cue-handling simulation slice"
```

---

### Task 3: Driver, step definitions, Cucumber suite, `UNSPECIFIED` capture

Tier: STRONG (step-vocabulary design; red-for-the-right-reason check). Branch: `feat/s10-steps`. Depends on Task 2.

**Files:** Create the testFixtures classes `PetWorld`, `PetWorlds`, `CorePetWorld`, `UnspecifiedCollector`, `steps/PetSteps`, and the test `BehaviorSuiteTest`. Modify `CoreBoundaryTest`.

**Interfaces:**
- `interface PetWorld { void send(String simLine); void addDog(String); void placeDog(String, double); void advanceSeconds(double); List<EventJournal.Entry> journal(); }`
- `PetWorlds.use(Supplier<PetWorld>)` (default `CorePetWorld::new`) and `PetWorlds.create()`.
- `PetSteps.PASSED` (AtomicInteger) and `PetSteps.dump(List<Entry>)`. Glue class `dev.smartpets.spec.steps.PetSteps`.
- `UnspecifiedCollector.collect(String source, List<Entry>)` writes `<smartpets.reports.dir | build/reports/behavior>/unspecified-rows.md` in the `specs/UNSPECIFIED.md` row format.

Step vocabulary, taken from the 17 runnable scenarios by grep of the real files; every phrase is in GLOSSARY.
- Given: `a world with default test config and the random seed is {int}` · `a player` · `an adult dog named {string}` · `a second dog named {string}` · `{dog} knows the name cue {string}` · `{dog} does not know any name cue` · `{dog} knows the command cue {string} for {word} at mastery {int}` · `{dog}'s bond with the player is {int}%` · `{dog} is {state}` · `{dog} is {int} blocks from the player` · `{dog} is outside hearing range` · `{dog} is obedient|stubborn today` · `a/an {mob} {int} blocks away`.
- When: `the player says the name cue of {dog}` [`{int} times` [`within {int} seconds`]] · `the player says {string}` · `the player looks at a/an {mob}|the player|nothing|{dog}` · `{int} seconds pass`.
- Then: `{dog} shows|does not show {word}` · `{dog} performs|does not perform {word}` · `{dog} does not perform any command` · `{dog} attacks the {mob}` · `{dog} does not attack the {mob}|the player|{dog}` · `{dog} does not crash` · `the journal contains|does not contain {string}` · `the journal contains {string} exactly {int} time(s)`.

- [ ] **Step 1: Failing suite**

`core/src/test/java/dev/smartpets/spec/BehaviorSuiteTest.java`:
```java
package dev.smartpets.spec;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;

import org.junit.platform.suite.api.*;

/** Runs every @core scenario of specs/behaviors on the core driver; @pending ones are reported as skipped. */
@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("behaviors")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "dev.smartpets.spec.steps")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@core")
public class BehaviorSuiteTest {}
```
Run: `./gradlew :core:test`. Expected: FAIL. All 67 scenarios (69 test cases with outline rows) fail with `UndefinedStepException`, because there is no glue yet. This proves features are discovered from the classpath. Record the counts in `MODLOG.md`.

- [ ] **Step 2: Driver and collector (testFixtures, package `dev.smartpets.spec`)**

`PetWorld.java`:
```java
package dev.smartpets.spec;

import dev.smartpets.core.EventJournal;
import java.util.List;

/** Behavior-spec driver. Core: in-memory SimScript. Platform: the same lines through the server command handler. */
public interface PetWorld {
	void send(String simLine);
	void addDog(String dog);
	void placeDog(String dog, double blocks);
	void advanceSeconds(double seconds);
	List<EventJournal.Entry> journal();
}
```
`PetWorlds.java`:
```java
package dev.smartpets.spec;

import java.util.function.Supplier;

public final class PetWorlds {
	private static volatile Supplier<PetWorld> factory = CorePetWorld::new;
	private PetWorlds() {}
	public static void use(Supplier<PetWorld> f) { factory = f; }
	public static PetWorld create() { return factory.get(); }
}
```
`CorePetWorld.java`:
```java
package dev.smartpets.spec;

import dev.smartpets.core.EventJournal;
import dev.smartpets.core.sim.SimConfig;
import dev.smartpets.core.sim.SimScript;
import java.util.List;

public final class CorePetWorld implements PetWorld {
	private final SimScript sim = new SimScript(SimConfig.defaults().withFaults(System.getProperty("smartpets.sim.faults", "")));
	@Override public void send(String line) { sim.exec(line); }
	@Override public void addDog(String dog) { send("dog " + dog); }
	@Override public void placeDog(String dog, double blocks) { send("distance " + dog + " " + blocks); }
	@Override public void advanceSeconds(double s) { send("wait " + s); }
	@Override public List<EventJournal.Entry> journal() { return sim.world().journal().snapshot(); }
}
```
`UnspecifiedCollector.java`:
```java
package dev.smartpets.spec;

import dev.smartpets.core.EventJournal;
import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Turns UNSPECIFIED_SITUATION journal events into candidate rows for specs/UNSPECIFIED.md (the architect triages). */
public final class UnspecifiedCollector {
	private static final Map<String, String> ROWS = new TreeMap<>();
	private UnspecifiedCollector() {}

	public static synchronized void collect(String source, List<EventJournal.Entry> journal) {
		for (EventJournal.Entry e : journal) {
			if (!e.type().equals("UNSPECIFIED_SITUATION")) continue;
			String sit = e.data().getOrDefault("situation", "?");
			ROWS.putIfAbsent(sit, "| new | " + sit + " (first seen: " + source.replace('|', '/') + ") | "
				+ e.data().getOrDefault("default", "?") + " | (architect) | pending |");
		}
		Path dir = Path.of(System.getProperty("smartpets.reports.dir", "build/reports/behavior"));
		try {
			Files.createDirectories(dir);
			Files.writeString(dir.resolve("unspecified-rows.md"),
				"| # | Situation | Safe default now | Proposal | Decision |\n|---|---|---|---|---|\n" + String.join("\n", ROWS.values()) + "\n");
		} catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}
}
```

- [ ] **Step 3: Step definitions**

`core/src/testFixtures/java/dev/smartpets/spec/steps/PetSteps.java`:
```java
package dev.smartpets.spec.steps;

import dev.smartpets.core.EventJournal.Entry;
import dev.smartpets.spec.*;
import io.cucumber.java.*;
import io.cucumber.java.en.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/** Glue for specs/behaviors. Talks only to PetWorld; asserts only on the event journal. */
public class PetSteps {
	public static final AtomicInteger PASSED = new AtomicInteger();
	private final PetWorld w = PetWorlds.create();
	private final Map<String, String> nameCues = new HashMap<>();

	@ParameterType("[A-Z][a-z]+") public String dog(String s) { return s; }
	@ParameterType("zombie|creeper|cow|villager|iron golem") public String mob(String s) { return s.replace(' ', '_'); }
	@ParameterType("calm|excited|tired|scared|hungry|full|asleep|dozing|downed|sitting|lying") public String state(String s) { return s; }

	@Before(value = "@pending", order = 1)
	public void pending() { throw new PendingException("@pending: not runnable in S10; see core/build/reports/behavior/pending.md"); }

	@After
	public void after(Scenario s) {
		UnspecifiedCollector.collect(s.getName(), w.journal());
		if (s.getStatus() == Status.PASSED) PASSED.incrementAndGet();
	}

	@Given("a world with default test config and the random seed is {int}") public void world(int seed) { w.send("reset " + seed); }
	@Given("a player") public void player() {}
	@Given("an adult dog named {string}") public void adultDog(String n) { w.addDog(n); }
	@Given("a second dog named {string}") public void secondDog(String n) { w.addDog(n); }
	@Given("{dog} knows the name cue {string}") public void knowsName(String d, String t) { nameCues.put(d, t); w.send("namecue " + d + " " + t); }
	@Given("{dog} does not know any name cue") public void noName(String d) { nameCues.remove(d); w.send("namecue " + d + " -"); }
	@Given("{dog} knows the command cue {string} for {word} at mastery {int}")
	public void knowsCue(String d, String t, String c, int m) { w.send("cue " + d + " " + t + " " + c + " " + m); }
	@Given("{dog}'s bond with the player is {int}%") public void bond(String d, int p) { w.send("bond " + d + " " + p); }
	@Given("{dog} is {state}") public void setState(String d, String s) { w.send("state " + d + " " + s); }
	@Given("{dog} is {int} blocks from the player") public void place(String d, int b) { w.placeDog(d, b); }
	@Given("{dog} is outside hearing range") public void outOfRange(String d) { w.send("distance " + d + " out"); }
	@Given("{dog} is obedient today") public void obedient(String d) { w.send("will " + d + " 1"); }
	@Given("{dog} is stubborn today") public void stubborn(String d) { w.send("will " + d + " 0"); }
	@Given("a/an {mob} {int} blocks away") public void addMob(String m, int b) { w.send("mob " + m + " " + b); }

	@When("the player says the name cue of {dog}") public void callName(String d) { w.send("say " + cueOf(d)); }
	@When("the player says the name cue of {dog} {int} times") public void callTimes(String d, int n) { for (int i = 0; i < n; i++) callName(d); }
	@When("the player says the name cue of {dog} {int} times within {int} seconds")
	public void callWithin(String d, int n, int s) {
		for (int i = 0; i < n; i++) { callName(d); if (i < n - 1) w.advanceSeconds((double) s / n); }
	}
	@When("the player says {string}") public void say(String t) { w.send("say " + t); }
	@When("the player looks at a/an {mob}") public void lookMob(String m) { w.send("look " + m); }
	@When("the player looks at the player") public void lookPlayer() { w.send("look player"); }
	@When("the player looks at nothing") public void lookNothing() { w.send("look nothing"); }
	@When("the player looks at {dog}") public void lookDog(String d) { w.send("look " + d); }
	@When("{int} seconds pass") public void pass(int s) { w.advanceSeconds(s); }

	@Then("{dog} shows {word}") public void shows(String d, String r) { reaction(d, r, true); }
	@Then("{dog} does not show {word}") public void notShows(String d, String r) { reaction(d, r, false); }
	@Then("{dog} performs {word}") public void performs(String d, String c) { command(d, c, true); }
	@Then("{dog} does not perform {word}") public void notPerforms(String d, String c) { command(d, c, false); }
	@Then("{dog} does not perform any command") public void noCommand(String d) { expect(e -> is(e, "COMMAND_PERFORMED", d), false, d + " performs a command"); }
	@Then("{dog} attacks the {mob}") public void attacks(String d, String m) { attack(d, m, true); }
	@Then("{dog} does not attack the {mob}") public void notAttacksMob(String d, String m) { attack(d, m, false); }
	@Then("{dog} does not attack the player") public void notAttacksPlayer(String d) { attack(d, "player", false); }
	@Then("{dog} does not attack {dog}") public void notAttacksDog(String d, String t) { attack(d, t, false); }
	@Then("{dog} does not crash") public void noCrash(String d) { expect(e -> e.type().equals("ENGINE_ERROR"), false, "an engine error"); }
	@Then("the journal contains {string}") public void contains(String t) { countIs(t, n -> n > 0, "at least once"); }
	@Then("the journal does not contain {string}") public void notContains(String t) { countIs(t, n -> n == 0, "never"); }
	@Then("the journal contains {string} exactly {int} time(s)") public void exactly(String t, int k) { countIs(t, n -> n == k, "exactly " + k + "x"); }

	private String cueOf(String d) {
		String t = nameCues.get(d);
		if (t == null) throw new IllegalStateException(d + " has no name cue in this scenario");
		return t;
	}

	private void reaction(String d, String r, boolean present) { expect(e -> is(e, "REACTION", d) && r.equals(e.data().get("reaction")), present, d + " shows " + r); }
	private void command(String d, String c, boolean present) { expect(e -> is(e, "COMMAND_PERFORMED", d) && c.equals(e.data().get("command")), present, d + " performs " + c); }
	private void attack(String d, String t, boolean present) { expect(e -> is(e, "ATTACK_STARTED", d) && t.equals(e.data().get("target")), present, d + " attacks " + t); }
	private static boolean is(Entry e, String type, String dog) { return e.type().equals(type) && dog.equals(e.data().get("pet")); }

	private void expect(Predicate<Entry> p, boolean present, String what) {
		List<Entry> j = w.journal();
		if (j.stream().anyMatch(p) != present) throw new AssertionError((present ? "expected: " : "expected NOT: ") + what + "\n" + dump(j));
	}

	private void countIs(String type, Predicate<Long> ok, String what) {
		List<Entry> j = w.journal();
		long n = j.stream().filter(e -> e.type().equals(type)).count();
		if (!ok.test(n)) throw new AssertionError("expected " + type + " " + what + ", got " + n + "\n" + dump(j));
	}

	public static String dump(List<Entry> j) {
		StringBuilder sb = new StringBuilder("journal:\n");
		j.forEach(e -> sb.append("  ").append(e.tick()).append(' ').append(e.type()).append(' ').append(e.data()).append('\n'));
		return sb.toString();
	}
}
```
In `CoreBoundaryTest.coreNeverImportsMinecraftOrFabric`, loop over `List.of("src/main/java", "src/testFixtures/java")` and walk `Path.of(root)` for each. Rename the method to `coreAndFixturesNeverImportMinecraftOrFabric`.

- [ ] **Step 4: Green, with pending reported**

Run: `./gradlew :core:test 2>&1 | grep -c 'SKIPPED'; cat core/build/reports/behavior/unspecified-rows.md`
Expected: BUILD SUCCESSFUL and 50 SKIPPED lines, each with the `@pending` reason. 19 runnable test cases pass (17 scenarios; the outline expands to 3). `unspecified-rows.md` has a `two_commands` row first seen in `Two cues spoken back to back`. If Cucumber reports an ambiguous step, tighten the parameter types. Never edit the `.feature` file.

- [ ] **Step 5: Red for the right reason**

Run: `./gradlew :core:test -PsimFaults=ignore_protected_targets --tests 'dev.smartpets.spec.BehaviorSuiteTest'`
Expected: FAIL in exactly `Attack never targets the player` and `Attack never targets an ally dog`, with `expected NOT: Rex attacks player` / `… Fido` and a journal dump that shows `FAULT_INJECTED` and `ATTACK_STARTED`. Paste both failure headers into `MODLOG.md`.

- [ ] **Step 6: Commit**

```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "test(s10): run behavior scenarios on the core driver with journal assertions"
```

---

### Task 4: Matrix expander and unspecified-cell report

Tier: MEDIUM (spec edit reviewed by the Architect). Branch: `feat/s10-matrix`. Depends on Task 1 and can run in parallel with Task 2.

**Files:** Modify `specs/matrix/cue-handling.md`. Create `core/src/test/java/dev/smartpets/spec/matrix/{Matrix,MatrixReportTest}.java`.

**Interfaces:**
- `Matrix.parse(String md)` reads three things: the Dimensions table (values split on `·`, `(…)` notes stripped), the rule ids of the Rules table, and a ```` ```rules ```` block. Block grammar: `Rn: clause & clause`, where a clause is `dim=v` | `dim!=v` | `dim in a,b`. Keywords: `invariant` (not part of first-match) and `fallback` (R25). `#` starts a comment.
- Writes `core/build/reports/behavior/matrix-cue-handling.md`. Full expansion is 707,616 cells, cheap enough that pairwise is not needed (ADR-0005 records this).

- [ ] **Step 1: Make the table machine-readable (no behavior change)**

In `cue-handling.md`, add a Dimensions row after `input_channel`: `| command | SIT · ATTACK |`. Below the table, add: "`command` = the command the spoken cue maps to (R10–R13 already reference it; ignored when `input` has no command)." Append at the end:
````markdown
## Machine-readable rules (read by the S10 expander; keep in sync with the table above)
```rules
R1: hearing=out_of_range
R2: dog_state=downed
R3: dog_state=frenzy
R4: dog_state in asleep,dozing & input in name_only,name_then_command,command_then_name,unknown_after_name
R5: dog_state in asleep,dozing & input in command_only,two_commands
R6: input=name_only
R7: learned=name_unknown
R8: input=other_dogs_name
R9: input=unknown_after_name
R10: target in player,ally_pet & command=ATTACK
R11: target in villager,passive_animal & command=ATTACK
R12: target=none & command=ATTACK
R13: target=stronger_mob & dog_state=scared
R14: input=command_only & dogs_in_range=several
R15: input=command_only & learned=cue_known_mastery_high & dogs_in_range=one
R16: input=command_only & learned=cue_known_mastery_low
R17: input=command_then_name
R18: input=two_commands
R19: dog_state=tired
R20: bond=low & learned!=cue_known_mastery_high
R21: speaker=other_person
R22: invariant   # same behavior for every input_channel; checked by scenarios, not first-match
R23: dog_state=wild
R24: dog_state=puppy   # "command not yet learnable" has no dimension yet: over-approximated
R25: fallback
```
````

- [ ] **Step 2: Failing test**

`MatrixReportTest.java`:
```java
package dev.smartpets.spec.matrix;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class MatrixReportTest {
	@Test
	void cueHandlingTableIsConsistentAndUnspecifiedCellsAreReported() throws Exception {
		Matrix m = Matrix.parse(Files.readString(Path.of("../specs/matrix/cue-handling.md")));
		assertEquals(m.tableIds, m.rules.stream().map(Matrix.Rule::id).collect(Collectors.toCollection(LinkedHashSet::new)),
			"every table rule needs exactly one line in the rules block, same order");
		Map<String, Long> perRule = new TreeMap<>(Comparator.comparingInt(k -> k.equals("UNSPECIFIED") ? 999 : Integer.parseInt(k.substring(1))));
		Map<String, Long> groups = new HashMap<>();
		long[] n = new long[3]; // cells, unspecified, unspecified inside the safety slice
		m.expand(c -> {
			n[0]++;
			String r = m.firstMatch(c);
			perRule.merge(r == null ? "UNSPECIFIED" : r, 1L, Long::sum);
			if (r != null) return;
			n[1]++;
			groups.merge(c.get("input") + " | " + c.get("target") + " | " + c.get("dog_state") + " | " + c.get("command"), 1L, Long::sum);
			if (Set.of("player", "ally_pet").contains(c.get("target")) && c.get("command").equals("ATTACK")) n[2]++;
		});
		StringBuilder md = new StringBuilder("# Matrix report: cue-handling (generated by MatrixReportTest)\n\nCells: " + n[0]
			+ " · Unspecified cells (reach R25): " + n[1] + "\n\n| Rule | Cells (first match) |\n|---|---|\n");
		perRule.forEach((k, v) -> md.append("| ").append(k).append(" | ").append(v).append(" |\n"));
		md.append("\nShadowed rules (never first match): ")
			.append(m.rules.stream().filter(r -> r.kind().equals("rule") && !perRule.containsKey(r.id())).map(Matrix.Rule::id).toList());
		md.append("\n\n## Unspecified groups, top 100\n\n| input | target | dog_state | command | cells |\n|---|---|---|---|---|\n");
		groups.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
			.limit(100).forEach(e -> md.append("| ").append(e.getKey()).append(" | ").append(e.getValue()).append(" |\n"));
		Files.createDirectories(Path.of("build/reports/behavior"));
		Files.writeString(Path.of("build/reports/behavior/matrix-cue-handling.md"), md);
		assertEquals(707_616, n[0]);
		assertEquals(0, n[2], "safety slice (target player/ally_pet with ATTACK) must be fully specified");
	}

	@Test
	void unknownDimensionOrValueIsRejected() {
		String md = "## Dimensions\n| Dimension | Values |\n|---|---|\n| input | a · b |\n## Rules\n| # | When |\n|---|---|\n| R1 | x |\n```rules\nR1: input=c\n```\n";
		assertThrows(IllegalArgumentException.class, () -> Matrix.parse(md));
	}
}
```
Run: `./gradlew :core:test --tests 'dev.smartpets.spec.matrix.*'`. Expected: FAIL (compile error: `Matrix` not found).

- [ ] **Step 3: Implement**

`Matrix.java`:
```java
package dev.smartpets.spec.matrix;

import java.util.*;
import java.util.function.*;

/** Expands a decision table (specs/matrix/*.md). The first matching rule wins; no match = UNSPECIFIED. */
final class Matrix {
	record Rule(String id, Predicate<Map<String, String>> when, String kind) {}

	final LinkedHashMap<String, List<String>> dims = new LinkedHashMap<>();
	final List<Rule> rules = new ArrayList<>();
	final Set<String> tableIds = new LinkedHashSet<>();

	static Matrix parse(String md) {
		Matrix m = new Matrix();
		String section = "";
		boolean inRules = false;
		for (String raw : md.split("\n")) {
			String l = raw.strip();
			if (l.startsWith("## ")) section = l;
			if (l.equals("```rules")) { inRules = true; continue; }
			if (inRules && l.equals("```")) { inRules = false; continue; }
			if (inRules) { if (!l.isEmpty() && !l.startsWith("#")) m.rules.add(m.rule(l)); continue; }
			String[] c = l.split("\\|");
			if (!l.startsWith("|") || l.startsWith("|---") || c.length < 3) continue;
			String a = c[1].strip(), b = c[2].strip();
			if (section.startsWith("## Dimensions") && !a.equals("Dimension"))
				m.dims.put(a.replaceAll("\\s*\\(.*\\)", ""), Arrays.stream(b.split("·")).map(v -> v.replaceAll("\\(.*\\)", "").strip()).toList());
			if (section.startsWith("## Rules") && a.matches("R\\d+")) m.tableIds.add(a);
		}
		return m;
	}

	private Rule rule(String line) {
		String body = line.replaceAll("#.*", "").strip();
		String id = body.substring(0, body.indexOf(':')).strip(), expr = body.substring(body.indexOf(':') + 1).strip();
		if (expr.equals("invariant") || expr.equals("fallback")) return new Rule(id, c -> true, expr);
		Predicate<Map<String, String>> p = c -> true;
		for (String clause : expr.split("&")) p = p.and(clause(id, clause.strip()));
		return new Rule(id, p, "rule");
	}

	private Predicate<Map<String, String>> clause(String id, String cl) {
		boolean in = cl.contains(" in "), neg = !in && cl.contains("!=");
		String[] kv = in ? cl.split(" in ", 2) : cl.split(neg ? "!=" : "=", 2);
		String dim = kv[0].strip();
		List<String> vs = Arrays.stream(kv[1].split(",")).map(String::strip).toList();
		List<String> known = dims.get(dim);
		if (known == null || !known.containsAll(vs))
			throw new IllegalArgumentException(id + ": unknown dimension/value in '" + cl + "' (dimensions: " + dims + ")");
		return c -> vs.contains(c.get(dim)) != neg;
	}

	String firstMatch(Map<String, String> cell) {
		for (Rule r : rules) if (r.kind().equals("rule") && r.when().test(cell)) return r.id();
		return null;
	}

	/** Visits every cell. The map is reused: copy it to keep it. */
	void expand(Consumer<Map<String, String>> sink) { expand(new ArrayList<>(dims.keySet()), 0, new HashMap<>(), sink); }

	private void expand(List<String> names, int i, Map<String, String> cell, Consumer<Map<String, String>> sink) {
		if (i == names.size()) { sink.accept(cell); return; }
		for (String v : dims.get(names.get(i))) { cell.put(names.get(i), v); expand(names, i + 1, cell, sink); }
	}
}
```

- [ ] **Step 4: Verify and commit**

Run: `./gradlew :core:test --tests 'dev.smartpets.spec.matrix.*' && head -40 core/build/reports/behavior/matrix-cue-handling.md`
Expected: PASS. The report shows `Cells: 707616` and a nonzero unspecified count. One of the top groups should be `name_then_command | … | calm | SIT`: the table has no rule for the ordinary case "name, then a known command, to a willing dog". That is a real finding. Copy the totals into `MODLOG.md` and raise the finding with the Architect.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "test(s10): add decision-table expander and unspecified-cell report"
```

---

### Task 5: Property suite (in-house runner) that finds a seeded bug

Tier: MEDIUM. Branch: `feat/s10-props`. Depends on Task 3 (`UnspecifiedCollector`).

**Files:** Create `core/src/test/java/dev/smartpets/spec/props/{Props,Scripts,BehaviorPropertiesTest}.java`.

**Interfaces:** `Props.check(long seed, int tries, int maxLen, Function<List<String>, String> property) : Optional<Props.Failure>`. The property returns `null` when it holds, else a message. Failures are shrunk by deleting one op at a time. Settings: `-Dsmartpets.prop.seed` (default 20261018) and `-Dsmartpets.prop.tries` (default 500).

- [ ] **Step 1: Failing test**

`BehaviorPropertiesTest.java`:
```java
package dev.smartpets.spec.props;

import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.smartpets.core.EventJournal.Entry;
import dev.smartpets.core.sim.SimConfig;
import dev.smartpets.spec.UnspecifiedCollector;
import java.util.*;
import org.junit.jupiter.api.Test;

class BehaviorPropertiesTest {
	static final long SEED = Long.getLong("smartpets.prop.seed", 20261018L);
	static final int TRIES = Integer.getInteger("smartpets.prop.tries", 500);

	/** BEHAVIOR-SPECS invariants: never attacks player/ally, attention well-formed, deterministic per seed, no exceptions. */
	static String invariants(SimConfig cfg, List<String> ops) {
		List<Entry> j = Scripts.run(cfg, ops);
		Set<String> attentive = new HashSet<>();
		for (Entry e : j) {
			if (e.type().equals("ATTACK_STARTED") && Set.of("player", "Rex", "Fido").contains(e.data().get("target"))) return "attacked " + e.data();
			if (e.type().equals("ATTENTION_GAINED")) attentive.add(e.data().get("pet"));
			if (e.type().equals("ATTENTION_EXPIRED") && !attentive.remove(e.data().get("pet"))) return "expired without gain " + e.data();
		}
		if (!j.equals(Scripts.run(cfg, ops))) return "journal differs between two runs of the same script";
		UnspecifiedCollector.collect("property seed " + SEED, j);
		return null;
	}

	@Test
	void invariantsHoldForRandomCueSequences() {
		Optional<Props.Failure> f = Props.check(SEED, TRIES, 30, ops -> invariants(SimConfig.defaults(), ops));
		assertTrue(f.isEmpty(), () -> "counterexample: " + f.get());
	}

	@Test
	void findsTheSeededDeliberateBug() {
		SimConfig buggy = SimConfig.defaults().withFaults("ignore_protected_targets");
		Optional<Props.Failure> f = Props.check(SEED, TRIES, 30, ops -> invariants(buggy, ops));
		assertTrue(f.isPresent(), "property suite missed the injected bug");
		System.out.println("SEEDED_BUG_FOUND " + f.get());
		assertTrue(f.get().script().size() <= 4 && f.get().script().contains("say blitz"), "not shrunk: " + f.get());
	}
}
```
Run: `./gradlew :core:test --tests 'dev.smartpets.spec.props.*'`. Expected: FAIL (compile error: `Props`, `Scripts` not found).

- [ ] **Step 2: Implement**

`Scripts.java`:
```java
package dev.smartpets.spec.props;

import dev.smartpets.core.EventJournal.Entry;
import dev.smartpets.core.sim.*;
import java.util.*;

final class Scripts {
	static final List<String> PREAMBLE = List.of("reset 42", "dog Rex", "namecue Rex felicia", "cue Rex potato SIT 1",
		"cue Rex blitz ATTACK 1", "dog Fido", "namecue Fido biscuit", "mob zombie 8", "mob iron_golem 6", "mob cow 5");
	private static final String[][] OPS = {
		{"say felicia", "say biscuit", "say potato", "say blitz", "say zebra"},
		{"look player", "look Rex", "look Fido", "look zombie", "look iron_golem", "look cow", "look nothing"},
		{"state Rex calm", "state Rex scared", "state Rex asleep", "state Rex dozing", "state Rex downed", "state Rex sitting"},
		{"will Rex 0", "will Rex 1", "will Rex 0.5", "bond Rex 10", "bond Rex 90"},
		{"wait 0.5", "wait 4", "distance Rex 3", "distance Rex out"}};

	private Scripts() {}

	static List<String> random(SplittableRandom r, int n) {
		List<String> s = new ArrayList<>();
		for (int i = 0; i < n; i++) { String[] g = OPS[r.nextInt(OPS.length)]; s.add(g[r.nextInt(g.length)]); }
		return s;
	}

	static List<Entry> run(SimConfig cfg, List<String> ops) {
		SimScript s = new SimScript(cfg);
		PREAMBLE.forEach(s::exec);
		ops.forEach(s::exec);
		return s.world().journal().snapshot();
	}
}
```
`Props.java`:
```java
package dev.smartpets.spec.props;

import java.util.*;
import java.util.function.Function;

/** Minimal seeded property runner with shrinking (S10 fallback for jqwik; see plan Global Constraints). */
final class Props {
	record Failure(long caseSeed, List<String> script, String message) {}

	private Props() {}

	static Optional<Failure> check(long seed, int tries, int maxLen, Function<List<String>, String> property) {
		SplittableRandom r = new SplittableRandom(seed);
		for (int i = 0; i < tries; i++) {
			long caseSeed = r.nextLong();
			SplittableRandom cr = new SplittableRandom(caseSeed);
			List<String> script = Scripts.random(cr, 1 + cr.nextInt(maxLen));
			String msg = safe(property, script);
			if (msg != null) return Optional.of(shrink(caseSeed, script, property, msg));
		}
		return Optional.empty();
	}

	private static String safe(Function<List<String>, String> p, List<String> s) {
		try { return p.apply(s); } catch (RuntimeException e) { return "threw " + e; }
	}

	private static Failure shrink(long caseSeed, List<String> s, Function<List<String>, String> p, String msg) {
		for (boolean progress = true; progress; ) {
			progress = false;
			for (int i = 0; i < s.size() && !progress; i++) {
				List<String> c = new ArrayList<>(s);
				c.remove(i);
				String m = safe(p, c);
				if (m != null) { s = c; msg = m; progress = true; }
			}
		}
		return new Failure(caseSeed, List.copyOf(s), msg);
	}
}
```

- [ ] **Step 3: Verify, show the bug is found, commit**

Run: `./gradlew :core:test --tests 'dev.smartpets.spec.props.*' -i | grep SEEDED_BUG_FOUND`
Expected: PASS, and a line like `SEEDED_BUG_FOUND Failure[caseSeed=…, script=[look player, say felicia, say blitz], message=attacked {pet=Rex, target=player}]`. The exact ops may differ; there are at most 4. Then run `./gradlew :core:test -Dsmartpets.prop.tries=5000` once and expect PASS. Log both runs in `MODLOG.md`.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "test(s10): add seeded property suite that catches an injected safety bug"
```

---

### Task 6: One `@platform` scenario in the real game

Tier: STRONG (Cucumber under the Fabric/Knot classloader is the main risk). Branch: `feat/s10-platform`. Depends on Task 3.

**Files:** Modify `mod/build.gradle`, `DevCommands.java`, `SmartPetsClientGameTest.java`, `scripts/qa/run-client-gametest.sh`. Create `mod/src/gametest/java/dev/smartpets/gametest/{GamePetWorld,PlatformScenarios}.java`.

**Interfaces:**
- Dev-only commands. `/smartpets debug sim <SimScript line>` replies `ok <line>` and logs `SMARTPETS_SIM`. `/smartpets debug bind <Name> <entity> <player>` sends `distance <Name> <Entity#distanceTo(player)>`. `ServerTickEvents.END_SERVER_TICK` ticks the simulation.
- Checked with javap against the 26.2 / Fabric API 0.161.0 jars (2026-10-18):
  - `Commands.argument(String, ArgumentType<T>)`.
  - `EntityArgument.entity()/player()/getEntity/getPlayer`, which throw `CommandSyntaxException`.
  - `Entity#distanceTo(Entity) : float`.
  - `StringArgumentType.greedyString()/word()/getString` (brigadier 1.3.10).
  - `ServerTickEvents.END_SERVER_TICK` (`EndTick#onEndTick(MinecraftServer)`).
- Checked in the Cucumber 8.0.4 sources: `io.cucumber.core.cli.Main.run(String[], ClassLoader) : byte` and the `--glue-class` option.
- The runner also requires the log line `SMARTPETS_PLATFORM_SCENARIO_PASSED` (exit 6).

- [ ] **Step 1: Failing in-game test**

`GamePetWorld.java`:
```java
package dev.smartpets.gametest;

import dev.smartpets.DevCommands;
import dev.smartpets.core.EventJournal;
import dev.smartpets.spec.PetWorld;
import java.util.List;
import java.util.Locale;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;

/** Platform driver: every step goes through the server command handler; distance is measured on a real wolf. */
@SuppressWarnings("UnstableApiUsage")
final class GamePetWorld implements PetWorld {
	private final TestSingleplayerContext sp;
	private final ClientGameTestContext ctx;

	GamePetWorld(TestSingleplayerContext sp, ClientGameTestContext ctx) { this.sp = sp; this.ctx = ctx; run("kill @e[type=minecraft:wolf]"); }

	private void run(String command) { sp.getServer().runCommand(command); ctx.waitTick(); }
	private static String tag(String dog) { return "smartpets_" + dog.toLowerCase(Locale.ROOT); }
	private void bind(String dog) { run("smartpets debug bind " + dog + " @e[tag=" + tag(dog) + ",limit=1] @p"); }

	@Override public void send(String line) { run("smartpets debug sim " + line); }
	@Override public void addDog(String dog) {
		run("execute as @p at @s run summon minecraft:wolf ~3 ~ ~ {NoAI:1b,Tags:[\"" + tag(dog) + "\"]}");
		send("dog " + dog);
		bind(dog);
	}
	@Override public void placeDog(String dog, double blocks) { run("execute as @p at @s run tp @e[tag=" + tag(dog) + ",limit=1] ~" + blocks + " ~ ~"); bind(dog); }
	@Override public void advanceSeconds(double s) { ctx.waitTicks((int) Math.round(s * 20)); }
	@Override public List<EventJournal.Entry> journal() { return DevCommands.SIM.world().journal().snapshot(); }
}
```
`PlatformScenarios.java`:
```java
package dev.smartpets.gametest;

import dev.smartpets.DevCommands;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.spec.PetWorlds;
import dev.smartpets.spec.steps.PetSteps;
import io.cucumber.core.cli.Main;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;

/** Runs the same .feature text as core, with the platform driver. One scenario in S10. */
@SuppressWarnings("UnstableApiUsage")
final class PlatformScenarios {
	private PlatformScenarios() {}

	static void run(TestSingleplayerContext sp, ClientGameTestContext ctx) {
		PetWorlds.use(() -> new GamePetWorld(sp, ctx));
		PetSteps.PASSED.set(0);
		String dir = System.getProperty("smartpets.specs.behaviors");
		byte status = Main.run(new String[] {"--glue-class", PetSteps.class.getName(), "--name", "^Calling the name with no command$",
			"--tags", "@platform and not @pending", "--plugin", "pretty", "--monochrome", dir + "/01-name-and-attention.feature"},
			PlatformScenarios.class.getClassLoader());
		var journal = DevCommands.SIM.world().journal().snapshot();
		boolean measured = journal.stream().anyMatch(e -> e.type().equals("PET_PLACED") && Math.abs(Double.parseDouble(e.data().get("distance")) - 6) < 1.5);
		if (status != 0 || PetSteps.PASSED.get() != 1 || !measured)
			throw new AssertionError("platform scenario: status=" + status + " passed=" + PetSteps.PASSED.get() + " measured=" + measured + "\n" + PetSteps.dump(journal));
		SmartPetsMod.LOGGER.info("SMARTPETS_PLATFORM_SCENARIO_PASSED");
	}
}
```
Wire it up:
- In `SmartPetsClientGameTest.runTest`, add `PlatformScenarios.run(singleplayer, context);` after `context.waitTicks(5);`, before the screenshot.
- In `mod/build.gradle`, add `gametestImplementation testFixtures(project(':core'))` to `dependencies`.
- In the existing `if (name == "clientGameTest")` block, add `property "smartpets.specs.behaviors", rootProject.file("specs/behaviors").absolutePath`.
- Append to `scripts/qa/run-client-gametest.sh`:
```bash
grep -q "SMARTPETS_PLATFORM_SCENARIO_PASSED" mod/build/run/clientGameTest/logs/latest.log || { echo "platform scenario not passed" >&2; exit 6; }
```
Run: `./gradlew :mod:compileGametestJava`. Expected: FAIL (`DevCommands.SIM` not found). If `DevCommands` itself does not resolve, the gametest source set does not see `main`. In that case add `gametestImplementation sourceSets.main.output` and record it in `MODLOG.md`.

- [ ] **Step 2: Dev command route into the core simulation**

Replace `DevCommands.java`:
```java
package dev.smartpets;

import com.mojang.brigadier.arguments.StringArgumentType;
import dev.smartpets.core.EventJournal;
import dev.smartpets.core.sim.SimConfig;
import dev.smartpets.core.sim.SimScript;
import java.util.Map;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.Entity;

public final class DevCommands {
	public static final EventJournal JOURNAL = new EventJournal(2000);
	/** S10: dev-only server-side route into the core simulation (same text protocol as the core driver). */
	public static final SimScript SIM = new SimScript(SimConfig.defaults());

	private DevCommands() {
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		ServerTickEvents.END_SERVER_TICK.register(server -> SIM.world().tick());
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets")
				.then(Commands.literal("debug")
					.then(Commands.literal("ping").executes(ctx -> {
						JOURNAL.record(0, "DEBUG_PING", Map.of());
						SmartPetsMod.LOGGER.info("SMARTPETS_DEBUG_PONG");
						ctx.getSource().sendSuccess(() -> Component.literal("SMARTPETS_DEBUG_PONG"), false);
						return 1;
					}))
					.then(Commands.literal("sim").then(Commands.argument("line", StringArgumentType.greedyString())
						.executes(ctx -> reply(ctx.getSource(), SIM.exec(StringArgumentType.getString(ctx, "line"))))))
					.then(Commands.literal("bind").then(Commands.argument("name", StringArgumentType.word())
						.then(Commands.argument("pet", EntityArgument.entity()).then(Commands.argument("player", EntityArgument.player())
							.executes(ctx -> {
								Entity pet = EntityArgument.getEntity(ctx, "pet");
								double d = pet.distanceTo(EntityArgument.getPlayer(ctx, "player"));
								return reply(ctx.getSource(), SIM.exec("distance " + StringArgumentType.getString(ctx, "name") + " " + d));
							}))))))));
	}

	private static int reply(CommandSourceStack source, String text) {
		SmartPetsMod.LOGGER.info("SMARTPETS_SIM {}", text);
		source.sendSuccess(() -> Component.literal(text), false);
		return 1;
	}
}
```
Run: `./gradlew build`. Expected: BUILD SUCCESSFUL (core tests plus `compileGametestJava`).

- [ ] **Step 3: Run in the game**

Run: `bash scripts/qa/run-client-gametest.sh; echo "exit=$?"`, then `grep -E 'SMARTPETS_SIM|Scenarios|PLATFORM' mod/build/run/clientGameTest/logs/latest.log`
Expected: `exit=0`. The log has the Cucumber pretty output (`1 Scenarios (1 passed)`), `SMARTPETS_SIM ok distance Rex 6.0…` and `SMARTPETS_PLATFORM_SCENARIO_PASSED`. The screenshot shows the wolf.

If it fails:
- (a) `No backends were found` under Knot: pass `Thread.currentThread().getContextClassLoader()` instead, and record which one worked.
- (b) The SNBT or a selector is rejected: read the server log line and fix the command text.
- (c) The Cucumber route still fails after one cycle: switch to the spike fallback "GameTest-only". In `PlatformScenarios`, call the same `PetSteps` methods in the scenario's order: `world(42)`, `player()`, `adultDog("Rex")`, `knowsName("Rex","felicia")`, `bond("Rex",50)`, `setState("Rex","calm")`, `place("Rex",6)`, `callName("Rex")`, `shows("Rex","look_at_player")`, `noCommand("Rex")`, `contains("ATTENTION_GAINED")`. Mark S10 PASS-WITH-FALLBACK.

Same scenario on the core driver: `./gradlew :core:test --tests 'dev.smartpets.spec.BehaviorSuiteTest'`, then check that `core/build/test-results/test/` shows `Calling the name with no command` as passed.

- [ ] **Step 4: Leak check, log, commit**

Record in `MODLOG.md`: run time, the in-game distance measured, the classloader findings.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "feat(s10): run one @platform scenario in the game through the dev command handler"
```

---

### Task 7: Close S10 (ADR, specs, status)

Tier: Architect (STRONG). Branch: `docs/s10-close`. Depends on Tasks 1–6.

**Files:** Create `docs/adr/0005-behavior-spec-framework.md`. Modify `docs/spec/V0-SPIKES.md`, `docs/spec/BEHAVIOR-SPECS.md`, `CLAUDE.md` §1, `MODLOG.md`, `site/data/status.json`, `README.md` (roadmap).

- [ ] **Step 1: ADR-0005.** Record:
  - Cucumber 8.0.4 through the Suite engine, with root-engine discovery switched off.
  - Why jqwik was rejected, with the evidence (Platform 1.14.4 dependency, the 1.10.1 note, maintenance mode, the maintainers' position on agents), and the in-house runner that replaces it.
  - `@pending` semantics.
  - The text protocol shared by both drivers.
  - Full matrix expansion instead of pairwise (707,616 cells).
  - The platform route used: Cucumber in the game JVM, or the fallback.
  - Whether `dev.smartpets.core.sim` graduates. Proposal: no; S8 builds the real command path.
  - Limits: in-game distance is measured only at bind time; R22 is checked only by scenarios.
- [ ] **Step 2: `BEHAVIOR-SPECS.md` Tooling.** Replace the unverified versions with the verified ones. Add `@pending` to Tags. Point to the three reports in `core/build/reports/behavior/`.
- [ ] **Step 3: `V0-SPIKES.md` S10.** Set status PASS or PASS-WITH-FALLBACK, with links. Evidence per PASS clause: suite counts, matrix totals, the `SEEDED_BUG_FOUND` line, the in-game log line.
- [ ] **Step 4: `CLAUDE.md` §1.** Add only the commands actually run, for example `./gradlew :core:test -PsimFaults=ignore_protected_targets` (the red check). Note the report directory, and that `run-client-gametest.sh` now also requires `SMARTPETS_PLATFORM_SCENARIO_PASSED`.
- [ ] **Step 5: Status and triage.**
  - Update `site/data/status.json` (S10 state and `updated`) and the README roadmap, then run `bash scripts/qa/docs-freshness.sh`.
  - Give the human `unspecified-rows.md` and the matrix top groups as triage input. Do not edit `specs/UNSPECIFIED.md` without a decision.
- [ ] **Step 6: Commit**
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "docs: close V0-S10 with ADR-0005 and verified behavior-spec tooling"
```

---

## Out of scope for S10 (explicit)

- The behavior of the 50 pending scenarios: energy, sleep, training, health, persistence, age.
- The real S8 command pipeline, and voice.
- Pet AI or movement in the game (the wolf is a NoAI body).
- Per-PR coverage metrics beyond the three reports ("journal events never asserted" is deferred).
- jqwik, and pairwise generation.

## Self-Review Notes

- Spike coverage:
  - Cucumber + JUnit Platform: T1, T3.
  - jqwik: replaced by the in-house runner, with evidence (Global Constraints, T5).
  - `PetWorld` + core driver (tick loop, two dogs, mobs, journal as oracle): T2, T3.
  - Journal assertions: T3.
  - Matrix expander/reporter: T4.
  - `UNSPECIFIED_SITUATION` capture to rows: T3, fed by T5.
  - Seeded bug: T5.
  - One `@platform` scenario in core and in the game, through the server command handler: T6.
- Not verified until run (each has a fallback or a logging step):
  - Cucumber package scanning inside the testFixtures jar (fallback: `cucumber.glue.classes`, which exists since 8.0.0).
  - `gametestImplementation testFixtures(...)` on the Loom run classpath.
  - Cucumber's `ServiceLoader` under Knot.
  - Whether `runCommand` blocks until the command has run (each call is followed by `waitTick`).
  - SNBT `{NoAI:1b,Tags:[…]}` on 26.2.
- Findings for the human, visible from the table text alone:
  - R6 (`name_only`) comes before R7 (`name_unknown`). A dog that never learned its name therefore "gains attention" according to the table, while the decided scenario says `head_tilt`.
  - No rule covers "name, then a known command, calm, willing", which is the main happy path.
