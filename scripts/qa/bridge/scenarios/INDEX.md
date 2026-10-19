# Live QA scenario catalog

This is the project's reusable memory of in-game scenarios. Search here BEFORE writing a scenario, and reuse or
extend a row. Every new or changed scenario gets a row here with its spec link (`specs/behaviors/*.feature`
scenario name, or a `specs/UNSPECIFIED.md` row). Promote stable scenarios to headless client GameTests later.

Run: `bash scripts/qa/run-bridge-scenario.sh <name> [--repeat N] [--seed S]`. Format: `../README.md`.

Header convention, `.cmds` (lint-enforced: scenario, purpose, needs):
```
# scenario: <name>
# purpose: <one line>
# needs: test-world | in-world
# covers: <specs/behaviors/<file>.feature: "<scenario name>"> | none (<why>)
# assertions: <name>.groovy
```
Header convention, `.groovy` (lint-enforced: timeoutMs, `return spReport()`): `// scenario: <name>` then `// timeoutMs: N`.

| # | Name | Purpose | Preconditions | Files | Covers (spec) | Status | Last run |
|---|---|---|---|---|---|---|---|
| 1 | smoke-world | Toolkit self-test: test world, day, clear, creative, walled arena, tamed wolf + zombie seen by spNearby, survival, kill, close to title, reopen | dev client up with DebugBridge; creates `sp-test-flat` if missing | `smoke-world.cmds`, `smoke-world.groovy` | none (toolkit self-test; no product behavior exists yet) | VERIFIED (fix wave: `SP_FAST=1 --repeat 3 --seed 1` 3/3, default mode 1/1 at ~1 fps) | 2026-10-19 |
