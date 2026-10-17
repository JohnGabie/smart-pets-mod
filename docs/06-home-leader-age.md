# Casa, líder, carência, idade

## Vida em casa
- Pote de comida e cama = âncoras do território. Ele come, dorme, brinca, tem emoções e hábitos ali.
- Guia/coleira de trabalho = troca de modo (casa x trabalho). O cão entende que não é mais brincadeira. Em trabalho: foco, obediência maior, vícios menores.
- Item sem status: existe só por presença/gesto.
- Armaduras base do jogo, com encantamentos, e algumas específicas para cães (modificadores).
- Habilidades raríssimas (várias, sem prazo). Ideia 1: segurar espada, com proficiência que cresce.

## Líder influencia o grupo
- O líder é um canal de treino social: seus traços puxam os dos outros.
- Líder mediano mas leal e autoritário mantém ordem e reduz vícios dos outros.
- Líder mau intensifica os defeitos. Isso dá valor a escolher/criar bem (genética).
- Precisa de teto para não virar bola de neve.

## Carência
- Gene + experiência.
- Afeta obediência e o sofrimento ao ficar sozinho.
- Chegada: ele te espera na porta (sentado/deitado) e reage à volta conforme o nível.

## Idade
- Tempo de vida herdado (variável por cão).
- Filhote, adulto, idoso. Idoso perde sentidos/energia, deixa de trabalhar, passa a liderança.
- Amarra com morte permanente e com sucessão do líder.
- **Relógio = contador de dias do mundo (o "Day N" do F3, `/time query day`), não tempo real.** 1 dia MC = 20 min reais (24000 ticks). O contador avança também ao dormir.
- Nascimento = dia do mundo em que o cão nasceu. Idade = dia atual - dia do nascimento. Sem relógio próprio; envelhece mesmo longe ou em outra dimensão.
- Mesma diferença de dias serve para carência/tempo sozinho na volta (com teto). Ressalva: `/time set` e trapaças mexem no contador (aceitável em singleplayer).
- Sem conversão ano-de-cão/ano-de-gente: o cão tem 1 ano quando passa 1 ano do Minecraft. O Minecraft não define a duração do ano, então o mod define um calendário próprio.
- Ano literal de 365 dias é inviável (cão de 10 anos = ~1200 h). Proposta: ano do mod = 10 dias do jogo. 10 anos = 100 dias (~33 h); 15 anos = 150 dias (~50 h).
- Idade mostrada como "3 anos e 2 meses". Estações (4 de ~2-3 dias) encaixam no mesmo ano, se um dia quisermos.
- Vida varia por gene (ex.: 8 a 16 anos).
- Fases (inicial, ajustável): filhote no 1º ano, adulto até ~70% da vida, idoso no restante.
- Dormir pula a noite, então os dias passam mais rápido em tempo real; as horas acima são estimativa para jogo normal.

## Cuidados de design
1. O mundo não roda quando o jogador está fora/longe. Carência e tempo sozinho são calculados na volta, pelo tempo decorrido, com teto e generosidade (sem punir semanas reais de ausência).
2. Um único motor de humor/estado: fome, energia, carência, saúde e idade alimentam o mesmo humor, que produz obediência e reações.

## Em aberto
- Confirmar a duração do ano do mod (proposta: 10 dias do jogo).
- Quanto a genética é visível ao jogador (escondida, ficha, ou revelada aos poucos).
- Cenário do primeiro dia (A, B ou C).
