# Design history (Portuguese)

[Back to the project README](../README.md). Paths below are relative to the repository root.

# Smart Pets Mod (ideia)

Mod de Minecraft (singleplayer primeiro; multiplayer na v3) para ter um companheiro canino útil e com personalidade.
Inspirações: D-Dog (MGSV), Sam (Eu Sou a Lenda), Togo, lobos reais.

Fase atual: só ideação, sem código.

- `docs/01-vision.md` visão e pilares
- `docs/02-references.md` pesquisa das referências e o que aproveitar
- `docs/03-ideas-backlog.md` backlog solto de ideias
- `docs/04-decisions.md` decisões tomadas e desenho em camadas
- `docs/05-genetics-traits.md` genes, aprendizado, vícios, sentidos, itens
- `docs/06-home-leader-age.md` vida em casa, líder, carência, idade
- `docs/07-generations-skills.md` gerações (selvagem -> doméstico) e árvores de habilidade
- `docs/08-taming-voice.md` conquista do adulto por paciência/repetição e voz
- `docs/09-ai-behavior.md` IA: decisão por pontuação, iniciativa e posturas
- `docs/10-sounds.md` catálogo de sons por situação e timbre
- `docs/11-coats-inheritance.md` pelagem por alelos + seed (estilo CS:GO) e tipos de herança
- `docs/12-heritage-rules.md` regras de herança dos traços contínuos (diamante bruto, gênio)
- `docs/13-health.md` ferimento, doença e cuidado
- `docs/14-rare-items.md` poções raras (juventude, cão esqueleto)
- `docs/15-routine-and-mobility.md` rotina de sono, sem teletransporte, ir para casa, cavar
- `docs/16-skills-items.md` árvores de habilidade e itens
- `docs/17-pack.md` alcateia e liderança
- `docs/18-life-stages.md` fases da vida: filhote, adolescente, adulto, idoso
- `docs/19-training.md` molde de treino e método por habilidade
- `docs/20-energy-mastery.md` energia, maestria e pré-requisitos
- `docs/21-cat-v2.md` gato (v2): independente, sem combate e sem treino
- `docs/22-roadmap.md` roadmap por versão (v1, v1.5, v2 gato, v3 multiplayer)
- `docs/23-idle-animations.md` animações aleatórias do cão (v1)
- `docs/24-debug-tooling.md` pesquisa de MCPs e ferramentas para depurar o mod
- `docs/25-models-animations-research.md` modelos, texturas e animações existentes
- `docs/26-ai-modding-practices-2026.md` como modders usam Claude (2026), mashups, boas práticas, regras de publicação

## Especificação consolidada (fonte da verdade)
- `docs/spec/SPEC.md` spec consolidada (rascunho, em inglês)
- `docs/spec/GAP-REVIEW.md` revisão: contradições, lacunas e decisões pendentes
- `docs/spec/V0-SPIKES.md` V0: ferramentas e spikes de risco
- `docs/spec/BEHAVIOR-SPECS.md` specs de comportamento executáveis (framework de testes em texto)
- `specs/` cenários Gherkin, vocabulário, tabela de decisão e fila de comportamentos não especificados
- `docs/adr/` decisões de arquitetura (uma por spike)
- `MODLOG.md` diário de evidências · `ASSETS.md` origem de assets

## Agentes e regras de trabalho
- `CLAUDE.md` regras do projeto (cola de tudo): fazer, não fazer, invariantes, fluxo, git
- `agents/agent-arquitetor.md`, `agents/agent-executor.md`, `agents/agent-revisor.md`, `agents/agent-qa.md` papéis
- `agents/modelos.md` camadas de modelo (único lugar com nomes de modelos)
