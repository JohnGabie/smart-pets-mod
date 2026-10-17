# Gerações e árvores de habilidade

## Decisão: cenário do primeiro dia = B
O jogador conquista um cão selvagem. Ele vem com habilidades geradas (fora do controle do jogador), é desobediente e difícil, mas com treino chega a um teto alto, bom em combate.

## Gerações (eixo genético "selvageria")
| Geração | Selvageria | Perfil |
|---|---|---|
| 1 (conquistado) | alta | Habilidades aleatórias, desobediente, ignora cama. Bom em combate; exige muito treino de obediência. |
| 2 | média | Ainda sob influência dos pais. |
| 3 e 4 | baixa | Muito adaptado à casa e à obediência, fraco em combate até ser treinado. |
Base real: experimentos de domesticação de raposas (Belyaev). A selvageria cai a cada geração; cruzamentos permitem equilibrar força e docilidade.

## Árvores de habilidade
- **Combate** (inclui caça). Ápice raro: segurar espada.
- **Exploração** (seguir, rastrear, desviar de obstáculos). Olfato alimenta o rastreio.
- **Doméstico** (as coisas "cute"): reduz vícios, estabiliza humor, melhora convivência em casa/grupo, reforça a influência do líder.

## Ajustes de coerência
1. Juízo != obediência. Segurança básica (não pular em lava, fugir de creeper) é de graça em todo cão, até o selvagem. A árvore de Exploração só melhora o que está acima disso.
2. Árvore Doméstica precisa de valor mecânico (ver acima), senão é ignorada.
3. Árvore = o que ele SABE fazer (cresce por prática). Vínculo = o quanto ele ESCOLHE fazer quando pedido. Cão selvagem: Combate alto, vínculo baixo.
4. Cama não serve ao gen 1: precisa de uma "toca" (canto que ele escolhe), que evolui para a cama conforme a selvageria baixa.
5. Tempo de vida limita o treino: ninguém maximiza as três árvores, o que dá peso à especialização.

## Mudança na ordem de construção
Antes: doméstico solo -> selvagem -> alcateia. Agora o selvagem é o começo, então a primeira entrega precisa do mínimo de: juízo, vínculo básico, uma árvore de habilidade, e a geração 1. A criação (gen 2+) vem depois.

## Em aberto
- Como o jogador encontra o cão selvagem adulto e o filhote órfão (spawn raro, toca a descobrir, evento de perseguição).
- Como funciona a conquista: etapas, tempo, risco.
- Pontos de treino, ganho por prática, ou ambos.
- Como a selvageria cai: só por geração, ou também pelo ambiente em que o cão cresce.

## Filhote órfão adotado (o "sweet spot")
Decisões do autor:
- Só filhote **órfão** (sem combate contra os pais).
- Ele tem **mais propensão** a ser um ótimo cão (bom em combate e em doméstico).
Base real: janela de socialização na infância.

Implementação conceitual: **viés** no sorteio de genes (puxa para teto alto e traços equilibrados), sem garantia. Um órfão pode sair mediano; um adulto pode sair excelente. Os genes continuam sem mudar depois de nascidos; o viés só vale no sorteio.

Preço do boost (para o adulto continuar valendo): **carência alta**.
| | Adulto conquistado | Filhote órfão |
|---|---|---|
| Genes | Sorteio normal | Sorteio com viés a favor |
| Poder agora | Alto, imediato | Quase nenhum |
| Carência | Baixa | Alta: sofre sozinho, precisa do jogador |
| Cuidado | Pouco | Constante por ~1 ano do mod |
| Risco | Desobediência | Medo, trauma, morte por descuido |

Selvageria do órfão: ainda não travada. O jeito de criar decide (casa, aventura, ou os dois). Só os dois ambientes levam perto do teto das duas árvores.
Tom: o cão que mais pode dar é o que mais precisa do jogador (Sam, Togo).
Obtenção (decidido: os três existem, em frequências diferentes):
| Forma | Frequência | Papel |
|---|---|---|
| Cena encontrada (toca vazia, sinais de ataque) | Mais comum | Caminho padrão, história silenciosa |
| Presenciado (vê os pais caírem num ataque) | Incomum | Momento dramático, evitável se o jogador agir |
| Aleatório (órfão sem explicação) | Muito raro | Presente inesperado |
Ordem de construção: cena encontrada primeiro (mais barata, já entrega o tom).
Em todos os casos o jogador não precisa matar os pais.
Link com a alcateia futura: a toca tem família.
