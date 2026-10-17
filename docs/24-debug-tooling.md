# Ferramentas de depuração para o Claude (pesquisa)

Objetivo do autor: um MCP (ou equivalente) para o Claude investigar bugs, depurar, tirar prints/vídeos e ver além dos logs do jogo; não precisa jogar. Nada abaixo foi instalado ou testado: tudo vem das páginas dos projetos.

## Recomendado: mcdev-mcp + DebugBridge
- mcdev-mcp (MIT, Node): estático (símbolos, código-fonte decompilado, hierarquia, grafo de chamadas) e em execução (estado do jogo, screenshot e vídeo em vários quadros, GUI, entidades/blocos, chat, destaque visual, scripts na JVM). Requer Node 18+, Java 8+ (17+ para o grafo), ~2 GB de disco por versão. `npx mcdev-mcp init -v <versão>`.
- DebugBridge (MIT, mod Fabric só cliente): WebSocket local (portas 9876-9886), scripts Groovy com acesso à JVM, interface web (porta 9976). Versões: 1.19.x, 1.21.11, 26.1, 26.2. Comandos do jogo e controle de sessão desligados por padrão; aviso de desenvolvedor na primeira execução.
- Vantagem: screenshot e vídeo vêm de dentro do jogo (sem captura de tela do sistema; evita problemas de Wayland) e leio o código real do Minecraft ao escrever o mod.
- Limites: só Fabric, só cliente, projeto novo (16 estrelas). Logs do jogo (latest.log, crash-reports) leio direto dos arquivos.

## Alternativas e complementos
| Opção | Uso | Avaliação |
|---|---|---|
| InventivetalentDev/minecraft-mcp | Mod Fabric cliente (chat, estado, controle do jogador, entidades, blocos, screenshot) + plugin Paper | Deixa o Claude "jogar" um pouco. Foca 26.1.2 (Java 25) |
| Fabric Client GameTest (oficial) | Testes automáticos com screenshots, sem janela (XVFB) e em CI | Não é MCP; roda via Gradle. Melhor para regressão. Docs lidas não cobrem simulação de entrada |
| recit e outros MCPs de captura de tela (ffmpeg) | Gravação/screenshot da tela | Não recomendado: Wayland; o jogo já dá screenshot por dentro |
| Minecraft-MCP-Server (RCON) | Comandos e logs de servidor | Só para a v3 (servidor dedicado) |
| yuniko-software/minecraft-mcp-server (Mineflayer) | Bot que entra num mundo | Automatiza gameplay, não depura o mod; útil na v3 como segundo jogador |

## Ambiente do autor (verificado)
- Ubuntu, GNOME, Wayland.
- Java 17 apenas -> precisa de JDK 21 (1.21.x) ou 25 (26.x).
- Node 20 e Gradle instalados.
- Sem ffmpeg e sem Xvfb (instalam com apt, exigem sudo).
- Sem pasta .minecraft no usuário; launcher desconhecido.

## Cuidados
- DebugBridge dá acesso total à JVM por WebSocket local: só em instância de desenvolvimento, nunca no perfil de jogo diário.
- Todos os MCPs executam código na máquina: ler o repositório antes de instalar.

## Em aberto
- Atualização (doc 26): existe Fabric para Minecraft 26.3 (set/2026). Verificar se o DebugBridge já cobre 26.3 antes de escolher a versão.
- Versão do Minecraft alvo (afeta a compatibilidade: DebugBridge cobre 1.21.11, 26.1, 26.2), launcher e JDK.
- Instalar agora ou só ao começar o código (recomendado: ao começar o código).

## Fontes
- https://github.com/weikengchen/mcdev-mcp
- https://modrinth.com/mod/debugbridge
- https://github.com/InventivetalentDev/minecraft-mcp
- https://docs.fabricmc.net/develop/automatic-testing
- https://github.com/codedbytahir/recit
- https://github.com/MinecraftCodeFoundary/Minecraft-MCP-Server
- https://github.com/yuniko-software/minecraft-mcp-server
