# Smart Pets — Consolidated Specification (DRAFT v0.1)

Status: DRAFT, pending human approval. Per `CLAUDE.md`, no product code before approval.
Source: design history in `docs/01`–`docs/26` (Portuguese). Where they disagree, this file wins; see `GAP-REVIEW.md`.
Language: this spec is English (agent-facing). Design history stays Portuguese.

Markers: **[D]** decided by the human · **[P]** proposed, needs approval · **[O]** open question · **[T]** tuning default, adjust by playtest (must live in config/data, never hardcoded).

---
## 1. Goals and non-goals
Goals
- A companion that is useful and has presence: judgment, personality, genetics, training, bond, routines. A reason to come back to the world. [D]
- Dogs first (V1), cats later (V2), multiplayer later (V3). Singleplayer is the design target until V3. [D]
- Design quality over feature count; every feature must serve bond, usefulness, or life-like behavior.

Non-goals (for now)
- Scanner-style stat UIs. Chore loops (litter boxes, daily nursing). Estrus/pregnancy simulation (vanilla-like breeding stays). Cheats against other players. Anything for anti-cheat-protected games.

## 2. Scope by version
| Version | Scope |
|---|---|
| **V0** | De-risking. Toolchain + QA tooling + the hardest unknowns (voice, procedural coats, custom entity/model/animation, persistence + catch-up, off-simulation travel, AI core, sleep gating, server-authoritative networking, digging). Output: working pipeline + decisions (ADRs). See `V0-SPIKES.md`. [D] |
| **V1** | Dog, singleplayer: layers 0–5 in order (judgment, individual, health, skills, wild→domestic, pack). Voice ships in V1 if V0 spike S1 passes; otherwise V1.5. Smallest playable slice first (see §20). |
| **V2** | Cat (first wave only, see §17). Shared core. |
| **V3** | Multiplayer (bond per person, co-guardians, anti-theft, guardianship). |

## 3. Architecture
- **Two layers** [P]: `core` (plain Java, zero Minecraft imports: genome, inheritance, needs, mood, bond, training, mastery, aging, utility-AI engine, voice DSP and matching) and `platform` (loader adapter: entity, goals, rendering, networking, persistence, items/blocks, worldgen). `core` is unit-tested without launching the game; `platform` is verified with GameTest and in-game oracles.
- **Server authoritative** [D]: all rules run on the (integrated) server. Client does only microphone capture, input, rendering, UI.
- **Entity strategy** [P]: dedicated custom entity types (`dog`, later `cat`) — do NOT subclass or mixin vanilla Wolf. Reasons: we remove teleport-follow, change taming/breeding/AI wholesale, and avoid conflicts. Vanilla wolves in the world are replaced at spawn by our wild dog via biome spawn modification. Must confirm in spike S3/S6.
- **Pet record is the source of truth** [P]: each pet has a persistent `PetRecord` (UUID) in world-level saved data. The entity is a view that may be unloaded; the record survives. Needed for: go-home travel, notebook, mourning, lookups, catch-up. (Spike S4.)
- **Data-driven tuning** [P]: all [T] numbers, trait ranges, skill trees, danger tables, loot/recipes in JSON/config. Injectable RNG (seeded) everywhere for deterministic tests.
- **Versioned persistence** [D]: schema version + migration on every persisted structure; unknown fields preserved.
- **Prefer loader API events over mixins**; each mixin needs a written justification and a GameTest.
- **Stack** [O]: Minecraft version (likely 26.x, unobfuscated), Fabric, Java version required by that version, GeckoLib availability for that version. Pinned in the repo at scaffold time (V0-S0).

## 4. Time and age
- Clock = world day counter, not real time [D]: the period count of the `minecraft:day` timeline on the overworld clock (expected to equal F3 "Day #", source-read, not looked at in game; `/time query minecraft:day repetition`), read on the server whatever the dimension. S11 decided pending human approval; edge cases (sleep, `/time set`, `advance_time` off) in [ADR-0003](../adr/0003-time-source.md).
- `age_days = max(previous_age_days, max(0, current_day − birth_day))` — monotonic, never decreases even if time is set backwards; frozen until the world day passes the old maximum; not capped [P]. `advance_time false` stops aging [P]. Open questions: `specs/UNSPECIFIED.md` #19, #20.
- Mod year = 10 world days [T/O]. Life span 8–16 mod years by gene (80–160 days).
- Stages: puppy 0–1y, adolescent 1–2y, adult 2y→75% of lifespan, senior last 25% [T].
- Catch-up on load: needs, loneliness, rust, aging use elapsed days with caps (long absences are never punished like neglect) [D].

## 5. Genome (heritable data)
All floats 0..1 unless noted. Fixed at birth; training never changes genes [D].
| Trait | Effect |
|---|---|
| intelligence | learning speed, generalization of cues, ceiling of mastery |
| courage | combat willingness, flees vs engages |
| loyalty | obedience under stress, stays with owner |
| authority | leadership score |
| sociability | tolerance of dogs/cats/people |
| aggression | tendency toward conflict (vices) |
| prey_drive | chasing, fetch aptitude, livestock vice |
| energy_capacity | size of energy pool |
| appetite | weight-gain propensity |
| robustness | injury/illness resistance |
| clinginess | neediness / suffering when alone |
| wildness | domestication level; high in gen-1 wild, falls each generation [D] |
| smell, hearing, vision | sense levels (tracking, alerts, recognition) |
| sleep_depth | light vs deep sleeper |
| dig_propensity | chance to discover digging |
| lifespan | years 8–16 |
| voice | size class (S/M/L) + pitch offset |
| coat alleles + seed | appearance (§15) |
| sex, generation, parent ids, birth day | identity |
Wild gen-1 gets randomly generated traits (not under player control) [D].

**Inheritance** [D rule, T values]: child trait = mean(parents) + noise. ~80% normal; ~15% "rough diamond": 1–2 traits notably above both parents; ~1–2% "genius": several high traits and a raised training ceiling, with a built-in cost (e.g., high clinginess or energy). Regression to the mean: a genius's children mostly return to average; the ceiling bonus is rarely inherited. Some chance a puppy comes out below parents. Orphans get a small bias in these odds [D]. Wildness = parents' mean minus a per-generation drop [D].

## 6. State: needs, mood, weight
- Needs: satiety, energy (% of capacity; can overflow, §9), companionship, health, weight/body condition, comfort (cold/wet), training fatigue/stress, play need.
- Mood = derived from needs + recent events; drives animations, sounds, obedience.
- Weight can go lean → ideal → plump → fat → obese; effects: speed, stamina, jump (cats can't reach high places), snoring; reversible; never kills [D]. Appetite gene shifts the curve.
- Everyday care is prevention (good shelter, food, rest), not chores [D].

## 7. Bond
- Per person (V1: one person). 0–100%. Gained by doing things together (fetch, marked targets, walks, petting, feeding, calm training, returning home), with **daily caps** to prevent grinding [P]; decays slowly on long absence down to a floor [T].
- Bond unlocks abilities and firmness of commands (e.g., stay distance) [D]. Bond ≠ skill: skill = what it can do, bond = how willingly it does it [D].
- Separation behavior: clingy dogs wait at the door (sit/lie by level), greet on return, suffer more when alone [D].

## 8. Training
- **Cue** = abstract token that triggers a command: voice template, chat text, or key/UI button [P]. Training teaches the dog a cue→command association; so any language/sound works, and non-voice players train with chat/keys [D].
- Loop: attention (the dog's name cue) → cue → induce action (lure, right-click sit, dummy target…) → reward → repeat. Reps to learn: simple 3–6, medium 8–15, advanced 20+, scaled by intelligence, stage, bond, mood [T].
- Cue consistency required (similar sound/same text). Different cue each time = no learning [D].
- Name first, command second (short window, ~3 s) to prevent false triggers [P/T].
- Two names: text name (name tag/UI) and learned name cue [P].
- Overtraining: warning signs (yawn, sniff ground, scratch, look away) → then nervous (reps count less) or disinterested (wanders). Tolerance by temperament and stage [D].
- Satiety limits food rewards. Rewards: food, milk (orphans), petting (hearts). No physical punishment; correction = the "no" cue + withdrawing attention [D].
- Mastery: 5 levels per skill by successful executions [T numbers]. Rust: idle days reduce progress XP first; a level drops only after a very long time; never below "learned" [D]. Gene sets ceiling; practice approaches it.
- Prerequisites: soft by default (can train out of order at extra reps) with three hard locks besides Name: Release/"No" needs Fetch or Attack; Flank/Ambush needs Attack; Go-home needs Come [D].
- Passive skill: Dig is *discovered* (stuck, or play with loose blocks, chance by intelligence + dig_propensity), then becomes cue-trainable [D].
- Command catalog and lure methods: Name, Sit (right-click induced), Down, Stay (distance grows), Come, Follow (lure), Fetch, Attack (dummy), Release/No, Sleep, Go home, Track (scent item), see `docs/19`.

## 9. Energy and frenzy
Energy as % of capacity. Cost: walking, play, fight, learning (small). Recharge: rest, sleep. Overflow up to ~130% [T] triggers **frenzy** (running back and forth, zoomies) with min/max duration, ending near 70–100% or half; may go below 0% (debt) → dog collapses and sleeps; no damage [D]. Capacity by stage: puppy small + fast recharge, adolescent large, adult medium, senior small [T]. Penned-in with full energy → mischief (holes, howling, circling). Work harness suppresses frenzy. Fat dogs tire sooner.

## 10. Behavior AI (layered utility)
1. **Reflex** (always wins): danger avoidance, drop target if it is an ally/player/pet, flee lethal.
2. **Command**: the dog *evaluates* obedience: willingness = f(association strength, bond with speaker, mood, loyalty, fatigue). Refusal is visible (tilts head, ignores), never silent.
3. **Initiative**: ask for food, warn, defend owner, ambush, bring gifts, play. Learned weights: reward raises, ignoring lowers, "no" cue lowers; vices are behaviors whose weight training reduces [D].
4. **Routine**: sleep in bed/den, guard home, wait at door.
Utility scoring with commitment time; think every N ticks, not every tick [T]. Postures: free / near / guard. Work harness = focus mode.
Idle animations are sampled from state (§16).

## 11. Danger model (layer 0)
Avoid: lava, fire, magma, cactus, void edge, deep fall, deep water drowning, powder snow, sweet berries (as relevant), creeper about to explode (retreat), overwhelming mob groups, explosions, wither effects. Never target: player, owned/allied pets, villagers unless configured. Disengage when ordered. Never keep attacking to the death. Vanilla Wolf hostilities toward skeletons etc.: [O]. Danger table is data-driven. This is the foundation that makes permadeath fair [D].

## 12. Health, death, difficulty
- Injury: at 0 HP the dog is **downed** (not dead) with a rescue window by difficulty: Peaceful long and respawns at its bed with a delay and shaken mood; Easy long; Normal medium; Hard short; **Hardcore: no downed state, permanent death** [D]. Permadeath otherwise [D]. Difficulty is read at the event.
- Injured dogs limp, heal with rest/bandage (wool/honey/herbs) [P]. Illness is V1.5+: rare, with warning signs, mild/serious/old-age [D].
- Animal fights cause light injury/stress, never death [D]. Death entry in the notebook; optional memorial [O].
- Rare items (endgame) [D]: Youth potion (freezes age at moment of use, small non-cumulative heritability), Skeleton potion (undead dog respawns at base on every death, same reactions, learns nothing more; assumed no aging and no litters [O]).

## 13. Reproduction and acquisition
- Reproduction follows vanilla (feed two dogs → love mode), male+female only, adults only, from 2y until senior; litter 3–5 (sometimes 2, rarely 6); ~20 days interval per mother [D/T]. No estrus/pregnancy [D]. Sex has no other effect for now [D].
- Wild adult (gen-1) [D]: random traits, high wildness; conquest by patience/repetition without combat: distance → tolerance → food → touch → cues. Fails/flees if rushed or hurt [P]. Never needs the player to fight parents.
- Orphan puppy [D]: found via (a) den scene with signs of an attack (common), (b) witnessing the parents fall (uncommon), (c) a random orphan (very rare). Needs milk in a bowl (automatic when it passes, hearts, no animation); bonus genetic odds; high companionship need. Milk phase then weaning [P: 5+5 days]. Adults and puppies with parents: no feeding chore.
- Founders: the 9 vanilla wolf variants map to biome founder genomes [P]. Cross-biome breeding mixes coats.
- Worldgen for dens/scenes [O]: structure design, rarity, mobs. Spike later.

## 14. Home, sleep, mobility
- **Home anchor**: den (wild/gen-1) or bed (domesticated) [P]. Bed = home + respawn (Peaceful); if destroyed, fallback to player spawn [D]. Dogs may sleep anywhere; only the bed defines home [D].
- Sleep ladder: standing → lying → dozing → asleep; falling asleep is probabilistic by satiety, energy spent, calm, night, nearby bed, owner nearby (if clingy) [D]. Wake by name: dozing 1 call, normal 2–3, deep several or touch/food; abrupt wake lowers mood [D]. Light/deep sleeper is a gene.
- **Sleep gating** [D]: the player can only sleep if the pets within radius R are asleep. Mitigations: trained dogs go to bed at dusk, energy spent → sleepy, leader pulls group, "all sleep" command, config toggle off, kennel outside radius doesn't count. Not mandatory to sleep, so only matters when skipping night. Hook to be confirmed (spike S7).
- **No teleport** [D]. The dog follows by pathfinding; mobility comes from Exploration skills.
- **Go home** [D]: realistic range, ~1000 blocks base, ~2000 for strong trackers (Exploration + smell), genius can exceed [T]. Implemented as off-simulation travel on the pet record (spike S5): elapsed time, risk model, arrival at home anchor. Not across dimensions.
- Dimensions [O]: whether/how dogs follow through portals (propose: only if within R when the player enters).
- **Dig** [D]: stuck dog digs only loose blocks (dirt, sand, gravel, clay), never player structures; honors mobGriefing and protected areas; heads for owner's scent/sound. Optional "dig holes when penned" with off switch.

## 15. Appearance
- Coat = base color + pattern layers (e.g., white socks, chest, muzzle blaze, patches, saddle, brindle later) + individual seed shifting position/intensity. Stored as genes+seed; textures composed client-side deterministically [D/P]. Hand-drawn pixel-art masks colored by the algorithm; limited palette [P].
- Alleles with dominance + hidden carriers for coat; continuous traits for the rest [D]. Pure-line parents → near-identical litter (golden), mixed parents → varied litter [D].
- Scope target: simple wave first (base + 3 patterns + seed), 1–2 days budget [D].
- Age visuals: puppy scale, lanky adolescent, grey muzzle for seniors [P]. Weight changes body scale [P].
- Model/animation: own models via Blockbench + GeckoLib (or equivalent), no third-party assets with restrictive licenses (`docs/25`). Style [O].

## 16. Animations and sounds
- Idle/behavior animations are weighted by state, not random (catalog and costs in `docs/23`). V1 low-cost set: sleep curled/side, circle before lying, zoomies/frenzy, head tilt (= visible voice feedback), shake off, yawn, sniff ground, chase tail (puppy). Second wave: belly-up, play bow, roll, scratch, stretch.
- Sounds: own coherent voice set (S/M/L) with per-dog pitch; catalog in `docs/10`; same processing chain for all; style decided by listening tests [D]. Subtitles via the game's subtitle system [P].

## 17. Cat (V2) — summary of `docs/21`
No combat, no training, independent. Affection instead of bond; grows on its terms (don't chase, offer fish, stand still). Crepuscular, many short naps, warmth seeking (furnaces, fireplaces, wool, sun), high places ≤ ~2 blocks first wave, sleep on bed after the player, slow-blink reciprocity, gifts, kneading, grooming, scratching post. Cats among themselves: wary period 3–10 days, may fight or not by temperament, puppies/kittens never fought, resources per cat reduce conflict, fights never lethal. Cat–dog coexistence by childhood socialization [D]. Shared core with dog (genes, coat, stages, energy, mood, health, reproduction). Litter box cut [D].

## 18. Notebook, items, blocks
- **Notebook**: item with name, age, parents, qualitative descriptors (no numbers). Each line appears only after the trait has been observed or bond reaches a threshold; starts nearly blank [D/P].
- V1 items/blocks [P]: bowl (food/milk), bed, treat, whistle, work harness (mode switch), wolf armor (vanilla) + later dog-specific enchantments (scent range, quiet paws, loyalty, thick coat), bandage, toys (ball/bone), notebook, dummy for attack training. Crafting/progression [O].
- Work harness: tells the dog "this is work", focus mode, reduces mischief.

## 19. Commands and UI
- Cues (voice/chat/key) plus UI always available. Voice is never the only input [D].
- Pet selection when several: by saying the dog's name cue first, by crosshair, or radial list [P].
- Mark target: look at an entity + cue/key (D-Dog-style marking, glow outline) [P].
- Voice: push-to-talk default; continuous listening optional; if spike S1 passes, voice enabled by default in config [D]. Dog responds only within its hearing range (whistle extends it) [D]. Audio stays local; only features of learned cues are stored per dog; raw audio is not saved [P].
- Multiplayer-ready message design: every command carries speaker id.

## 20. First playable slice (V1 target, proposal)
Judgment (layer 0) + individual (genome, needs, mood, bond, notebook) + name/sit/down/stay/come/follow trained via cues (chat/key first, voice when ready) + wild adult conquest + orphan den scene + bed/bowl/treat/harness + sleep ladder and gating + persistence with catch-up. Combat skills, tracking, pack, illness, cat come after.

## 21. Multiplayer prep (V3) — see `docs/22`
Bond per person; owner / co-guardian / acquaintance / stranger; cue words per person but skills per dog; anti-theft rules (no bond → no obedience; owner-only transfer/bed changes; temporary guardianship when owner is long absent; dogs never attack players). Build today: server authoritative, bond stored as map keyed by player id, commands carry speaker id.

## 22. Non-functional
- Performance: per-pet budget and max active pets [T]; AI thinks at intervals; no per-tick scans.
- Compatibility: other mods that replace wolves are incompatible by design; document.
- i18n: pt-BR and en from day one. Accessibility: subtitles; every voice feature has a non-voice path.
- Privacy/security: mic opt-in, local processing, no network; debug tools only in dev instances.
- Licensing: own assets or permissively licensed with a provenance ledger (`ASSETS.md`); AI-use disclosure per platform rules (`docs/26`); code license decided: GPL-3.0-or-later (derivatives must stay free); original assets proposed CC BY-SA 4.0 [P].
- Debug/QA: dev-only commands (spawn with genome, set age/needs, dump record, time warp, force events) and an event journal.

## 23. Invariants
See `CLAUDE.md` §6. Any change needs the human.

## 24. Open decisions (priority order, with recommendation)
1. Target Minecraft version / loader / JDK / GeckoLib support — recommend latest stable 26.x + Fabric if tooling supports it (V0-S0).
2. Mod id and public name; public release timing (license is decided: GPL-3.0-or-later).
3. Entity strategy (custom entity) — confirm via S3/S6.
4. Art style (blocky-improved vs realistic) and sound style (listening tests).
5. Year length (10 days), stage boundaries, sleep gating radius/percent, rescue windows by difficulty.
6. Cat/skeleton-dog details; vice list for V1 (recommend: stubbornness, livestock chasing, hole-digging, zoomies; dog-fights/bites later).
7. Dimension-follow rule; crafting/progression; den worldgen.
8. Leader nomination rules (V1 late): human nominates with legitimacy/tolerance, pack can override only on big merit gap.
