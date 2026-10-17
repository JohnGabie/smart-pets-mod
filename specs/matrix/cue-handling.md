# Decision table: handling a spoken cue

Purpose: enumerate every combination of the situation dimensions so we find behaviors nobody specified. A tool (V0-S10) expands the dimensions, matches each combination to the FIRST rule below, and reports combinations with no rule as `UNSPECIFIED`. Every `UNSPECIFIED` combination must at minimum satisfy the safe default (ignore + `head_tilt`, never harm, never crash) and goes to the human triage queue (`specs/UNSPECIFIED.md`).

## Dimensions
| Dimension | Values |
|---|---|
| input | name_only · command_only · name_then_command · command_then_name · unknown_after_name · other_dogs_name · two_commands |
| target (look) | none · self_dog · hostile_mob · passive_animal · villager · player · ally_pet · stronger_mob · item |
| dog_state | calm · excited · tired · scared · hungry · asleep · dozing · downed · frenzy · busy_command · wild · puppy · senior |
| hearing | in_range · out_of_range · whistle |
| bond | low · mid · high |
| learned | cue_known_mastery_low · cue_known_mastery_high · cue_unknown · name_unknown |
| dogs_in_range | one · several |
| speaker | owner · other_person (V3) |
| input_channel | voice · chat · key |

Raw space is thousands of cells; the tool uses pairwise coverage for the first pass and full expansion for the safety-critical slice (target ∈ {player, ally_pet, villager} × any input).

## Rules (first match wins)
| # | When | Expect | Tag |
|---|---|---|---|
| R1 | hearing = out_of_range (no whistle) | no reaction | decided |
| R2 | dog_state = downed | no reaction | decided |
| R3 | dog_state = frenzy | ignore; may calm at mastery high | open |
| R4 | dog_state ∈ {asleep, dozing} and input includes name | wake ladder | decided |
| R5 | dog_state ∈ {asleep, dozing} and command only | stays asleep | decided |
| R6 | input = name_only | attention gained, look_at_player | decided |
| R7 | learned = name_unknown | head_tilt, no attention | decided |
| R8 | input = other_dogs_name | that dog reacts, this one does not | decided |
| R9 | input = unknown_after_name | head_tilt | decided |
| R10 | target ∈ {player, ally_pet} and command = ATTACK | refuse, head_tilt, never attack | decided |
| R11 | target ∈ {villager, passive_animal} and command = ATTACK | refuse | proposed |
| R12 | target = none and command = ATTACK | COMMAND_NEEDS_TARGET | proposed |
| R13 | target = stronger_mob and dog_state = scared | refuse, whine | decided |
| R14 | input = command_only and dogs_in_range = several | ignore all | proposed |
| R15 | input = command_only, mastery_high, dogs_in_range = one | obey | proposed |
| R16 | input = command_only, mastery_low | COMMAND_IGNORED_NO_ATTENTION | proposed |
| R17 | input = command_then_name | treated as command_only then name_only | open |
| R18 | input = two_commands | first obeyed, second journal UNSPECIFIED | open |
| R19 | dog_state = tired | refuse with yawn | proposed |
| R20 | bond = low and not (mastery_high) | may ignore; willingness reduced | decided |
| R21 | speaker = other_person | per bond of that person; stranger = no obedience | decided (V3) |
| R22 | input_channel ∈ {voice, chat, key} | identical behavior (same internal command) | decided |
| R23 | dog_state = wild | no cue obeyed; trust ladder only | decided |
| R24 | dog_state = puppy and command not yet learnable | head_tilt | proposed |
| R25 | anything else | UNSPECIFIED → safe default | — |
