# Como modders usam Claude para modar (pesquisa, 2026)

Escopo pedido: só 2026, de preferência os últimos meses; reverse engineering, boas práticas, ferramentas e o boom de mashups (Minecraft em GTA V, Skyrim, Elden Ring). Pesquisa feita em 17/10/2026. Fontes são páginas públicas; nada foi instalado ou testado por mim. Parte da imprensa é opinião.

## 1. O boom (set-out/2026)
- Mashups feitos com Claude: Minecraft dentro de GTA V (story mode), Skyrim, Elden Ring (~1.600 itens do Minecraft, creepers como inimigos), Black Ops 2 dentro do Minecraft etc.
- Catalisador: plugin open source "universal-modder" (Rehan Sheikh, MIT, v0.2.0, publicado 01/10/2026) e o repositório REA ("Reverse Engineer Anything"), que foi de <10 mil para >100 mil estrelas entre 06 e 11/10/2026.
- REA não decompila nada sozinho: liga agentes (Claude Code, Codex) a Ghidra/IDA via MCP.
- Reação: publicadoras já mandam takedown/cease-and-desist (Activision, Bethesda). Crítica (Kotaku, 02/10/2026): mashups sem design integrado, cheios de bug, feitos para clipe viral; mod bom redesenha mecânica de verdade.

## 2. Método do universal-modder (10 passos)
1. Buscar base de conhecimento/prior art. 2. Reconhecimento e escolha da rota. 3. Laboratório seguro com backup. 4. Análise de código. 5. Protótipo funcional. 6. Assets (API fal ou ComfyUI local). 7. Verificação no jogo. 8. Gravação. 9. Empacotamento. 10. Contribuir "field notes".
- Ferramentas: ILSpy, Cpp2IL, Vineflower, Ghidra/IDA (MCP), Cheat Engine, Frida, RenderDoc; screenshot/gravação do Windows, automação de input, limpeza de crash reporter.
- Regras duras: nada de jogo online/anti-cheat (EAC, BattlEye, VAC...), nada de redistribuir arquivos do jogo nem código decompilado, backup de saves, input "process-safe".
- Dicas para iniciantes: escolher jogo com mod loader maduro (Minecraft, Terraria, Stardew); pedir UMA funcionalidade pequena por vez; não mexer no computador durante teste automatizado (coordenadas).

## 3. Rotas de mashup (skill mashup-mods)
1. Port de conteúdo (reimplementar o comportamento na API do host): mais barato e robusto. 2. Passthrough (dois jogos lado a lado trocando estado por IPC/WebSocket). 3. Decomp-as-library. 4. Reimplementar tudo. 5. Lógica headless do convidado.
Lições que valem para nós:
- Escolher a rota, achar projetos anteriores e escrever um CONTRATO onde o estado cruza sistemas (dono, unidades, ciclo de vida, protocolo). Fazer a menor fatia que prove a rota.
- Projetos falham por DERIVA (perder o rumo), não por falta de código. Use "oráculos" scriptáveis (screenshot, benchmark headless, testes sintéticos) e um diário de evidências (MODLOG.md).
- Simulação como fonte da verdade; espelhar só o que o jogador toca.
- Ser transparente sobre autoria por IA e sobre o nível real de verificação (README x teste rodado).

## 4. Lições técnicas do caso Minecraft-em-GTA V (Fabric, MC 26.3)
- Versões fixadas: Fabric Loader 0.19.5, Fabric API 0.161.0+26.3, JDK 25 (Temurin), Gradle 9.7.1, Loom 1.18.3.
- Bugs encontrados: leitura de buffer GL deixava GL_NONE (mixin para restaurar); `ServerPlayConnectionEvents.JOIN` dispara antes do jogador estar na lista (atrasar ~10 ticks); `onGround` não atualiza com noPhysics; MC 26.3 reseta a flag Invisible no primeiro sync de rede (usar efeito de invisibilidade); entidades invisíveis ainda levam dano (cancelar em mixin).
- Método: construir hosts FALSOS e geometria sintética antes do jogo real; cenas de medição; tomadas roteirizadas e repetíveis.
- Armadilhas de ambiente: Prism Launcher (escrever instance.cfg antes do rescan), BOM UTF-8 do PowerShell em JSON, `.gitattributes` com LF, JDK portátil por instância.
- Divisão de trabalho: humano clica UI, controla timing de teclado, segurança de conta (nada de modo online) e revisa gravações; o agente faz scripts, build e depuração.

## 5. Reverse engineering com Claude + Ghidra (MCP)
- Funciona bem: reconhecer padrões (registradores, load-decrement-store), localizar a lógica e o patch exato.
- Falha: rebase de memória, identificar o jogo (errou com confiança), escrever binário, cadeia longa (Claude -> MCP -> extensão -> Ghidra = 4 pontos de falha), chamadas de ~30 s.
- Regra: confiança do modelo != acerto; use a IA para padrões/estrutura, mantenha controle manual no que exige acesso ao sistema, itere rápido.
- Para NÓS isso quase não se aplica: Minecraft Java tem fontes mapeadas, não precisamos de Ghidra.

## 6. Específico de Minecraft (o que usar)
- Minecraft 26.1+ NÃO é ofuscado (primeira versão assim). Yarn deixou de ser suportado; usa nomes Mojang. Plugin Loom novo: `net.fabricmc.fabric-loom` (26.1+) e `fabric-loom-remap` (<=1.21.11). Mods de 1.21.11 ou antes precisam, no mínimo, de recompilação.
- Requisitos: 26.1 = Java 25, Loom 1.15, Gradle 9.4.0, IntelliJ 2025.3+. 26.3 (Fabric, 15/09/2026) = Loom 1.17, Gradle 9.6.0, Loader 0.19.5. Fabric API renomeou coisas para nomes Mojang (ex.: ItemGroupEvents -> CreativeModeTabEvents). 26.3 trocou GLFW por SDL na entrada e moveu combustível/composto para componentes.
- Skills e MCPs para Claude: chouzz/minecraft-mod-dev (skill; busca docs oficiais NeoForge/Fabric de forma dinâmica; foco em Data Components, Data Generation e tags), mcmodding-mcp (MCP que indexa docs oficiais toda semana), mcdev-mcp + DebugBridge (ver doc 24), blockbench-mcp (ver doc 25).
- Prática recomendada nas fontes: dar ao Claude uma tarefa de engenharia bem definida (versão do Minecraft, loader, comportamento), deixá-lo inspecionar o projeto, implementar, BUILDAR e testar no jogo; lógica de gameplay determinística; sempre compilar e testar.
- Modelos sabem Java, mas não necessariamente as APIs/mappings da versão exata: dar documentação e código-fonte da versão (por isso mcdev-mcp/skills).

## 7. Regras de publicação (Modrinth, desde 13/08/2026)
- Projeto feito inteira ou quase inteiramente por IA, com pouco além de prompt e teste, NÃO pode ser público (pode ficar não listado).
- Marcar "Contém conteúdo gerado por IA" se houver código substancial por IA, assets substancialmente por IA, funcionalidade dependente de IA generativa ou página escrita com IA. Teste: "se fosse um humano, esperaria crédito?". Revisão de código e correção de gramática não exigem.
- Imagens geradas por IA proibidas (ícone, banner, galeria, descrição, screenshots). Divulgar não prejudica busca nem receita.
- CurseForge: exige aviso em imagens de showcase editadas por IA que possam enganar; menos restritivo no código.
- Implicação: o design do mod (sistemas, regras, personalidade, balanceamento) é SEU e é "contribuição humana significativa"; mantenha o diário de decisões (estes docs) e teste/ajuste você mesmo. Não usar imagens de IA na página.

## 8. O que isso muda no nosso plano
1. Fixar versão-alvo agora: 26.x (Java 25, sem ofuscação, Mojang names) em vez de 1.21.11. Atenção: DebugBridge (doc 24) listava 26.1 e 26.2; verificar se já cobre 26.3 e qual versão estável escolher (Fabric tem 26.1, 26.2, 26.3).
2. Antes do código: escrever o CONTRATO (estado cliente/servidor, mensagens de voz, genes) e a menor fatia jogável (primeiro dia).
3. Montar OS ORÁCULOS desde o início: GameTest do Fabric (screenshots, headless), DebugBridge para ver o jogo, testes unitários da lógica de genes/herança/maestria (puros, sem Minecraft), teste isolado da voz (doc 08).
4. Diário de evidências (MODLOG.md) e versões fixadas no repositório.
5. Uma funcionalidade por vez; começar pela camada 0 (juízo).
6. Depender de docs/fonte reais (mcdev-mcp, mcmodding-mcp), nunca da memória do modelo para APIs.
7. Não copiar assets/código de outros mods (ver doc 25). Aprender com mashups: o valor está em DESIGN integrado, que é o que já temos.
8. Preparar a divulgação de IA para a publicação.

## Fontes
- https://github.com/rehan-remade/universal-modder
- https://github.com/rehan-remade/universal-modder/blob/main/skills/mashup-mods/SKILL.md
- https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/gta-v/minecraft-passthrough.md
- https://vgtimes.com/guides/169605-how-to-mod-almost-any-game-with-claude-code.html
- https://egamers.io/ai-reverse-engineering-tool-rea-explodes-on-github-as-modders-port-gta-v-to-iphone-and-clone-adobes-suite/
- https://kotaku.com/i-dont-want-to-play-your-ai-generated-mod-that-puts-skate-3-inside-of-modern-warfare-2-inside-of-minecraft-2000738660
- https://decrypt.co/380407/ai-video-game-mod-mashups-are-taking-off-here-are-the-wackiest-examples
- https://www.tweaktown.com/news/113855/minecraft-runs-inside-elden-ring-as-modders-mash-up-entire-games/index.html
- https://quesma.com/blog/ghidra-mcp-unlimited-lives/
- https://github.com/chouzz/minecraft-mod-dev
- https://mcpmarket.com/server/mc-modding (repo: https://github.com/ogmatrix/mcmodding-mcp)
- https://support.modrinth.com/en/articles/16551575-disclosure-and-usage-of-ai
- https://fabricmc.net/2026/09/15/263.html
- https://fabricmc.net/2026/03/14/261.html
- https://paperchunk.com/blog/fabric-26-1-biggest-overhaul
- https://github.com/maequ/CraftV
