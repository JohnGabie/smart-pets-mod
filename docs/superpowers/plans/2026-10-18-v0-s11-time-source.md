# V0-S11 Time Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Project roles, tiers and the PR flow in `CLAUDE.md` and `agents/` apply to every task.

**Goal:** Decide, with evidence from the real 26.2 sources and one headless in-game test, which world clock gives the pet "world day", and adopt a monotonic `age_days` function in `core`.

**Architecture:** The `mod` adapter samples the server clock (`WorldTimeSample`: world day, overworld clock ticks, game time) on the server thread; `core` (pure Java) owns every rule: age, elapsed days, anomaly classification. A dev-only command exposes a sample to the journal/log; a client GameTest drives `time`/`gamerule` commands and reads values back with `TestServerContext#computeOnServer`.

**Tech Stack:** Minecraft 26.2, Fabric Loader 0.19.5, Fabric API 0.161.0+26.2 (fabric-client-gametest-api-v1 6.0.2), Loom 1.18-SNAPSHOT, Gradle 9.7.1, JDK 25, JUnit 6.1.3.

**Spec:** `docs/spec/V0-SPIKES.md` (S11), `docs/spec/SPEC.md` §4, `specs/behaviors/06-health-persistence-time.feature` ("Age is the world day minus the birth day and never decreases"), `CLAUDE.md` §6 ("Idade = dia do mundo atual - dia de nascimento. Sem relógio próprio").

## Findings from the decompiled 26.2 sources (static, mcdev-mcp index of 26.2; read 2026-10-18)

Minecraft 26.x replaced `dayTime` with **world clocks**. There is no `getDayTime()`/`setDayTime()` and no `/time query day` in 26.2 (SPEC §4 wording is outdated).
- `net.minecraft.world.clock.ServerClockManager extends SavedData` (`SavedDataType` id `minecraft:world_clocks`), one `ClockInstance` per `WorldClock` registry entry: `totalTicks` (long), `partialTick`, `rate` (default 1.0), `paused`. `tick()` advances every clock only if the global game rule `GameRules.ADVANCE_TIME` (`advance_time`, default true) is on; it is called from `MinecraftServer` only when `tickRateManager.runsNormally()`.
- Mutators: `setTotalTicks(clock, long)` (absolute), `addTicks(clock, int)` (clamped at 0), `moveToTimeMarker(clock, marker)` (forward only: `ClockTimeMarker#resolveTimeToMoveTo` adds `durationToNext`, never negative), `setPaused`, `setRate`. Read: `getTotalTicks(Holder<WorldClock>)`.
- `WorldClocks.OVERWORLD` (`minecraft:overworld`) and `WorldClocks.THE_END`. `DimensionTypes`: overworld default clock = OVERWORLD, end = THE_END, **nether has no default clock**. `Level#getDefaultClockTime()` returns 0 when the dimension has none; `Level#getOverworldClockTime()` always reads the overworld clock.
- `Timelines.OVERWORLD_DAY` (`minecraft:day`): overworld clock, `period_ticks` 24000, markers `day` 1000, `noon` 6000, `night` 13000, `midnight` 18000, `wake_up_from_sleep` 0. `Timeline#getPeriodCount(ClockManager)` = `(int)(totalTicks / periodTicks)`. The F3 line `Day #N` (`DebugEntryDayCount`) is exactly `registryAccess().get(Timelines.OVERWORLD_DAY)...getPeriodCount(clockManager)`. Timelines are data-driven (a datapack may change the period).
- Sleep: `ServerLevel#tick` → when enough players sleep and `ADVANCE_TIME` is on, `clockManager().moveToTimeMarker(defaultClock, WAKE_UP_FROM_SLEEP)` → next multiple of 24000 → day count +1. Game time is not touched by sleep.
- `TimeCommand`: `time set <time>` (absolute, `TimeArgument`: units `d`=24000, `s`=20, `t`=1; int range), `time set <marker>` (forward only), `time add <time>` (negative allowed), `time pause|resume|rate <r>`, `time query time|gametime|<timeline> [repetition]`, `time of <clock> ...`. In a dimension without a default clock the default-clock forms fail (`commands.time.no_default_clock`).
- Game time: `ServerLevel#tickTime` → `serverLevelData.setGameTime(getGameTime()+1)`; the only server writer of `setGameTime` (grep). Stopped only by `/tick freeze` (`runsNormally`). Not changed by `/time`, sleep, or `advance_time`.
- `GameRuleCommand` registers each rule by unqualified id and by identifier: `/gamerule advance_time false` is valid.
- Accessors used below (all seen in source): `MinecraftServer#clockManager() : ServerClockManager`, `#registryAccess() : RegistryAccess.Frozen` (`HolderGetter#get(ResourceKey) : Optional<Holder.Reference<T>>`, `#getOrThrow`), `#overworld()`, `Level#getGameTime()`.
- Client GameTest (javap of fabric-client-gametest-api-v1 6.0.2): `TestServerContext#runCommand(String)`, `#runOnServer(FailableConsumer<MinecraftServer,E>)`, `#computeOnServer(FailableFunction<MinecraftServer,T,E>)`, `#waitFor(Predicate<MinecraftServer>)`.
Not verified by running: everything above is source reading; Task 2 is the in-game proof.

## Decision proposed by this plan (ADR in Task 3)
- **World day** = period count of the `minecraft:day` timeline on the overworld clock (= F3 "Day #"), read through `Timeline#getPeriodCount`, never a hardcoded 24000 and never the current dimension's default clock. Fallback when the timeline is missing (datapack removed it): `floorDiv(overworld clock ticks, 24000)` plus a `TIME_SOURCE_FALLBACK` journal entry.
- **Age**: SPEC §4 rule `age_days = max(previous_age_days, max(0, current_day − birth_day))`. Monotonic; a backwards jump freezes age until the world day catches up.
- **Elapsed days** between two samples: `max(0, current − previous)`; backwards = `CLOCK_BACKWARDS` (0 elapsed); `>= forwardJumpDays` [T, config] = `CLOCK_FORWARD_JUMP` (still counted; caps are S4's job).
- Rejected: game time / 24000 (monotonic, but sleeping would not age pets and it diverges from F3 "Day N", which SPEC §4 names) and a mod-owned accumulator of positive deltas (keeps aging after `/time set` backwards, but it is an own clock, forbidden by `CLAUDE.md` §6). Both are listed in the ADR as open alternatives for the human.

## Global Constraints

- Target Minecraft 26.2 only (ADR-0001). Every API name above was read in the 26.2 sources; anything that fails to compile is looked up again (mcdev-mcp static tools or javap), never guessed. Record corrections in `MODLOG.md`.
- `core` never imports `net.minecraft` / `net.fabricmc` (`CoreBoundaryTest` already enforces it for every file under `core/src/main/java`).
- Tuning numbers (`forwardJumpDays`) are parameters, not constants in logic. Vanilla constants (24000 fallback) are named and commented.
- Dev command only when `-Dsmartpets.dev=true` (`DevMode.enabled()`); it lives in its own class so S4 and S11 never edit the same file.
- Never run the game while another instance is open; never run the game from this plan except through `bash scripts/qa/run-client-gametest.sh`; never use DebugBridge/runtime MCP tools for this spike (static tools only).
- Repo is public: no paths, names, e-mails, tokens; `bash scripts/qa/leak-check.sh` before every commit.
- One task = one branch = one PR; Conventional Commits; commit trailer `Co-Authored-By: <model that did the work> <noreply@anthropic.com>` as in S0; human merges. License GPL-3.0-or-later (no header change needed).
- Java style: tabs, `final` utility classes with private constructors, records for values (match `EventJournal`, `DevCommands`).

## Review Focus

- Reading the **current dimension's** default clock (nether → 0) instead of the overworld clock. Test: adapter code uses `WorldClocks.OVERWORLD` / `Timelines.OVERWORLD_DAY` only (Task 2 review).
- Hardcoded 24000 in the happy path. Test: grep `24000` in `mod/src/main` shows only the documented fallback.
- Age decreasing after `/time set` backwards. Test: `AgeClockTest.backwardsClockNeverLowersAge` and the GameTest backwards step.
- Elapsed days negative on backwards jump (would "un-age" needs in S4). Test: `stepBackwardsIsZeroElapsed`.
- GameTest that "passes" without running. Test: runner requires the `SMARTPETS_S11_OK` log marker.
- Dev command reachable without the flag. Test: class returns early when `!DevMode.enabled()` (same pattern as S0).

## File Structure

```
core/src/main/java/dev/smartpets/core/time/{WorldTimeSample.java, TimeAnomaly.java, DayStep.java, AgeClock.java}
core/src/test/java/dev/smartpets/core/time/AgeClockTest.java
mod/src/main/java/dev/smartpets/time/{WorldTimeSource.java, TimeDevCommands.java}
mod/src/main/java/dev/smartpets/SmartPetsMod.java                       (one line)
mod/src/gametest/java/dev/smartpets/gametest/TimeSourceClientGameTest.java
mod/src/gametest/resources/fabric.mod.json                                (entrypoint list)
scripts/qa/run-client-gametest.sh                                         (marker check)
docs/adr/0003-time-source.md, docs/spec/{SPEC.md, V0-SPIKES.md}, site/data/status.json, README.md, MODLOG.md
```

---

### Task 1: Pure time rules in `core`

Tier: RÁPIDO (fully specified). Branch: `feat/s11-core-time`. Depends on S0 (merged).

**Files:**
- Create: `core/src/main/java/dev/smartpets/core/time/{WorldTimeSample,TimeAnomaly,DayStep,AgeClock}.java`
- Create: `core/src/test/java/dev/smartpets/core/time/AgeClockTest.java`

**Interfaces:**
- Produces (S4 consumes these):
  - `record WorldTimeSample(long worldDay, long dayClockTicks, long gameTime)` (all `>= 0`).
  - `enum TimeAnomaly { NONE, BACKWARDS, FORWARD_JUMP }` with `String journalType()` (`null`, `CLOCK_BACKWARDS`, `CLOCK_FORWARD_JUMP`).
  - `record DayStep(long previousDay, long currentDay, long elapsedDays, TimeAnomaly anomaly)`.
  - `AgeClock.ageDays(long previousAgeDays, long birthDay, long currentDay) : long`; `AgeClock.step(long previousDay, long currentDay, long forwardJumpDays) : DayStep`.

- [ ] **Step 1: Write the failing tests**

`core/src/test/java/dev/smartpets/core/time/AgeClockTest.java`:
```java
package dev.smartpets.core.time;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AgeClockTest {
	@Test
	void ageIsWorldDayMinusBirthDay() {
		assertEquals(30, AgeClock.ageDays(0, 10, 40));
	}

	@Test
	void backwardsClockNeverLowersAge() {
		long age = AgeClock.ageDays(0, 10, 40);
		assertEquals(30, AgeClock.ageDays(age, 10, 20));
	}

	@Test
	void ageCatchesUpAfterTheWorldPassesTheOldMaximum() {
		assertEquals(30, AgeClock.ageDays(30, 10, 25));
		assertEquals(35, AgeClock.ageDays(30, 10, 45));
	}

	@Test
	void ageIsNeverNegativeWhenBornAfterTheCurrentDay() {
		assertEquals(0, AgeClock.ageDays(0, 50, 20));
	}

	@Test
	void ageIsMonotonicOverAnArbitraryDaySequence() {
		long[] days = {0, 5, 5, 3, 100, 2, 0, 101, 99_999, 1};
		long age = 0;
		for (long d : days) {
			long next = AgeClock.ageDays(age, 0, d);
			assertTrue(next >= age, "age decreased at day " + d);
			age = next;
		}
		assertEquals(99_999, age);
	}

	@Test
	void stepForwardCountsElapsedDays() {
		DayStep s = AgeClock.step(10, 13, 30);
		assertEquals(3, s.elapsedDays());
		assertEquals(TimeAnomaly.NONE, s.anomaly());
		assertNull(s.anomaly().journalType());
	}

	@Test
	void stepBackwardsIsZeroElapsed() {
		DayStep s = AgeClock.step(40, 20, 30);
		assertEquals(0, s.elapsedDays());
		assertEquals(TimeAnomaly.BACKWARDS, s.anomaly());
		assertEquals("CLOCK_BACKWARDS", s.anomaly().journalType());
	}

	@Test
	void bigForwardStepIsFlaggedButStillCounted() {
		DayStep s = AgeClock.step(0, 100, 30);
		assertEquals(100, s.elapsedDays());
		assertEquals(TimeAnomaly.FORWARD_JUMP, s.anomaly());
		assertEquals("CLOCK_FORWARD_JUMP", s.anomaly().journalType());
	}

	@Test
	void sameDayIsNoStep() {
		assertEquals(new DayStep(7, 7, 0, TimeAnomaly.NONE), AgeClock.step(7, 7, 30));
	}

	@Test
	void rejectsInvalidInput() {
		assertThrows(IllegalArgumentException.class, () -> AgeClock.ageDays(-1, 0, 0));
		assertThrows(IllegalArgumentException.class, () -> AgeClock.step(0, 1, 0));
		assertThrows(IllegalArgumentException.class, () -> new WorldTimeSample(-1, 0, 0));
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :core:test`
Expected: FAIL (compile errors: `AgeClock`, `DayStep`, `TimeAnomaly`, `WorldTimeSample` not found).

- [ ] **Step 3: Implement**

`core/src/main/java/dev/smartpets/core/time/WorldTimeSample.java`:
```java
package dev.smartpets.core.time;

/** One reading of the world clock taken by the platform adapter on the server thread. */
public record WorldTimeSample(long worldDay, long dayClockTicks, long gameTime) {
	public WorldTimeSample {
		if (worldDay < 0 || dayClockTicks < 0 || gameTime < 0) {
			throw new IllegalArgumentException("negative time: day=" + worldDay + " clock=" + dayClockTicks + " game=" + gameTime);
		}
	}
}
```
`core/src/main/java/dev/smartpets/core/time/TimeAnomaly.java`:
```java
package dev.smartpets.core.time;

public enum TimeAnomaly {
	NONE(null),
	BACKWARDS("CLOCK_BACKWARDS"),
	FORWARD_JUMP("CLOCK_FORWARD_JUMP");

	private final String journalType;

	TimeAnomaly(String journalType) {
		this.journalType = journalType;
	}

	/** Event-journal type to record, or null when nothing unusual happened. */
	public String journalType() {
		return journalType;
	}
}
```
`core/src/main/java/dev/smartpets/core/time/DayStep.java`:
```java
package dev.smartpets.core.time;

public record DayStep(long previousDay, long currentDay, long elapsedDays, TimeAnomaly anomaly) {
}
```
`core/src/main/java/dev/smartpets/core/time/AgeClock.java`:
```java
package dev.smartpets.core.time;

/** Pure world-day rules (SPEC §4). The world day itself comes from the platform adapter. */
public final class AgeClock {
	private AgeClock() {
	}

	/** age_days = max(previous_age_days, max(0, current_day - birth_day)): never decreases. */
	public static long ageDays(long previousAgeDays, long birthDay, long currentDay) {
		if (previousAgeDays < 0) {
			throw new IllegalArgumentException("previousAgeDays < 0: " + previousAgeDays);
		}
		return Math.max(previousAgeDays, Math.max(0L, currentDay - birthDay));
	}

	/** Elapsed days between two observations. Backwards counts as 0; a large jump is flagged, not dropped. */
	public static DayStep step(long previousDay, long currentDay, long forwardJumpDays) {
		if (forwardJumpDays < 1) {
			throw new IllegalArgumentException("forwardJumpDays < 1: " + forwardJumpDays);
		}
		long delta = currentDay - previousDay;
		if (delta < 0) {
			return new DayStep(previousDay, currentDay, 0, TimeAnomaly.BACKWARDS);
		}
		return new DayStep(previousDay, currentDay, delta, delta >= forwardJumpDays ? TimeAnomaly.FORWARD_JUMP : TimeAnomaly.NONE);
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :core:test`
Expected: PASS (5 existing + 10 new = 15 tests; `CoreBoundaryTest` still green).

- [ ] **Step 5: Leak check, commit**

```bash
bash scripts/qa/leak-check.sh
git add core/src && git commit -m "feat(core): add world-day age and elapsed-day rules for S11"
```

---

### Task 2: Mod adapter, dev command, in-game verification

Tier: MÉDIO. Branch: `feat/s11-adapter` (from `feat/s11-core-time` until it merges). Depends on Task 1.

**Files:**
- Create: `mod/src/main/java/dev/smartpets/time/WorldTimeSource.java`, `mod/src/main/java/dev/smartpets/time/TimeDevCommands.java`
- Create: `mod/src/gametest/java/dev/smartpets/gametest/TimeSourceClientGameTest.java`
- Modify: `mod/src/main/java/dev/smartpets/SmartPetsMod.java`, `mod/src/gametest/resources/fabric.mod.json`, `scripts/qa/run-client-gametest.sh`

**Interfaces:**
- Consumes: `WorldTimeSample`, `AgeClock` (Task 1); `DevMode`, `DevCommands.JOURNAL` (S0).
- Produces: `WorldTimeSource.sample(MinecraftServer) : WorldTimeSample` (S4 uses it); command `/smartpets debug time` logging `SMARTPETS_TIME day=<d> clock=<ticks> game=<ticks>` and journaling `TIME_SAMPLE` (+ the anomaly type vs the previous sample); log marker `SMARTPETS_S11_OK` from the GameTest.

- [ ] **Step 1: Write the failing GameTest (behavior table cases 1–7, see Task 3)**

`mod/src/gametest/java/dev/smartpets/gametest/TimeSourceClientGameTest.java`:
```java
package dev.smartpets.gametest;

import dev.smartpets.core.time.AgeClock;
import dev.smartpets.core.time.TimeAnomaly;
import dev.smartpets.core.time.WorldTimeSample;
import dev.smartpets.time.WorldTimeSource;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestServerContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.world.clock.ClockTimeMarkers;
import net.minecraft.world.clock.WorldClocks;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SuppressWarnings("UnstableApiUsage")
public class TimeSourceClientGameTest implements FabricClientGameTest {
	private static final Logger LOG = LoggerFactory.getLogger("smartpets-test");

	@Override
	public void runTest(ClientGameTestContext context) {
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			TestServerContext server = sp.getServer();
			server.runCommand("gamerule advance_time false");
			server.runCommand("time set 10d");
			expectDay(server, 10, "1 time set 10d");
			server.runCommand("time add 1d");
			expectDay(server, 11, "2 time add 1d");
			// 3: what a successful bed sleep calls (ServerLevel#tick, source-read); real bed sleep is a human playtest.
			server.runOnServer(s -> s.clockManager().moveToTimeMarker(
				s.registryAccess().getOrThrow(WorldClocks.OVERWORLD), ClockTimeMarkers.WAKE_UP_FROM_SLEEP));
			expectDay(server, 12, "3 wake_up_from_sleep");
			WorldTimeSample frozen = sample(server);
			context.waitTicks(40);
			WorldTimeSample later = sample(server);
			check(later.dayClockTicks() == frozen.dayClockTicks(), "4 advance_time=false froze the clock", frozen, later);
			check(later.gameTime() > frozen.gameTime(), "4 game time still advances", frozen, later);
			server.runCommand("gamerule advance_time true");
			context.waitTicks(40);
			check(sample(server).dayClockTicks() > later.dayClockTicks(), "5 clock runs again", later, sample(server));
			server.runCommand("gamerule advance_time false");
			server.runCommand("time set 1000");
			expectDay(server, 0, "6 time set 1000 goes backwards");
			check(AgeClock.ageDays(12, 0, 0) == 12, "6 age stays 12 after backwards", null, null);
			check(AgeClock.step(12, 0, 30).anomaly() == TimeAnomaly.BACKWARDS, "6 backwards flagged", null, null);
			server.runCommand("time set noon");
			expectDay(server, 0, "7a marker noon stays on day 0");
			server.runCommand("time set day");
			expectDay(server, 1, "7b marker day moves forward to day 1");
			server.runCommand("smartpets debug time");
			context.waitTicks(2);
		}
		LOG.info("SMARTPETS_S11_OK");
	}

	private static WorldTimeSample sample(TestServerContext server) {
		return server.computeOnServer(WorldTimeSource::sample);
	}

	private static void expectDay(TestServerContext server, long day, String step) {
		WorldTimeSample s = sample(server);
		LOG.info("S11 step '{}': {}", step, s);
		check(s.worldDay() == day, step + " expected day " + day, null, s);
	}

	private static void check(boolean ok, String what, WorldTimeSample a, WorldTimeSample b) {
		if (!ok) {
			throw new AssertionError("S11 failed: " + what + " | before=" + a + " after=" + b);
		}
	}
}
```
In `mod/src/gametest/resources/fabric.mod.json` set the entrypoint list to:
```json
		"fabric-client-gametest": [
			"dev.smartpets.gametest.SmartPetsClientGameTest",
			"dev.smartpets.gametest.TimeSourceClientGameTest"
		]
```
In `scripts/qa/run-client-gametest.sh` append after the ping line:
```bash
for marker in SMARTPETS_S11_OK; do
  grep -q "$marker" mod/build/run/clientGameTest/logs/latest.log || { echo "marker not seen: $marker" >&2; exit 6; }
done
```

- [ ] **Step 2: Verify it fails**

Run: `./gradlew build`
Expected: FAIL at `:mod:compileGametestJava` (`dev.smartpets.time.WorldTimeSource` does not exist). This is the red step; the game is not launched yet.

- [ ] **Step 3: Implement the adapter**

`mod/src/main/java/dev/smartpets/time/WorldTimeSource.java`:
```java
package dev.smartpets.time;

import dev.smartpets.core.time.WorldTimeSample;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.clock.ServerClockManager;
import net.minecraft.world.clock.WorldClocks;
import net.minecraft.world.timeline.Timelines;

/** Reads the world day from the overworld clock (= F3 "Day #"), whatever dimension the caller is in. Server thread only. */
public final class WorldTimeSource {
	/** Vanilla period of minecraft:day; used only if a datapack removed that timeline. */
	static final long VANILLA_DAY_TICKS = 24000L;

	private WorldTimeSource() {
	}

	public static WorldTimeSample sample(MinecraftServer server) {
		ServerClockManager clocks = server.clockManager();
		long clockTicks = clocks.getTotalTicks(server.registryAccess().getOrThrow(WorldClocks.OVERWORLD));
		long day = server.registryAccess().get(Timelines.OVERWORLD_DAY)
			.map(timeline -> (long) timeline.value().getPeriodCount(clocks))
			.orElseGet(() -> Math.floorDiv(clockTicks, VANILLA_DAY_TICKS));
		return new WorldTimeSample(day, clockTicks, server.overworld().getGameTime());
	}

	public static boolean usingFallback(MinecraftServer server) {
		return server.registryAccess().get(Timelines.OVERWORLD_DAY).isEmpty();
	}
}
```
`mod/src/main/java/dev/smartpets/time/TimeDevCommands.java`:
```java
package dev.smartpets.time;

import dev.smartpets.DevCommands;
import dev.smartpets.DevMode;
import dev.smartpets.SmartPetsMod;
import dev.smartpets.core.time.AgeClock;
import dev.smartpets.core.time.DayStep;
import dev.smartpets.core.time.WorldTimeSample;
import java.util.Map;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

/** Dev-only: /smartpets debug time. Brigadier merges this subtree with the S0 one (same literal names). */
public final class TimeDevCommands {
	/** Dev-command threshold only; the product value comes from config (S4). */
	private static final long DEV_FORWARD_JUMP_DAYS = 30;
	private static WorldTimeSample last;

	private TimeDevCommands() {
	}

	public static void register() {
		if (!DevMode.enabled()) {
			return;
		}
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
			dispatcher.register(Commands.literal("smartpets")
				.then(Commands.literal("debug")
					.then(Commands.literal("time").executes(ctx -> {
						var server = ctx.getSource().getServer();
						WorldTimeSample s = WorldTimeSource.sample(server);
						String line = "SMARTPETS_TIME day=" + s.worldDay() + " clock=" + s.dayClockTicks() + " game=" + s.gameTime()
							+ (WorldTimeSource.usingFallback(server) ? " fallback=true" : "");
						DevCommands.JOURNAL.record(s.gameTime(), "TIME_SAMPLE", Map.of("day", Long.toString(s.worldDay()), "clock", Long.toString(s.dayClockTicks())));
						if (last != null) {
							DayStep step = AgeClock.step(last.worldDay(), s.worldDay(), DEV_FORWARD_JUMP_DAYS);
							if (step.anomaly().journalType() != null) {
								DevCommands.JOURNAL.record(s.gameTime(), step.anomaly().journalType(), Map.of("from", Long.toString(step.previousDay()), "to", Long.toString(step.currentDay())));
								line += " anomaly=" + step.anomaly().journalType();
							}
						}
						last = s;
						SmartPetsMod.LOGGER.info(line);
						String reply = line;
						ctx.getSource().sendSuccess(() -> Component.literal(reply), false);
						return 1;
					})))));
	}
}
```
In `SmartPetsMod.onInitialize()`, after `DevCommands.register();`, add `dev.smartpets.time.TimeDevCommands.register();`.

- [ ] **Step 4: Build, then run the in-game test**

Run: `./gradlew build` → BUILD SUCCESSFUL (core 15 tests).
Run: `bash scripts/qa/run-client-gametest.sh`
Expected: exit 0; log has `S11 step '1 time set 10d': WorldTimeSample[worldDay=10, dayClockTicks=240000, ...]` through step 7b, one `SMARTPETS_TIME day=1 ...` line, then `SMARTPETS_S11_OK`; final screenshot line `OK range=...` (S0 test unchanged). If a `time`/`gamerule` command is rejected, the server log shows the reason: fix the command text from `TimeCommand`/`GameRuleCommand` sources and record it. If `waitTicks(40)` with `advance_time true` shows no clock change, raise to 100 and record.
Also confirm the command is dev-only: `grep -c "SMARTPETS_TIME" mod/build/run/clientGameTest/logs/latest.log` → `1`.

- [ ] **Step 5: Leak check, log, commit**

Append to `MODLOG.md`: date, the steps that passed with their logged samples, any command that needed a different spelling.
```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "feat(mod): add overworld-clock time source, dev time command and S11 GameTest"
```

---

### Task 3: Close S11 (ADR, behavior table, spec wording)

Tier: FORTE (Architect). Branch: `docs/s11-close`. Depends on Tasks 1–2 and their evidence.

**Files:**
- Create: `docs/adr/0003-time-source.md` (next free number; renumber if S10/S1 took 0003)
- Modify: `docs/spec/SPEC.md` §4, `docs/spec/V0-SPIKES.md` (S11 status), `specs/UNSPECIFIED.md`, `site/data/status.json`, `README.md` roadmap table, `MODLOG.md`

- [ ] **Step 1: Write the ADR with the behavior table (state each row as VERIFIED-IN-GAME, UNIT, or SOURCE-ONLY)**

| # | Situation | World day effect | Game time | Pet effect | Evidence |
|---|---|---|---|---|---|
| 1 | `/time set <n>` absolute (e.g. `10d`) | jumps to `n/period`, either direction | unchanged | forward: elapsed counted; backwards: see 6 | GameTest step 1 |
| 2 | `/time add <n>` (negative allowed, floor 0) | ± | unchanged | as 1/6 | GameTest step 2 |
| 3 | Players sleep (enough %, `advance_time` on) | clock to next multiple of period: +1 day | unchanged | ages one day | GameTest step 3 (marker call; real bed = human playtest) |
| 4 | `gamerule advance_time false` | frozen; sleep does not skip | advances | no aging | GameTest step 4 |
| 5 | `advance_time` back on | resumes | advances | — | GameTest step 5 |
| 6 | Clock set backwards | decreases | unchanged | age frozen (max rule), elapsed 0, `CLOCK_BACKWARDS` | GameTest step 6 + `AgeClockTest` |
| 7 | `/time set <marker>` (`day`,`noon`,`night`,`midnight`) | forward only to next occurrence (may be +1 day) | unchanged | as 1 | GameTest steps 7a/7b |
| 8 | `/time pause`, `/time rate <r>` | frozen / scaled | advances | as 4 / faster aging | SOURCE-ONLY |
| 9 | `/tick freeze` | frozen | frozen | none | SOURCE-ONLY |
| 10 | Caller in the nether (no default clock; `/time` default forms fail) | adapter reads overworld clock anyway | — | none | SOURCE-ONLY |
| 11 | Datapack changes/removes `minecraft:day` | period from the timeline / fallback 24000 + `fallback=true` | — | none | SOURCE-ONLY |
| 12 | Big forward jump (≥ `forwardJumpDays` [T]) | — | — | counted, `CLOCK_FORWARD_JUMP`; caps in S4 | `AgeClockTest` |
| 13 | Old pre-26 world | vanilla `DayTimeToClockFix` converts `DayTime` to the clock | — | none | SOURCE-ONLY (class exists, not read) |

Also record: decision, the two rejected alternatives (open for the human, `CLAUDE.md` §6), the `/time query day` replacement (`/time query minecraft:day repetition`, source-read, not run), int range of `/time set` (≈ 89,478 days max).

- [ ] **Step 2: Update SPEC §4** — replace "the 'Day N' of F3 / `/time query day`" with "period count of the `minecraft:day` timeline on the overworld clock (F3 'Day #'); see ADR-0003". Keep the age formula; mark S11 decided pending human approval.
- [ ] **Step 3: Add to `specs/UNSPECIFIED.md`**: "After `/time set` backwards, should age stay frozen until the world day catches up (current rule) or keep counting (needs an own accumulator, conflicts with CLAUDE.md §6)?" and "Should `advance_time false` stop aging (current) or not?".
- [ ] **Step 4: Mark S11 in `docs/spec/V0-SPIKES.md`** (PASS / PASS-WITH-FALLBACK with ADR link and what is SOURCE-ONLY), update `site/data/status.json` (`updated` date, spike state) and the README roadmap row, then `bash scripts/qa/docs-freshness.sh`.
- [ ] **Step 5: Leak check, commit**

```bash
bash scripts/qa/leak-check.sh
git add -A && git commit -m "docs: close V0-S11 time source with ADR and behavior table"
```

---

## Out of scope for S11 (explicit)

Persisting a last-seen day and catch-up (S4); per-pet records; real bed sleeping with a player (human playtest); the End clock; multiplayer sleep percentage.

## Self-Review Notes

- Spec coverage: clock choice (findings + Task 3 ADR), sleep (row 3), `/time set` (rows 1, 6, 7), daylight cycle off (= `advance_time`, rows 4–5), `age_days` monotonic adopted (Task 1 + row 6).
- Unverified until run: that `TestServerContext#runCommand` is synchronous enough for the immediate `computeOnServer` read (S0 used it with a wait; if reads lag, add `context.waitTick()` after each command and record); that `time set noon`/`time set day` resolve to the vanilla markers by bare id; Fabric command-tree merge of two `smartpets` registrations (Brigadier merges same-name literals; if not, move the `time` node into `DevCommands` and record).
