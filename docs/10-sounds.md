# Sons do cão

## Ideia
Os sons são o maior feedback de personalidade e de intenção. Lista de situações, com timbres diferentes por cão.

## Base vanilla (a confirmar na versão alvo)
O lobo vanilla tem latir/rosnar, choramingar, ofegar, dor, morte e sacudir; versões recentes têm variantes de voz (ex.: filhote). Usar como base e acrescentar.

## Variação por cão
O Minecraft toca um som com tom e volume ajustáveis. Poucas amostras base (pequeno, médio, grande) + variação de tom por cão = voz própria sem multiplicar arquivos. Ligar a um gene de voz/porte.

## Lista inicial (situação -> som)
| Situação | Som |
|---|---|
| Pedir comida / atenção | Choramingo curto, latido baixo |
| Alerta de perigo | Rosnado baixo, latido seco |
| Chegada do dono | Latidos animados, ganidos de alegria |
| Brincadeira | Latidos agudos, ofegos |
| Medo | Ganido, choramingo |
| Dor / ferimento | Ganido forte |
| Carência | Gemido longo, suspiro |
| Cansaço / idoso | Suspiro pesado, ofegar lento |
| Filhote | Piados e ganidos agudos |
| Noite | Uivo (chama outros cães) |
| Defesa do território | Latido contínuo e firme |
| Conquista, estágio inicial | Rosnado de distância; depois choramingo curioso |

## Coerência (preocupação do autor: nada de "colcha de retalhos")
Fonte aceita: biblioteca ou IA, mas tudo precisa combinar. A coerência vem de uma única fonte por voz e do mesmo processamento, não da origem do som.

| Caminho | Resultado | Problema |
|---|---|---|
| A. Misturar com sons vanilla | Fácil | Estilo vanilla é estilizado; som realista ao lado soa estranho |
| B. Substituir tudo nos cães do mod | Coerente | Mais sons a produzir (só dos cães do mod) |
| C. Imitar o estilo vanilla | Combina com o jogo | Difícil e subjetivo |

Recomendação: B. Vanilla fica só como reserva.

Regras:
1. Definir o estilo antes (realista x levemente estilizado; tender a um meio-termo: curto, seco, cauda pequena).
2. Uma única fonte por voz (biblioteca: uma só, de preferência de um gravador; IA: uma ferramenta e o mesmo estilo de pedido, pois cada clipe sai independente).
3. Mesma cadeia de processamento para tudo: normalizar volume, cortar silêncios, mesmo filtro e mesma degradação leve, converter para o formato do jogo (pelo que sei, OGG mono para som posicional; a confirmar).
4. Três vozes base (pequeno, médio, grande), todas as situações, mais variação de tom por cão.
5. Teste antes de escalar: 3 sons (alerta, pedir comida, alegria) em uma voz, ouvidos no jogo ao lado dos sons vanilla.

## Produção
- Não dá para gerar latidos por código; a ferramenta de áudio (biblioteca ou IA) fica com o autor. Montar o catálogo, os pedidos e o pipeline de processamento.
- Verificar licença (CC0 ou atribuição); termos da ferramenta de IA para uso comercial/distribuição.
- Evitar sons com direitos autorais de outros jogos/filmes.

## Em aberto
- Estilo: realista, estilizado ou meio-termo. **Decisão do autor: decidir experimentando.** Teste: os mesmos 3 sons (alerta, pedir comida, alegria) nos três estilos, comparados no jogo.
- Fonte: biblioteca ou IA, e qual ferramenta.
