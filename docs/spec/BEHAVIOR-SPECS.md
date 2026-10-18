# Behavior Specs: executable plain-text specifications

Why: we want to write down, in plain text, what the dog does in every situation ("what happens if I say the name and give no command?", "if I look at the dog and call it?", "if I say attack while looking at a villager?"), run those descriptions as tests, and find the situations nobody thought of. The same text is spec, acceptance criteria, and regression suite.

## Three tools, one purpose
1. **Scenarios (Gherkin `.feature`)** in `specs/behaviors/`. Given/When/Then, closed step vocabulary in `specs/GLOSSARY.md`. Expected behaviors, decided or proposed.
2. **Decision tables and matrices** in `specs/matrix/`. Enumerate situation dimensions; a tool expands them, matches the first rule, and lists combinations with no rule as `UNSPECIFIED`. This finds the cases we did not foresee.
3. **Property tests and a surprise log.**
   - Property-based tests generate random event sequences (cues, targets, states, time jumps) and assert invariants: never attacks player/ally, needs stay within bounds, age monotonic, determinism per seed, persistence round-trip equals original, no exceptions.
   - In dev mode the engine writes `UNSPECIFIED_SITUATION` to the event journal when no explicit rule applied. QA playthroughs and fuzz runs collect them; the architect triages into `specs/UNSPECIFIED.md` and then into new scenarios.

## Layers (one spec, two speeds)
Scenarios talk to an abstract `PetWorld` driver. Two implementations:
- **Core driver** (fast, pure Java, fake clock, injected RNG). Runs everything tagged `@core`.
- **Platform driver** (real game via GameTest). Runs the `@platform` subset to prove the adapter matches the core.
Assertions read the **event journal** (the same journal QA uses), never internals. Commands are injected through the same server-side command handler the client uses (S8), (the preferred route). Verified in S0 (fabric-client-gametest-api-v1 6.0.2, inside Fabric API 0.161.0+26.2, checked with javap; see `MODLOG.md` and ADR-0002): the client GameTest API exposes scripted input (`ClientGameTestContext#getInput()` returns `TestInput`: key/mouse, `lookAt(yaw,pitch)`, `typeChars`) and server commands (`TestServerContext#runCommand(String)`, exercised by the S0 dev-command test). Use them for end-to-end checks of the client path; the server-side command handler stays the preferred route for scenario commands.

## Tags
`@decided` failing = bug · `@proposed` needs human OK before it is a requirement · `@open` safe default documented · `@core` `@platform` `@voice` `@slow` `@v2` `@v3`.
An executor may not edit a feature file to make it pass; changes go through the architect and, for `@proposed`/`@open`, the human.

## Tooling (verify versions in S0/S10)
- Cucumber-JVM 8.0.x with the JUnit Platform engine for `.feature` files (recent releases reported as of Sept 2026; Java 17 baseline).
- jqwik (JUnit 5 property-based engine, supports stateful testing) for properties.
- GameTest (Fabric) for the platform driver.
- A small matrix expander/reporter (to be written in S10; pure Java or script).
If any tool fails to fit, fallback: a minimal in-house runner that parses `.feature` text.

## Workflow
1. Architect writes or updates scenarios and tables first, tags them, and flags open questions in `specs/UNSPECIFIED.md`.
2. Human approves `@proposed` items (or changes them).
3. Executors implement until the suite passes. They never weaken specs.
4. Reviewer checks that every changed behavior has a scenario and no `@proposed` scenario was treated as decided without approval.
5. QA runs `@core`, `@platform`, the property suite and a manual/MCP session, and reports every `UNSPECIFIED_SITUATION` it saw.
6. New surprises become rows in `specs/UNSPECIFIED.md`, then scenarios.

## Coverage metrics reported per PR
Scenarios by tag, matrix cells covered/unspecified, property seeds run, journal events never asserted (dead behavior), unspecified situations observed.

## Current content
- `specs/GLOSSARY.md` step vocabulary and tags
- `specs/behaviors/01..06` ~67 scenarios: name/attention, commands, training, judgment, energy/sleep, health/persistence/time
- `specs/matrix/cue-handling.md` first decision table (R1–R25)
- `specs/UNSPECIFIED.md` 18 situations awaiting a decision
