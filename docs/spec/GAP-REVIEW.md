# Spec Review: contradictions, gaps, decisions needed

Review of `docs/01`–`docs/26` against the consolidated `SPEC.md`. Goal: find what was forgotten before any code.

## A. Contradictions and drift found (and resolution in SPEC)
| # | Finding | Resolution |
|---|---|---|
| 1 | Doc 15 says "the bed defines home" but doc 07 says gen-1 wild dogs ignore beds | Home anchor abstraction: den (wild/gen-1) or bed (domesticated) (SPEC §14) |
| 2 | Doc 08 asked fixed vs chosen words; doc 19 made any word trainable | Cue abstraction: voice template, chat text or key (SPEC §8) |
| 3 | Doc 16 lists Dig as a Tier-3 Exploration skill; doc 20 says Dig is discovered by chance/need | Dig is a passive skill discovered first, then cue-trainable and masterable (SPEC §8, §14) |
| 4 | Doc 22 puts voice at V1.5; the human now wants voice proven in V0 | Voice ships in V1 if spike S1 passes, otherwise V1.5 (SPEC §2) |
| 5 | Doc 18 milk only for orphans vs doc 07 "orphan needs ~1 year of care" | Milk phase then weaning (5+5 days, tune); the year-long need is companionship, not feeding (SPEC §13) |
| 6 | "Never show numbers" (doc 05) vs the need for QA and tuning | Dev-only debug commands and event journal; never in release UI (SPEC §22) |
| 7 | Cat has "no training" (doc 21) but shares the dog core (bond) | Cat uses affection, not bond; name recognition minimal [O] (SPEC §17) |
| 8 | "Sleep only when pets sleep" vs vanilla percentage-sleep logic and multiplayer | Separate rule, own radius, config off switch; verify hook in S7 (SPEC §14) |
| 9 | Docs mix year lengths (docs 06, 18, 21); several numbers presented as decisions | Marked [T]; all in config (SPEC header) |
| 10 | Skeleton-dog: aging and litters never stated | Assumed no aging/no litters, flagged [O] |
| 11 | Doc 17 leader nomination vs V3 owner rights | Owner nominates with legitimacy/tolerance rules; see SPEC §24 item 8 |

## B. Missing from the design docs (added to SPEC or flagged)
| Gap | Where added |
|---|---|
| Entity strategy (custom entity vs wrapping vanilla Wolf) | §3 [P], spikes S3/S6 |
| Persistent pet registry / pet record separate from the entity (needed for go-home, mourning, lookups) | §3, spike S4 |
| Catch-up simulation when chunks/world were not loaded | §4, spike S4 |
| Genome schema (trait list, ranges, inheritance modes) | §5 |
| State vector (needs) and mood derivation | §6 |
| Bond economy: gain sources, daily caps, decay | §7 |
| Obedience formula inputs and visible refusal | §10 |
| Danger model for layer 0 (what to avoid, who never to target) | §11 |
| Pet targeting/selection UI with several dogs; mark-target by look | §19 |
| Two names (text name vs learned name cue) | §8 |
| Crafting recipes, progression, advancements, creative tab | §24 item 7 [O] |
| Dimension/portal rules for following and go-home | §14 [O] |
| Den/orphan scene worldgen design | §13 [O] |
| Replacing vanilla wolf spawns and compatibility policy | §3, §22 |
| Time-source edge cases (`/time set`, daylight cycle off, sleeping) | §4, spike S11 |
| Fetch/carry item mechanics (mouth slot render) | spike S3 add-on |
| Vehicles/leads/doors/ladders pathfinding behavior | V1 tasks [O] |
| Mod id, public name, mod license, public vs personal release | §24 item 2 |
| Asset provenance ledger (`ASSETS.md`) and AI disclosure plan | §22 |
| Dev/debug commands + event journal for QA | §22, spike S0 |
| Performance budgets and max active pets | §22 [T] |
| Subtitles/accessibility for sounds | §16, §22 |
| Notebook reveal rules | §18 |
| Bed/bowl/den block entities and ownership data | §18, spike S4 |
| Death memorial and grief effects | §12 [O], docs/17 |
| i18n (pt-BR + en) | §22 |

## C. Decisions needed from the human (not guessable)
1. Target version/loader (blocks scaffold). 2. Mod id/name/license/publishing intent. 3. Art and sound style. 4. Year length. 5. Vice list for V1. 6. Whether the first playable slice (SPEC §20) is right. 7. Skeleton-dog rules. 8. Dimension-follow rule.

## D. Deferred or cut (explicit)
Cat second wave (tall navigation, introductions, hunting, hiding). Litter box (cut). Consanguinity, sex-based differences, estrus/pregnancy (out). Pack hierarchy details beyond leader influence (V1 late). Illness (V1.5+). Rare skills beyond sword (later). Pet armor enchantments (later). Multiplayer (V3).

## E. Process risks
- Too many [T] numbers: mitigated by config + debug commands.
- Drift: mitigated by oracles per task (CLAUDE.md §4) and ADRs for every V0 decision.
- Tool fragility (MCP chains, version coverage): V0-S0 verifies each link before depending on it.
