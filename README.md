# Smart Pets

*Dogs (and later cats) with judgment, personality, genetics and a bond that grows.*

License: GPL-3.0-or-later

> **Status: pre-alpha, design and toolchain only.** There is no playable build, no download and no installer. The repository currently holds the design, the specification, executable behavior specs and the project website. "Smart Pets" is a working title.

## What is it

The vanilla wolf is a stat block on legs. It teleports to you, follows without thinking, may attack your friends or your villagers, charges into lava, and has no individuality: every tamed wolf is the same wolf. Smart Pets is a planned Minecraft Java mod that replaces this with a companion that has judgment: it avoids danger, never attacks you or your allies, only attacks a target you marked, and can visibly refuse an order it does not understand or is too tired to follow.

Each animal is an individual. It is born with a heritable genome (temperament, senses, energy, lifespan, coat), grows through life stages, forms a bond with you through things you do together, and learns commands by being trained with cues you choose (a sound, a chat word or a key). The goal is a reason to come back to the world: a companion that is useful and has presence, not a chore loop.

## Planned features

Everything below is a design goal from [`docs/spec/SPEC.md`](docs/spec/SPEC.md), which is still a draft pending human approval. Nothing is implemented. All numbers in the design are tuning defaults, not promises.

**V1: the dog (singleplayer)**
- Judgment and safety: avoids lava, fire, cactus, deep falls, explosions and overwhelming groups; never attacks the player or allies; disengages when ordered.
- An individual per dog: genome fixed at birth, needs, mood, weight, bond, and a qualitative notebook that fills in only as you observe the dog (no stat scanner).
- Genetics and coats: inheritance with rare "rough diamond" and "genius" puppies, plus coats from alleles and a per-dog seed.
- Training by learned cues: chat text and keys/UI first; the dog learns the association between a cue and a command, with mastery levels, rust and overtraining signs.
- Voice cues, **if the V0 voice spike passes**; otherwise they move to a later release. Voice is never the only way to give a command.
- Wild dog conquest by patience (no combat) and orphan puppies found in den scenes.
- Home, sleep ladder, no teleporting (the dog follows, tracks, and can travel home over a realistic distance), life stages, energy and zoomies, injury with a rescue window that depends on difficulty.
- Persistence with catch-up after long absences.

**V2: the cat**
- Independent cats: no combat, no training. Affection instead of bond, naps, warm spots, high places, and coexistence with dogs. Shares the dog's core (genes, coats, stages, energy, mood, health).

**V3: multiplayer**
- Bond per person, owner / co-guardian / stranger roles, anti-theft rules. Dogs never attack players.

## How it works

- **Pure-Java core + loader adapter.** All rules (genome, inheritance, needs, mood, bond, training, aging, decision engine) live in a `core` module with no Minecraft imports, tested without launching the game. A thin `platform` adapter (planned target: Fabric) handles entities, rendering, networking and saving.
- **Server-authoritative.** Rules run on the server even in singleplayer; the client only captures input and draws. This prepares for multiplayer.
- **Data-driven.** Tuning numbers, trait ranges, skill trees and danger tables live in config/data, not in code.
- **Executable behavior specs.** Expected behavior is written as plain-text scenarios and decision tables in [`specs/`](specs/), used as acceptance criteria and as the test suite. Situations nobody anticipated are tracked in [`specs/UNSPECIFIED.md`](specs/UNSPECIFIED.md).

The target Minecraft version (likely 26.x), loader and Java version are not pinned yet; that happens in the toolchain phase of V0.

## Roadmap

The same data drives the project website (`site/data/status.json`).

| Phase | Scope | State |
|---|---|---|
| V0, Foundations | Prove the toolchain and the hardest unknowns (voice, procedural coats, custom entity/model/animation, persistence and travel) before building features. Design spec and behavior specs are done; toolchain and spikes are planned. | In progress |
| V1, The Dog | Singleplayer dog: judgment, needs, genetics, training by cues, wild conquest, orphan puppies, sleep and home. | Planned |
| V2, The Cat | Independent cats with affection, naps and warm spots. | Planned |
| V3, Multiplayer | Bond per person, co-guardians, anti-theft rules. | Planned |

## Project status and getting started

There is nothing to install or build yet, and no build commands exist. They will be recorded in [`CLAUDE.md`](CLAUDE.md) once the toolchain is scaffolded. No product code will be written until the specification and the plan are approved by the maintainer.

If you are curious, the best entry points are:
- [`docs/spec/SPEC.md`](docs/spec/SPEC.md): the consolidated specification.
- [`docs/spec/V0-SPIKES.md`](docs/spec/V0-SPIKES.md): the risk spikes planned before V1.
- [`specs/`](specs/): behavior scenarios and decision tables.
- [`CLAUDE.md`](CLAUDE.md): project rules and workflow (largely in Portuguese).

## Contributing

The project is developed by a human maintainer working with AI agents in defined roles:

1. **Architect**: requirements, specs, plan, tests first, task briefs.
2. **Executors**: implement one task each, on their own branch.
3. **Reviewer**: checks the diff against the spec and rules, runs build and tests, asks QA to verify.
4. **QA**: verifies behavior in the game and returns evidence.

Rules in short: one branch and one pull request per task; behavior specs are the acceptance criteria and may not be weakened to make a change pass (unforeseen cases go to `specs/UNSPECIFIED.md`); nothing is "done" without evidence; the human maintainer merges. Read [`CLAUDE.md`](CLAUDE.md) and the role descriptions in [`agents/`](agents/) before proposing changes. Issues and ideas are welcome, but there is nothing runnable to test yet.

## Documentation map

- [`docs/README.md`](docs/README.md): index of the design history (Portuguese, docs 01 to 26).
- [`docs/spec/`](docs/spec/): specification, V0 spikes, behavior-spec method, gap review.
- [`specs/`](specs/): executable behavior specs, glossary, decision tables.
- [`agents/`](agents/): role descriptions for the agent workflow.
- [`MODLOG.md`](MODLOG.md): evidence diary (what was verified and how).
- [`ASSETS.md`](ASSETS.md): provenance and license ledger for every asset.
- [`site/`](site/): the project website.

## Website

The project website lives in [`site/`](site/) and is planned to be published on GitHub Pages once the repository is public. There is no live URL yet.

## AI assistance disclosure

This project is developed with AI assistance under human direction. The design, direction, scope and testing decisions are made by the human maintainer; AI agents help write specs, documentation and code under review. Any AI-generated content will be recorded in [`ASSETS.md`](ASSETS.md), and the project intends to follow the AI-disclosure rules of any platform it is published on.

## License

Code is licensed under **GPL-3.0-or-later** (see [`LICENSE`](LICENSE)). This is strong copyleft free software: you may use, study, modify and share it, but any derivative work you distribute must also be distributed under the same terms, with source.

Planned third-party dependencies and compatibility:
- Fabric API: Apache-2.0, compatible with GPLv3.
- GeckoLib: MIT, compatible with GPLv3.

Original art, sound and text assets are **proposed** to be licensed under CC BY-SA 4.0. This is pending maintainer confirmation and is not final. Third-party assets and their licenses are tracked in [`ASSETS.md`](ASSETS.md); no asset with restrictive "all rights reserved" terms is accepted.

## Credits and inspiration

Inspirations only, with no affiliation or reuse of their material: D-Dog from *Metal Gear Solid V*, Sam from *I Am Legend*, the sled dog Togo, and research on real wolf packs.

## Disclaimer

Smart Pets is not affiliated with, endorsed by, or associated with Mojang Studios or Microsoft. Minecraft is a trademark of Mojang Studios.
