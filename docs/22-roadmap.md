# Roadmap por versão

| Versão | Escopo |
|---|---|
| v0 | Ferramentas e spikes de risco (voz, texturas procedurais, entidade/modelo, persistência, viagem fora da simulação, IA, sono, rede, escavar). Ver `docs/spec/V0-SPIKES.md`. |
| v1 | Cão, singleplayer. Camadas 0 a 5 em ordem: juízo, indivíduo, saúde, habilidades, selvagem -> doméstico, alcateia. Começar pelo mínimo do primeiro dia. |
| v1.5 | Voz por exemplo (depois do teste isolado), habilitada por padrão se validada. Comandos por UI sempre. |
| v2 | Gato (primeira leva, ver 21). |
| v3 | Multiplayer. |

## v3: multiplayer (ideia do autor)
| Tema | Decisão a tomar na v3 |
|---|---|
| Dono | Um dono principal? Outros jogadores podem treinar, mandar e ser reconhecidos? |
| Vínculo | Por jogador: o cão pode amar um e só tolerar outro |
| Voz | O cão aprende o som de cada jogador? Vozes diferentes com a mesma palavra |
| Dormir | A regra de cães dormindo se soma à de jogadores dormindo (o jogo já tem uma porcentagem) |
| Cão e amigos | Nunca ataca jogador; só ataca quem o dono marcar (o problema original do autor) |
| Liderança | Quem nomeia o líder: o dono principal? |
| Sincronia | Servidor decide tudo; cliente só desenha; genes + seed chegam iguais a todos |

## v3: vínculo, comando e roubo (decisões do autor, desenho)
Vínculo por jogador. Cenários: jogar com esposa, namorada, amigos.
| Posição | Vínculo máximo | Pode |
|---|---|---|
| Dono | 100% | Tudo: mudar casa e cama, nomear líder, entregar o cão, aprovar quem entra |
| Co-guardião (apresentado) | Alto, abaixo do dono (ex.: ~80%) | Comandar, alimentar, treinar, passear |
| Conhecido | Baixo a médio | Carinho e comida |
| Estranho | Quase zero | O cão desconfia: rosna, se afasta |
- Vínculo de não-dono só sobe com o dono por perto. O dono apresenta e revoga explicitamente.
- Obediência = palavra aprendida x vínculo de quem falou x humor. O nome chama a atenção de qualquer um; a obediência vem do vínculo.
- Comandos conflitantes: vence o de maior vínculo; o dono desempata.
- Voz: o cliente reconhece e manda a intenção junto com quem falou; o servidor aplica o vínculo daquela pessoa.
- Anti-roubo: (1) sem vínculo, sem comando (mesmo sabendo nome e palavra); (2) comida longe do dono dá só tolerância (teto baixo); (3) coleira/guia e cama ligadas ao dono; (4) transferir é ato do dono, nunca consequência de comandos; (5) o cão nunca ataca jogadores, só o alvo marcado pelo dono (defender o dono de outro jogador = configuração, desligada por padrão).
- Decidido: dono ausente por muito tempo -> tutela temporária ao co-guardião de maior vínculo (ele passa a mandar). Não muda a posse: quando o dono volta, retoma. Transferência definitiva continua só por ato do dono.
- A definir: quanto tempo de ausência dispara a tutela (em dias do mundo ou tempo real do servidor).
- Decidido: palavras por pessoa, habilidades por cão. A habilidade (maestria, nível) pertence ao cão; a palavra pertence à pessoa. Co-guardião novo não ensina do zero: cria um registro das palavras dele para as habilidades que o cão já sabe, com 1 a 3 repetições (menos com vínculo alto e cão inteligente).
  - Só registra o que o cão já aprendeu; habilidade nova exige o treino completo.
  - Exige vínculo mínimo e o dono por perto (anti-roubo).
  - O nome é do cão: todos usam o mesmo.
  - O dono apaga o registro de alguém ao revogar.

## Cuidados baratos agora (para a v3 não ser reescrita)
1. Decisões no servidor, desenho no cliente: IA, saúde, herança e idade rodam no servidor mesmo em singleplayer. Só microfone e desenho no cliente.
2. Vínculo guardado por jogador desde o começo (uma lista, que na v1 tem um só nome).
3. Voz como "intenção": o cliente reconhece o som e manda um comando ao servidor.
4. Genes + seed como única fonte de verdade da aparência.
5. Contador de dias do mundo como relógio (funciona igual em multiplayer).
6. Núcleo genérico para cão e gato (ver 21).
