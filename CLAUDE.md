# CLAUDE.md — Smart Pets Mod

Mod de Minecraft Java que dá a cães (v1) e gatos (v2) juízo, personalidade, genética, treino e vínculo. Singleplayer primeiro; multiplayer na v3. Visão e decisões: `README.md` e `docs/`.

Este arquivo é a cola do projeto. Vale para qualquer agente e qualquer modelo. Os papéis estão em `agents/`. Nomes de modelos só existem em `agents/modelos.md`.

## 1. Estado e portão (leia primeiro)
- Fase atual: especificação consolidada em rascunho (`docs/spec/SPEC.md`). NÃO existe código de produto.
- Portão: nenhum código de produto antes de (a) spec aprovada pelo humano e (b) plano aprovado pelo humano. Antes disso só documentação.
- Exceção controlada: os spikes da V0 (`docs/spec/V0-SPIKES.md`) provam ferramentas e riscos; o código deles é descartável salvo se o ADR disser que "gradua". Cada spike termina em um ADR em `docs/adr/`.
- Pendências que bloqueiam o scaffold: versão-alvo do Minecraft (provável 26.x, sem ofuscação), loader (provável Fabric), JDK exigido pela versão, launcher de desenvolvimento. Não assumir: perguntar.
- Comandos de build e teste: A DEFINIR no scaffold. Registrar aqui quando existirem. Não inventar comandos.

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
- QA (`agents/agent-qa.md`): verifica comportamento no jogo com as ferramentas de teste e devolve evidências ao Revisor.
Rejeição volta ao executor. Limite: 3 ciclos por tarefa; depois escalar ao Arquiteto e ao humano.

## 4. FAZER
- Fixar versão, loader e dependências ANTES de qualquer código. Registrar no repositório.
- Ler o projeto e seguir suas convenções antes de editar.
- Compilar após cada mudança. Erro de compilação nunca é "detalhe".
- Verificar APIs em fonte real (código-fonte mapeado da versão, docs oficiais Fabric/NeoForge, ferramentas de consulta). Nunca confiar na memória do modelo para nomes de classes, mappings ou registros.
- Escrever os testes antes da implementação. Lógica pura (genes, herança, maestria, energia, idade, vínculo) é testada SEM abrir o Minecraft.
- Uma funcionalidade pequena por vez. A menor fatia que prove a ideia.
- Escrever contrato onde estado cruza fronteiras (cliente/servidor, voz->comando, salvamento): dono, unidades, ciclo de vida, formato.
- Servidor decide, cliente desenha. Regras rodam no servidor mesmo em singleplayer. Só microfone e render no cliente. (Prepara o multiplayer.)
- Verificar no jogo com oráculos (screenshot, GameTest, logs). Evidência vence opinião.
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

## 11. Publicação e IA
O projeto usa IA. Plataformas exigem divulgação e contribuição humana significativa (design, direção, testes de jogo, ajuste). Manter o diário de decisões. Ver `docs/26`.

## 12. Idioma
Specs, ADRs, código, identificadores, commits e logs em inglês (para os agentes). `docs/01`–`docs/26` ficam em português como histórico de design. Textos do jogo em arquivos de idioma (pt-BR e en).
Arquivos de apoio: `MODLOG.md` (diário de evidências) e `ASSETS.md` (origem e licença de todo asset).
