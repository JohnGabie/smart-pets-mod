# Modelos, texturas e animações existentes (pesquisa)

Curiosidade do autor. Objetivo: achar modelos melhorados de cão/gato (ou texturas) e animações dos nossos comandos, de preferência open source. Pago só se for muito bom. Esqueletos 3D podem ser reescritos pela IA, então não vale vasculhar lojas de motores.
Nada foi baixado nem visto em jogo: licenças e funções vêm das páginas dos projetos. Qualidade visual NÃO avaliada.

## Ferramentas (base para criarmos o nosso)
| Item | Licença | Nota |
|---|---|---|
| GeckoLib (bernie-g/geckolib) | MIT | Motor de animação por keyframes (Fabric/Forge/NeoForge): easings, sons/partículas/eventos em keyframes, animações simultâneas. Padrão da comunidade |
| Blockbench | Livre (app) | Modelagem, textura e animação |
| sosadly/blockbench-mcp | MIT | MCP que deixa o Claude modelar, texturizar, riggar (quadrúpede), gerar ciclos de animação e exportar em formato GeckoLib, com preview/screenshot. 70 ferramentas. Instalação: plugin no Blockbench + Node |

## Mods/packs relevantes
| Projeto | Licença | O que tem | Reutilizável? |
|---|---|---|---|
| Doggy Talents Next | LGPL-3.0 | IA refinada (penhasco, lava, água), níveis, talentos, camas, novos modelos e animações; pack "Palette of Paws" com variantes por bioma. Fabric/NeoForge | Código e arte sob LGPL (cond.); melhor como REFERÊNCIA de design (é concorrente direto) |
| Cozy's Improved Wolves | LGPL-3.0-or-later | Personalidade (Hunter/Gatherer), vínculo, coleira que revive. Substitui o lobo | Referência de design |
| Let Sleeping Dogs Lie (iChun) | LGPL-3.0 | Cão sentado deita e dorme em poses aleatórias se o dono está longe. Cliente | Referência para poses de deitar. Incompatível com mods que refazem lobos |
| Better Animations Collection | MPL-2.0 | Packs EMF: "Playful Doggy" (rabo que abana, lobo deita em vez de sentar, rola com carne na mão), "Curly Cat Tail" (rabo do gato enrola ao sentar). Fabric | MPL é copyleft por arquivo; melhor como referência |
| Enhanced Cats | ARR (todos os direitos reservados) | Gato: alongar, amassar (biscuits), arranhar tronco, respiração, pose de "pão" (loaf). Requer GeckoLib | NÃO reutilizar; só referência |
| Timber Wolves | ARR | Lobos GeckoLib: sentar, ficar, vagar, dormir, uivar, combate. NeoForge 1.21.1 | NÃO reutilizar |
| Better Dogs (resource pack) | ARR, "não subir em outro lugar" | 41 raças, 130+ texturas | NÃO reutilizar (precisa de permissão do autor) |
| Mo'Dogs | ? (página bloqueou a consulta, 403) | 50 raças, GeckoLib, separado dos lobos vanilla | Verificar licença antes de qualquer coisa |
| More Mob Variants | ? | Variantes de lobo por bioma/raças | Verificar |
| 3D Running Dog PSX (itch.io) | CC0 | Cão low-poly com animação de correr (.blend/.fbx) | Não é estilo bloco; uso limitado |

## Conclusões
1. Não achei nenhum pacote de animações de cão/gato aberto e pronto, com sentar/deitar/ficar/dormir/rolar/inclinar cabeça, que possamos simplesmente importar. Os bons são ARR; os abertos (LGPL/MPL) têm copyleft ou são mods inteiros.
2. Os poucos achados abertos servem melhor como REFERÊNCIA de pose e de design.
3. Caminho recomendado: modelo e animações próprios com GeckoLib + Blockbench (+ blockbench-mcp), tendo as animações do doc 23 como lista de produção. Isso evita problema de licença, dá o estilo coerente que o autor pediu (ver 10) e é o que o Claude faz bem.
4. Para pelagem, o algoritmo de camadas do doc 11 cobre; pack de texturas pronto (Better Dogs) é ARR.
5. Se o autor quiser comprar: a decisão só vale depois de VER o resultado em jogo e checar a licença de uso comercial/redistribuição. Pergunta aberta: quer redistribuir o mod publicamente (afeta licenças)?

## Em aberto
- Aval do autor para o caminho 3.
- Estilo visual: bloco vanilla melhorado, ou mais realista (ver doc 10).
- Redistribuição pública do mod ou uso pessoal.
- Verificar licença de Mo'Dogs e More Mob Variants.

## Fontes
- https://github.com/bernie-g/geckolib
- https://github.com/sosadly/blockbench-mcp
- https://modrinth.com/mod/enhanced-cats
- https://modrinth.com/project/N4PW8UQo
- https://www.curseforge.com/minecraft/mc-mods/timber-wolves
- https://www.curseforge.com/minecraft/texture-packs/better-dogs
- https://www.curseforge.com/minecraft/mc-mods/let-sleeping-dogs-lie-for-fabric
- https://github.com/iChun/LetSleepingDogsLie
- https://github.com/DashieDev/DoggyTalentsNext
- https://www.modpackindex.com/mod/13413/better-animations-collection
- https://www.modpackindex.com/mod/53615/modogs
- https://petrov-the-blind.itch.io/3d-running-dog-low-res-psx
