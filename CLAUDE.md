# CLAUDE.md — Smart Pets Mod

Mod de Minecraft Java que dá a cães (v1) e gatos (v2) juízo, personalidade, genética, treino e vínculo. Singleplayer primeiro; multiplayer na v3. Visão e decisões: `README.md` e `docs/`.

Este arquivo é a cola do projeto. Vale para qualquer agente e qualquer modelo. Os papéis estão em `agents/`. Nomes de modelos só existem em `agents/modelos.md`.

## 1. Estado e portão (leia primeiro)
- Fase atual: especificação consolidada em rascunho (`docs/spec/SPEC.md`); V0-S0 (toolchain) feito em parte: PASS-WITH-FALLBACK: Prism, DebugBridge e `mcdev-mcp` verificados com ajuda humana em 2026-10-18; `mcmodding-mcp` não funciona; `mc_record_video`/`mc_execute` não testados; o laço de revisão da PR da Task 7 não rodou; ver `docs/spec/V0-SPIKES.md`. NÃO existe código de produto (só código de spike).
- Portão: nenhum código de produto antes de (a) spec aprovada pelo humano e (b) plano aprovado pelo humano. Antes disso só documentação.
- Exceção controlada: os spikes da V0 (`docs/spec/V0-SPIKES.md`) provam ferramentas e riscos; o código deles é descartável salvo se o ADR disser que "gradua". Cada spike termina em um ADR em `docs/adr/`.
- Stack fixada (ADR-0001, aguardando aprovação): Minecraft 26.2 (não 26.3: sem DebugBridge), Fabric Loader 0.19.5, Fabric API 0.161.0+26.2, Loom 1.18-SNAPSHOT, Gradle 9.7.1, JDK 25 (Temurin, no home do usuário via `bash scripts/dev/install-jdk25.sh`). Observação/QA: ADR-0002.
- Comandos (só os que foram rodados de verdade; não inventar outros):
  - Build e testes: `./gradlew build`, `./gradlew :core:test`.
  - Vazamento (antes de todo commit): `bash scripts/qa/leak-check.sh`. Site/README em dia: `bash scripts/qa/docs-freshness.sh`.
  - Teste no jogo headless: `bash scripts/qa/run-client-gametest.sh` (roda `env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x720x24" ./gradlew :mod:runClientGameTest`, depois `bash scripts/qa/check-screenshot.sh` na primeira PNG e exige `SMARTPETS_DEBUG_PONG` no log, vindo do comando dev `/smartpets debug ping`, ativo só com `-Dsmartpets.dev=true`, já definido na run `clientGameTest`; também checa S11: `SMARTPETS_S11_OK` e linhas `(smartpets) SMARTPETS_TIME` (saídas 6, 7, 8, 9); sem variável extra, Mesa llvmpipe; screenshot 854x480; ~2 min frio, ~20 s quente).
  - Instância de desenvolvimento: `bash scripts/dev/fetch-debugbridge.sh` (DebugBridge só em `mod/run/mods/`, git-ignored) e `env -u WAYLAND_DISPLAY xvfb-run -a ./gradlew :mod:runClient`. Instância Prism "SmartPets Dev": `PRISM_MODS_DIR=<pasta mods da instância> bash scripts/dev/install-to-prism.sh` (sem DebugBridge lá).
  - Cliente de dev ao vivo (DebugBridge, sem MCP): `bash scripts/qa/run-bridge-scenario.sh smoke-world [--repeat N --seed S]` (mundo de teste `sp-test-flat`, JSON em `mod/run/qa-runs/`), `python3 scripts/qa/bridge/bridge.py exec --lib -e 'return spInfo()'`; `bash scripts/qa/dev-client.sh start [--headless]` / `wait` / `status` / `stop` (verificado com jogo real em 2026-10-19, visível e headless). Ver `scripts/qa/bridge/README.md`.
  - Banco de evidências: `bash scripts/qa/evidence/check.sh` (valida `.evidence/data.js`) e `bash scripts/qa/evidence/open.sh` (valida e abre a página no navegador; `--example` abre os exemplos fictícios).
  - Índice de fonte decompilada: `PATH=<jdk25>/bin:$PATH JAVA_HOME=<jdk25> JAVA_TOOL_OPTIONS=-Xmx3g npx -y mcdev-mcp@2.2.1 init -v 26.2` (cache ~1 GB fora do repo).
- Ferramentas `mc_*` (verificado): os servidores de `.mcp.json` só carregam em sessões do Claude Code iniciadas dentro da pasta do repositório e pedem aprovação. `mcdev-mcp` funciona com o DebugBridge (porta 9876 em 127.0.0.1); `mcmodding` não funciona (ver `MODLOG.md`).
- Regras da instância de dev: conta offline/dev, nunca o perfil pessoal; nunca duas instâncias do jogo ao mesmo tempo; parar o jogo só por PID; a tela de consentimento do DebugBridge é clicada pelo humano, nunca contornada por agente.

## 2. Fonte da verdade (nesta ordem)
1. Specs aprovadas (`docs/spec/SPEC.md`; lacunas e decisões pendentes em `docs/spec/GAP-REVIEW.md`).
2. Documentos de decisão em `docs/` (numerados).
3. Este arquivo.
Conversas e memória do modelo NÃO são fonte. Se duas fontes conflitam, ou a spec está vaga: parar e perguntar. Não decidir sozinho.
Números nos docs (chances, tempos, limiares, capacidades) são EXEMPLOS para ajustar jogando: vão para configuração/dados, nunca fixos no código.

## 3. Papéis e fluxo
Arquiteto -> Executores -> Revisor -> QA -> Revisor -> humano.
- Arquiteto (`agents/agent-arquitetor.md`): requisitos, spec, plano, testes primeiro, briefs de tarefa.
- Executor (`agents/agent-executor.md`): implementa UMA tarefa de um brief, em branch própria. Vários em paralelo, em camadas de capacidade diferentes conforme a tarefa.
- Revisor (`agents/agent-revisor.md`): sempre na camada mais forte. Valida contra spec e regras, roda build e testes, chama o QA, dá o veredito.
- Controle de versão (`agents/agent-version-control.md`): branches, commits, PRs, backups e a defasagem do site/README. Não implementa nem revisa mérito.
- QA (`agents/agent-qa.md`): verifica comportamento no jogo com as ferramentas de teste e devolve evidências ao Revisor.
Rejeição volta ao executor. Limite: 3 ciclos por tarefa; depois escalar ao Arquiteto e ao humano.

## 4. FAZER
- Fixar versão, loader e dependências ANTES de qualquer código. Registrar no repositório.
- Ler o projeto e seguir suas convenções antes de editar.
- Compilar após cada mudança. Erro de compilação nunca é "detalhe".
- Verificar APIs em fonte real (código-fonte mapeado da versão, docs oficiais Fabric/NeoForge, ferramentas de consulta). Nunca confiar na memória do modelo para nomes de classes, mappings ou registros.
- Comportamento esperado vive em specs de texto executáveis (`specs/`, ver `docs/spec/BEHAVIOR-SPECS.md`): cenários Gherkin, tabelas de decisão e propriedades. Escrever a spec antes; executor nunca a enfraquece; o que não foi previsto vira linha em `specs/UNSPECIFIED.md`.
- Escrever os testes antes da implementação. Lógica pura (genes, herança, maestria, energia, idade, vínculo) é testada SEM abrir o Minecraft.
- Uma funcionalidade pequena por vez. A menor fatia que prove a ideia.
- Escrever contrato onde estado cruza fronteiras (cliente/servidor, voz->comando, salvamento): dono, unidades, ciclo de vida, formato.
- Servidor decide, cliente desenha. Regras rodam no servidor mesmo em singleplayer. Só microfone e render no cliente. (Prepara o multiplayer.)
- Verificar no jogo com oráculos (screenshot, GameTest, logs). Evidência vence opinião.
- Cenário no jogo: derivar da spec, procurar e reusar primeiro em `scripts/qa/bridge/scenarios/INDEX.md`, registrar novo/alterado lá com o link da spec; estável vira GameTest.
- Banco de evidências (`.evidence/`, git-ignored, só os agentes escrevem em `.evidence/data.js` como JSON estrito; a página `scripts/qa/evidence/index.html` só lê): registrar prints/vídeos de falha, correção, comportamento inesperado ou algo que o humano precisa ver, com id (EV-NNNN), nome, teste, o que estava sendo testado, entidades, descrição e mídias. É para INFORMAR o humano. Algo inesperado fora das regras e specs nunca chega de mãos vazias: tentar reproduzir (`--repeat N`, anotar k de N), conferir/registrar em `specs/UNSPECIFIED.md` e, se precisar de decisão, trazer 2-3 opções com recomendação. Invariantes de design (§6) nunca são decididas pelo agente. Sem gravações de voz. Ao retomar com o humano, mostrar os itens novos (`bash scripts/qa/evidence/open.sh`). Formato: `scripts/qa/evidence/README.md`.
- Registrar no diário (`MODLOG.md`): versão que funcionou, rota, o que foi verificado e como, e armadilhas (sintoma -> causa -> correção).
- Dizer o status REAL: o que foi rodado, o que não foi, o que falhou.
- Dados persistentes com versão de esquema e migração (um cão vive muito tempo e carrega genes).

## 5. NÃO FAZER
- Inventar APIs, classes ou comandos. Se não achou na fonte, dizer que não achou.
- Copiar código, modelos, texturas ou sons de outros mods sem licença que permita (ver `docs/25`). "Todos os direitos reservados" = proibido.
- Colocar arquivos do jogo ou código decompilado no repositório.
- Usar ferramentas de depuração (acesso à JVM, scripts) fora de uma instância de desenvolvimento descartável. Nunca no perfil de jogo pessoal nem com conta online.
- Mexer em saves reais sem backup. Matar processos por nome (só por PID). Operar mouse/teclado do humano sem pedir.
- Guardar chaves, tokens ou dados pessoais no repositório, em docs ou em commits. Segredos só por variável de ambiente.
- Entregar trecho isolado fora da estrutura do projeto.
- Misturar tarefas: um PR, uma tarefa, um objetivo.
- Aprovar ou mesclar o próprio trabalho.
- Imagens geradas por IA na página do mod, ícone ou galeria.
- Esconder falha, pular teste ou marcar "pronto" sem evidência.

## 6. Invariantes de design (não violar sem decisão do humano)
- Sem teletransporte do cão. Mobilidade por seguir, olfato, "ir para casa" (alcance realista).
- O cão nunca ataca jogador nem aliado e só ataca o alvo marcado. Comportamento de risco tem aviso antes.
- Voz nunca é a única entrada: tudo também por tecla/UI. Voz, tecla e chat viram o mesmo comando interno.
- Genes não mudam depois do nascimento; treino muda comportamento, não genes. Genética pouco visível: sem scanner, só ficha qualitativa que se preenche.
- Morte permanente conforme a dificuldade do mundo (ver `docs/13`). Brigas entre animais nunca matam.
- Nada de tarefa chata: cuidado cotidiano é prevenção, não rotina.
- Reprodução segue o jogo original (sem cio/gestação), com idade mínima/máxima e intervalo longo entre ninhadas.
- Idade = dia do mundo atual - dia de nascimento. Sem relógio próprio.
- Núcleo genérico para cão e gato (genes, pelagem, fases, energia, humor, saúde, reprodução).
- Habilidade pertence ao cão; palavra/vínculo pertencem à pessoa (multiplayer).

## 7. Git e PRs
- Nunca commitar direto na branch principal. Uma branch por tarefa: `tipo/curto` (ex.: `feat/energia`).
- Commits pequenos, mensagem clara. Sem push forçado, sem apagar histórico, sem apagar branch alheia.
- Executor abre o PR e descreve: tarefa, o que mudou, como foi verificado, o que NÃO foi verificado.
- Revisor revisa, aprova ou pede mudanças. Merge só depois de Revisor OK + QA OK, e o humano faz o merge (padrão). Se todos usam a mesma conta do GitHub, aprovação formal pode ser impossível: usar rótulos e comentário de veredito.
- Ativar as proteções locais uma vez por clone: `git config core.hooksPath scripts/dev/git-hooks` (bloqueia push direto em `main` e force push). Backups verificados: `bash scripts/dev/backup-repo.sh`; saúde: `bash scripts/dev/branch-health.sh` (ver `agents/agent-version-control.md`).
- Executores em paralelo usam worktrees/branches separados e donos de arquivo distintos. Dois executores nunca editam o mesmo arquivo.

## 8. Definição de pronto
Pronto = build passa + testes do brief passam + critérios de aceite verificados com evidência + nenhuma violação de invariante + nenhuma API não verificada + licenças/origem de assets limpas + diário atualizado + Revisor OK + QA OK. O que depende de gosto (se é "fofo", como soa, se é divertido) é decisão do humano: o QA marca "precisa de playtest humano".

## 9. O humano decide
Estilo visual e sonoro, números de balanceamento, mudança de escopo, publicação, merge, qualquer item da seção 6, qualquer ação irreversível ou que saia da máquina (publicar, enviar, apagar).

## 10. Contexto e handoffs
- Cada agente recebe um brief curto e os caminhos dos arquivos relevantes, NÃO o histórico de conversa.
- O Revisor avalia o diff e a spec ANTES de ler a justificativa do executor (evita viés).
- Nenhum arquivo do repositório contém dados pessoais, caminhos absolutos da máquina de alguém, e-mails, nomes reais ou segredos. Usar caminhos relativos.
- Quem encontra algo fora do escopo registra no diário e avisa o Arquiteto; não corrige por conta própria.

## 11. Licença, publicação e IA
Licença decidida pelo humano: software livre, e quem usar o código deve mantê-lo livre: código sob GPL-3.0-or-later (copyleft forte); assets originais propostos sob CC BY-SA 4.0 (a confirmar). Dependências devem ser compatíveis com GPLv3 (registrar em `ASSETS.md`/ADR).
O projeto usa IA. Plataformas exigem divulgação e contribuição humana significativa (design, direção, testes de jogo, ajuste). Manter o diário de decisões. Ver `docs/26`.

## 12. Idioma
Specs, ADRs, código, identificadores, commits e logs em inglês (para os agentes). `docs/01`–`docs/26` ficam em português como histórico de design. Textos do jogo em arquivos de idioma (pt-BR e en).
Arquivos de apoio: `MODLOG.md` (diário de evidências) e `ASSETS.md` (origem e licença de todo asset).

## 13. Site, README e status sempre atualizados
- Fonte única do estado público: `site/data/status.json` (fases, itens, data). O README (tabela de roadmap) e o site derivam dele.
- Gatilhos de atualização: (a) fase ou spike muda de estado; (b) um ADR é mesclado; (c) comportamento visível ao jogador entra; (d) tag/release; (e) no máximo a cada 14 dias, mesmo sem mudança (revisar e atualizar `updated`).
- Checklist: `status.json` + tabela de roadmap do README + aba Developers (se a spec mudou) + demos conceituais coerentes com a spec + trocar demos conceituais por capturas reais (rotuladas) quando o jogo rodar + `ASSETS.md` para qualquer asset novo.
- Quem: o Arquiteto atualiza; o agente de controle de versão verifica toda semana com `bash scripts/qa/docs-freshness.sh` e avisa; o Revisor reprova PR que muda fase/spike/ADR sem atualizar (item no modelo de PR).
- Honestidade: nunca prometer o que não existe; demos rotulados "conceito"; sem datas de lançamento inventadas.

## 14. Diário de contexto antes de compactar
- Antes de QUALQUER compactação (manual ou automática) o agente escreve um diário de memória do contexto em `.journal/AAAA-MM-DD-HHMMSS-<motivo>.md` (git-ignored): gerar o esqueleto com `bash scripts/dev/journal-skeleton.sh <motivo>`, preencher TODAS as seções (objetivo; decisões e porquês, inclusive opções rejeitadas; preferências e correções do humano, literais quando possível; feito e verificado com evidência; em andamento com ids de agentes/tarefas/PRs; próximos passos em ordem; perguntas abertas; armadilhas e comandos que funcionaram ou falharam; arquivos para reler; o que NÃO refazer; o que promover) e apagar os marcadores `<!-- TODO-CONTEXT -->`.
- Proativo: ao perceber contexto grande ou antes de sugerir `/compact`, escrever o diário primeiro.
- Aplicação mecânica: `.claude/settings.json` registra o hook PreCompact (bloqueia `/compact` manual enquanto houver marcadores; a automática nunca é bloqueada, só ganha esqueleto com fatos automáticos) e o hook SessionStart (compact/resume) que reinjeta o último diário.
- Depois: o que for durável é promovido a MODLOG/ADR/specs; o diário é rascunho local, não fonte da verdade. Nunca colocar segredos nele. O backup inclui `.journal/`.
- Estado de verificação: os scripts foram testados com entrada simulada; o comportamento dentro do Claude Code numa compactação real ainda não foi observado (registrar em `MODLOG.md` na primeira vez).
