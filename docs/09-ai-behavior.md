# IA do cão: iniciativa e decisão

## Diagnóstico do vanilla
A IA de mobs é uma lista de objetivos com prioridade. O lobo tem poucos e quase todos reativos ao dono (seguir, atacar quem o dono atacou, sentar). Pelo que conheço, é daí que vem o "ataca quem você ataca, sem noção": não há passo de avaliar. Sem iniciativa própria nem ponderação de risco.

## Proposta: decisão por pontuação, em camadas
O cão pontua cada comportamento possível com base no estado (fome, energia, carência, humor, vínculo, personalidade, genes, habilidades) e o maior vence. Mantém "compromisso" com a escolha por um tempo para não ficar mudando de ideia.

| Camada | Exemplos | Regra |
|---|---|---|
| 1. Reflexo | Fugir de lava, recuar de creeper, largar alvo se for aliado | Sempre vence (juízo, camada 0) |
| 2. Ordem | Sentar, ficar, atacar, seguir | O cão avalia se obedece: obediência x vínculo x humor contra o que ele quer |
| 3. Iniciativa | Pedir comida, avisar perigo, defender o dono, emboscada, trazer presente, brincar | Disparada por estado, personalidade e habilidades |
| 4. Rotina | Dormir na toca/cama, vigiar a casa, esperar na porta | O que faz quando nada mais pede |

A ordem não é absoluta: cão teimoso ou assustado pode ignorar; leal obedece mesmo contrariado.

## Exemplos
- Pedir comida: fome alta + carência/vínculo -> vai ao pote, olha para o jogador, late baixo; ignorado por muito tempo, o humor cai.
- Defender o dono: exige Combate + lealdade. Corajoso entra; medroso fica perto e rosna. Nunca ataca aliado.
- Emboscada: habilidade avançada de Combate. Fareja/ouve o alvo, se esconde fora de vista, ataca quando chega perto. Depende de olfato, audição, inteligência.
- Avisar perigo: audição/olfato altos -> para, olha numa direção, rosna baixo (pista sem texto).

## Cuidados
1. Iniciativa legível, não irritante: sinal claro antes de cada comportamento e modo de dar folga.
2. Posturas mais ricas que o sentar do vanilla: livre (decide), junto (perto), guarda (protege a área). A guia de trabalho é a chave das posturas.
3. Quanto ele toma iniciativa depende da personalidade (independente age sozinho; carente age perto do jogador).
4. Custo de processamento: "pensar" algumas vezes por segundo, não a cada tick.

## Em aberto
- Quais comportamentos independentes entram no primeiro dia.
- Como o jogador "dá folga" a um comportamento que o incomoda.

## IA e treino são o mesmo sistema (decisão do autor)
A iniciativa é aprendida: cada comportamento tem um peso na pontuação que o treino altera.
- Recompensa (comida, carinho, corações) logo após um comportamento aumenta o peso. Ignorar reduz.
- Correção reduz o peso: a palavra "não" (que o cão também aprende) e retirar a atenção. É assim que os vícios diminuem: não há barra de vício, há um comportamento cujo peso baixa com repetição.
- Palavras e situações são a mesma coisa: ambas são sinais que disparam um comportamento (palavra do jogador; fome + pote vazio). A conquista (isca, palavra, recompensa) é o caso em que o sinal vem do jogador.
- Árvores de habilidade liberam quais comportamentos podem ser aprendidos; genes (inteligência) definem a velocidade.
- Sem punição física: dono que machuca gera medo e perde vínculo.
