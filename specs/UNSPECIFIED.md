# Queue of unspecified behaviors (human triage)

Found while writing the behavior specs and decision table. For each: what happens by default now, a proposal, and a decision. Resolved items become scenarios with `@decided`.

| # | Situation | Safe default now | Proposal | Decision |
|---|---|---|---|---|
| 1 | Player looks at the dog and says a command (no name) while only this dog is near | ignore | Obey only at mastery ≥ 4 (scenario in 02) | pending |
| 2 | Name said while looking at a different dog | the named dog reacts, the looked-at dog does not | Name wins over crosshair | pending |
| 3 | Two dogs have similar name cues | both may react | Matcher returns best match only; tie = nobody + head_tilt on both | pending |
| 4 | A command cue is similar to another dog's name | ambiguous | Name cues have priority over command cues in the match order | pending |
| 5 | Command given while dog is in a frenzy | ignore | Frenzy ends early only for mastery ≥ 4 + high bond | pending |
| 6 | Cue spoken by a recording/another voice | accepted if close enough | Strictness by intelligence; V3 adds speaker check | pending |
| 7 | Name then silence then command after the window | command ignored (needs attention) | Window 3 s; make configurable | pending |
| 8 | Command while the dog is mid-command (e.g., Sit during Attack) | later command replaces earlier | Attack ends on any safety/stop cue; others queue? | pending |
| 9 | Stay while the player dies, logs out, or changes dimension | ? | Stay ends; dog goes to its bed/den | pending |
| 10 | Attack target dies or leaves loaded area | stop | Return near the player | decided (04) |
| 11 | Two players issue cues at once (V3) | highest bond wins | Owner tie-break | decided (V3 doc) |
| 12 | Cue heard through walls/underwater | in hearing radius counts | Occlusion reduces range ×0.5? | pending |
| 13 | Dog's name cue is learned from a chat string, player later switches to voice | separate cue | Allow linking two tokens to one command | pending |
| 14 | Dog is leashed or in a boat/minecart when commanded | ? | Commands needing movement refused with head_tilt | pending |
| 15 | Command to a dog in an unloaded chunk | no hearing | Not delivered | decided |
| 16 | Treat given while the dog is mid-frenzy or asleep | ? | Ignored when asleep; accepted when calm only | pending |
| 17 | Player spams the same cue every tick | rate-limited | Cooldown 0.5 s per dog | pending |
| 18 | Cue training while a hostile mob is nearby | ? | Training counts less (distracted) | pending |
| 19 | `/time set` moves the world day backwards | age stays frozen until the world day passes the old maximum (`AgeClock.ageDays`, ADR-0003) | Keep. Alternative: keep counting needs an own accumulator, which conflicts with CLAUDE.md §6 (no own clock) | pending (human) |
| 20 | `gamerule advance_time false` (daylight cycle off) | aging stops, because the world clock is frozen (ADR-0003) | Keep. Alternative: count game time while off (conflicts with "age = world day - birth day") | pending (human) |
