# ADR-0003: World time source for pet age (V0-S11)

- Status: Proposed (awaiting human approval). Rulings below are decided by the controller pending human approval.
- Date: 2026-10-18
- Spike: V0-S11 (`docs/spec/V0-SPIKES.md`)
- Evidence: `MODLOG.md` entry "2026-10-18 - S11 time source adapter (Task 2)"; `core` unit tests `AgeClockTest`; headless GameTest `TimeSourceClientGameTest` run by `bash scripts/qa/run-client-gametest.sh` (exit 0, `OK range=16..235`, `SMARTPETS_S11_OK`).
- Numbering (assigned 2026-10-18): S11 = ADR-0003, S4 = ADR-0004 (its plan already says so), S10 = ADR-0005, S1 = ADR-0006. The S10 and S1 plans (`docs/superpowers/plans/2026-10-18-v0-s10-behavior-specs.md`, `...-v0-s1-voice-offline.md`) said ADR-0003 and were renumbered.

## Context
SPEC §4 says age is the world day minus the birth day, with no clock of the mod's own (`CLAUDE.md` §6). In Minecraft 26.2 the old `DayTime` is gone: time lives in world clocks (`ServerClockManager`), and the "day" is the period count of the `minecraft:day` timeline on the overworld clock. `/time query day` no longer exists. S11 asks which clock gives the day counter and how it behaves with sleep, `/time set` and the daylight cycle turned off.

## Decision
1. **World day** = `Timelines.OVERWORLD_DAY` (`minecraft:day`, period 24000) `getPeriodCount` over the overworld clock (`WorldClocks.OVERWORLD`), read on the server thread, whatever dimension the caller is in. This should be F3 "Day #" (source-read; nobody looked at F3 in game). If a datapack removes that timeline, fall back to `floorDiv(overworld clock ticks, 24000)` and report `fallback=true`. Adapter: `mod/.../time/WorldTimeSource.java`.
2. **Age is monotonic**: `age_days = max(previous_age_days, max(0, current_day - birth_day))` (`core/.../time/AgeClock.java`). After a backwards `/time set` the age stays frozen until the world day passes the old maximum, then counts again. Age is not capped.
3. **Elapsed days between observations** (`AgeClock.step`): forward delta counted; backwards counts 0 and is flagged `CLOCK_BACKWARDS`; a forward jump of at least `forwardJumpDays` [T] is counted and flagged `CLOCK_FORWARD_JUMP` (caps for needs/catch-up belong to S4, not to age). The dev command uses 30 as a dev-only threshold; the product value comes from config.
4. **`gamerule advance_time false` stops aging**, because it freezes the world clock (game time still runs).
5. The rules live in `core` (pure, no Minecraft); only `WorldTimeSource` touches the game.

### Rejected alternatives (open for the human)
- **Own accumulator that keeps counting during backwards time** (e.g. add game ticks): rejected because it is a clock of the mod's own and conflicts with `CLAUDE.md` §6 ("Idade = dia do mundo atual - dia de nascimento. Sem relógio próprio"). Changing that needs the human.
- **Count from game time** (`getGameTime`, ticks since world creation): rejected because it ignores sleep and `/time set` (players expect a slept night to age the pet one day), does not match F3 "Day #", and keeps running with `advance_time false`.

## Behavior table
Evidence levels: **VERIFIED-IN-GAME** = asserted by the headless GameTest (`TimeSourceClientGameTest`) or by the guarded log greps in `scripts/qa/run-client-gametest.sh`; **UNIT** = `core` JUnit (`AgeClockTest`, 10 tests) or pure `AgeClock` calls; **SOURCE-ONLY** = read in decompiled 26.2 sources, not run; **SIMULATED** = the in-game path was replaced by the call vanilla makes.

| # | Situation | World day | Game time | Pet effect | Evidence |
|---|---|---|---|---|---|
| 1 | `/time set <n>` absolute | jumps to `n/period`, either direction | unchanged | forward: elapsed counted; backwards: see 6 | Clock: VERIFIED-IN-GAME, step 1 (`time set 10d` -> day 10, clock 240000); backwards direction in steps 6 and 9. Pet effect: UNIT (`AgeClockTest`), inferred for pets (no pet exists) |
| 2 | `/time add <n>` | +/- n; negative allowed, total floored at 0 | unchanged | as 1 / 6 | VERIFIED-IN-GAME for `time add 1d` (step 2, day 11). Negative add and the floor at 0: SOURCE-ONLY (`TimeArgument.time(Integer.MIN_VALUE)`, `ServerClockManager#addTicks` uses `max(total + ticks, 0)`) |
| 3 | Players sleep through the night | clock moves to next `wake_up_from_sleep` marker: +1 day | unchanged | ages one day | SIMULATED in game: step 3 calls `moveToTimeMarker(OVERWORLD, WAKE_UP_FROM_SLEEP)` (day 11 -> 12). That this is what a bed sleep calls (`ServerLevel#tick`) is SOURCE-ONLY. Real bed sleep with a player: needs human playtest |
| 4 | `gamerule advance_time false` | frozen | advances | no aging | VERIFIED-IN-GAME: step 4 (clock unchanged over 40 ticks, game time grew). "Sleep does not skip while off": SOURCE-ONLY (the step 3 marker call ran with the rule off, so it does not prove what a bed does) |
| 5 | `advance_time` back on | resumes | advances | aging resumes | Clock: VERIFIED-IN-GAME, step 5 (clock grew over 40 ticks). Pet effect: inferred from the age rule (UNIT); no pet exists |
| 6 | Clock set backwards | decreases | unchanged | age frozen (max rule), elapsed 0, `CLOCK_BACKWARDS` | Clock: VERIFIED-IN-GAME, step 6 (`time set 1000` from day 12 -> day 0) and step 9 (from day 1 -> day 0). `CLOCK_BACKWARDS` through the real command path: VERIFIED-IN-GAME, step 9 (journal assert) + runner grep exit 9 (`day=0 clock=1000 ... anomaly=CLOCK_BACKWARDS`). Age frozen: UNIT (`AgeClockTest`; the GameTest's `ageDays` checks are pure calls, no pet exists) |
| 7 | `/time set <marker>` (`day`, `noon`, `night`, `midnight`) | forward only, to the next occurrence (may be +1 day) | unchanged | as 1 | VERIFIED-IN-GAME for `noon` (step 7a: from clock 1000 -> 6000, day 0) and `day` (step 7b: from 6000 -> 25000, day 1). `night`/`midnight`: SOURCE-ONLY. Pet effect: UNIT, inferred for pets |
| 8 | Dev command run in the nether | adapter reads the overworld clock anyway | - | none | VERIFIED-IN-GAME: step 8 (`execute in minecraft:the_nether run smartpets debug time`) + runner grep exit 8 (two identical `day=1 clock=25000` lines, overworld and nether) |
| 9 | `/time pause`, `/time rate <r>` | frozen / scaled (rate 0.00001..1000) | advances | as 4 / faster or slower aging | SOURCE-ONLY (`TimeCommand`, `ServerClockManager.ClockInstance#tick`) |
| 10 | `/tick freeze` | frozen | frozen | none | SOURCE-ONLY (planning read, not re-checked here) |
| 11 | `/time` default forms in the nether (no default clock) | command fails (`commands.time.no_default_clock`); `/time of minecraft:overworld ...` works | - | none | SOURCE-ONLY (`TimeCommand#getDefaultClock`) |
| 12 | Datapack changes or removes `minecraft:day` | period from the timeline; if removed, 24000 fallback + `fallback=true` | - | none | SOURCE-ONLY; the fallback branch was never executed |
| 13 | Big forward jump (>= `forwardJumpDays` [T]) | - | - | counted, `CLOCK_FORWARD_JUMP`; caps in S4 | UNIT (`AgeClockTest#bigForwardStepIsFlaggedButStillCounted`) |
| 14 | Old pre-26 world | vanilla `DayTimeToClockFix` converts `DayTime` to the clock | - | none | SOURCE-ONLY (class exists in 26.2 sources; its body was not read; no old world loaded) |
| 15 | New world resets the dev command's last sample | - | - | - | SOURCE-ONLY (code-read: `last` reset on `SERVER_STARTING`). Runner exit 7 only counts 3 `SMARTPETS_TIME` invocations and cannot detect a missing reset (the S0 test world never calls `debug time`) |

GameTest step list as built (`mod/src/gametest/.../TimeSourceClientGameTest.java`): 1 `time set 10d`; 2 `time add 1d`; 3 wake-up marker (simulated sleep); 4 `advance_time false` freeze; 5 `advance_time true` resumes; 6 `time set 1000` backwards from day 12; 7a `time set noon`; 7b `time set day`; dev command in the overworld; 8 dev command in the nether; 9 `time set 1000` backwards from day 1, dev command, journal holds `CLOCK_BACKWARDS` and 3 `TIME_SAMPLE`. A proof of failure was run: with the command literal renamed the run failed at step 9 (runner exit 1).

## Commands and limits (source-read, not run)
- `/time query day` is gone. Replacement: `/time query minecraft:day repetition` (F3 day), `/time query time` (clock ticks), `/time query gametime`.
- `/time set <time>` takes an `int` of ticks: max 2,147,483,647 ticks = about 89,478 days. `/time add` also takes an `int`, so larger days need several adds. Query results returned to command blocks wrap at `Integer.MAX_VALUE`.

## Not verified / out of scope
- Real bed sleep with a player, sleep percentage, multiplayer sleep: human playtest / later.
- Persisting a last-seen day and catch-up on load: S4.
- Per-pet records (no pet exists yet; age is checked as pure function only).
- The End clock and other dimensions' own clocks.

## Process note
`site/dev.html` (owner C in `site/CONTRACT.md`) was edited at S11 close under the `CLAUDE.md` §13 rule that the Developers tab follows spec changes.

## Graduation
`core/.../time/{AgeClock, DayStep, TimeAnomaly, WorldTimeSample}` and `mod/.../time/WorldTimeSource` are proposed to graduate to V1 if the human approves this ADR. `TimeDevCommands` stays dev-only (active only with `-Dsmartpets.dev=true`).
