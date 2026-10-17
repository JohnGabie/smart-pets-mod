# Step vocabulary (behavior specs)

Specs are Gherkin (`.feature`) in English. Steps are a closed vocabulary so any agent (and the human) can read and extend them. Add a step here before using it.

## Tags
| Tag | Meaning |
|---|---|
| `@decided` | Expected behavior is in the approved spec. Failing = bug. |
| `@proposed` | Architect's proposal; needs human OK before it counts as a requirement. |
| `@open` | Behavior intentionally undefined; scenario documents the safe default. |
| `@core` | Runs against the in-memory simulation (fast). |
| `@platform` | Also runs in the real game (GameTest). |
| `@voice`, `@slow`, `@v2`, `@v3` | Area / cost / version. |

## Test hooks (deterministic obedience)
Obedience is probabilistic in the game. In specs it is controlled: `Rex is obedient today` forces willingness=1, `Rex is stubborn today` forces willingness=0, otherwise a fixed seed is used (`the random seed is 42`).

## Given
- `a world with default test config and the random seed is 42`
- `difficulty is peaceful|easy|normal|hard|hardcore`
- `a player` · `a second player` (V3)
- `an adult dog named "Rex"` (default traits) · `... with traits <intelligent|stubborn|fearful|clingy|wild>`
- `a puppy|adolescent|senior dog named "Rex"`
- `a second dog named "Fido"`
- `Rex knows the name cue "<token>"` · `Rex does not know any name cue`
- `Rex knows the command cue "<token>" for <COMMAND> at mastery <1..5>`
- `Rex does not know the cue "<token>"`
- `Rex is calm|excited|tired|scared|hungry|full|asleep|dozing|downed|sitting|lying`
- `Rex is <N> blocks from the player` · `Rex is outside hearing range`
- `Rex's bond with the player is <N>%`
- `Rex is obedient today` · `Rex is stubborn today`
- `a <zombie|creeper|cow|villager|iron golem> <N> blocks away`
- `lava <N> blocks ahead of Rex`
- `Rex's energy is <N>%` · `Rex has worn the work harness`

## When
- `the player says "<token>"` — a cue token (voice template, chat text, or key; language-agnostic)
- `the player says the name cue of Rex` · `...of Fido`
- `the player looks at Rex|Fido|a <mob>|another player|nothing`
- `the player gives a treat` · `the player performs the lure for <COMMAND>`
- `<N> seconds pass` · `a full day passes` · `the world is saved and reloaded`
- `the player damages Rex` · `Rex is damaged to 0 HP`

## Then (observable through the event journal, never internals)
- `Rex performs <COMMAND>` · `Rex does not perform <COMMAND>`
- `Rex shows <reaction>` — reactions: `head_tilt`, `look_at_player`, `approach`, `wag`, `whine`, `growl`, `yawn`, `sniff_ground`, `hearts`, `ignore`, `wake_step_1..3`
- `Rex attacks <target>` · `Rex does not attack <target>`
- `Rex moves away from <hazard>` · `Rex does not enter <hazard>`
- `the journal contains "<EVENT>"` · `the journal does not contain "<EVENT>"`
- `the journal contains "UNSPECIFIED_SITUATION"` — the engine met a case with no explicit rule (see `docs/spec/BEHAVIOR-SPECS.md`)
