# Conquista do adulto e voz

## Decisão: conquista por paciência e repetição, integrada à voz
Espelha o adestramento real: palavra + ação + recompensa, repetidas até a associação firmar.

## Etapas (rascunho)
1. Distância: ele foge/rosna; o jogador respeita o espaço.
2. Tolerância: aceita o jogador por perto, depois se aproxima sozinho.
3. Comida: aceita no chão, depois da mão.
4. Toque.
5. Palavras: associa palavra a ação; cada repetição certa com recompensa aumenta a chance de obedecer.
O cão aprende a PALAVRA, não o comando. No início reage de forma aleatória; a associação firma com a repetição.

## Voz: qualquer som vira comando (ideia do autor)
O jogador ensina o cão; não escolhe de uma lista. Qualquer palavra, em qualquer língua (inclusive alemão), ou som (apito, palmas, clicker).

### Ciclo de treino: isca, palavra, recompensa
1. Jogador fala a palavra.
2. Induz a ação com isca (ex.: comida sobre a cabeça para "senta").
3. Dá a recompensa (coração, comida).
4. Cada repetição reforça a associação palavra -> ação. A chance de executar sozinho depende de inteligência, obediência, vínculo e humor.
Cada comando (sentar, ficar, seguir, buscar, atacar) terá seu método de indução. A desenhar depois.

### Nome do cão
Nome + comida + atenção = corações. Depois ele olha quando é chamado. Regra do adestramento real: **nome primeiro, comando depois** ("Felícia, senta"), o que reduz disparos falsos.

### Reconhecimento (hipótese, não testada)
- Shazam (fingerprint de picos espectrais) NÃO é o melhor encaixe: funciona com gravações idênticas; a voz varia a cada repetição.
- Família certa: busca por exemplo (query-by-example keyword spotting): guardar alguns exemplos, extrair características (MFCC), comparar com Dynamic Time Warping. Independe da língua, tolera ruído moderado, guarda só as características (não o áudio). Alternativa: modelos pequenos few-shot.
- Rigidez da comparação ligada à inteligência: cão esperto generaliza (outro tom, outra voz); cão menos esperto exige som quase idêntico.
- Cada cão tem seu próprio "dicionário" de sons aprendidos, salvo no mundo.
- Alcance de resposta depende do nível de audição do cão. Apito = item natural para longa distância.
- Reconhecimento local (singleplayer): o áudio nunca sai do computador.

## Decisões do autor sobre a voz
- Aceita o **teste isolado primeiro** (fora do Minecraft) para validar o reconhecimento.
- Comandos também por interface (UI) sempre.
- Se o teste der certo, a voz vem **habilitada por padrão** nas configurações: é a experiência que o autor quer que o jogador tenha.

## Cuidados
1. Precisão é a grande incógnita: antes de construir o resto em cima, validar com teste isolado (fora do Minecraft) com gravações reais.
2. Nunca depender só da voz: toda ordem existe também por tecla/chat.
3. Uma entrada comum: voz, tecla e chat viram o mesmo "comando" internamente; a voz pode falhar sem quebrar nada.
4. Falsos positivos: regra do nome primeiro + tecla de falar como padrão; escuta contínua opcional.
5. Latência: ~0,5 s é aceitável em adestramento.

## Em aberto
- Se o tom de voz importa ou só a palavra.
- Método de indução de cada comando.
- Detalhes da conquista: tempo total, o que acontece se o jogador erra ou assusta o cão.
- Tecla de falar (padrão) versus escuta contínua.
