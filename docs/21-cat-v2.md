# Gato (v2)

## Decisões do autor
- Sem combate.
- Mais independente que o cão; depende mais da própria IA.
- Sem treino: são só companhia. Podem seguir o jogador, brincar, arranhar etc.
- Entre gatos: dois adultos desconhecidos podem brigar ou não; há um tempo para se acostumarem. Filhote e adulto não brigam.

## Princípio: o gato decide, o jogador conquista
- Afeto no lugar de vínculo: cresce devagar e nos termos dele. Não perseguir, oferecer peixe, ficar parado e deixar que ele venha aumentam o afeto.
- Iniciativa: escolhe seguir, brincar (barbante, que já existe), esfregar, arranhar, dormir na cama ou no baú, trazer presentes (o jogo já faz; manter).
- Mantém do vanilla: assustar creepers e phantoms, miado, ronronar.
- Independência: passa tempo longe e volta, dentro de um território pequeno em volta da casa. Sem teletransporte.

## Necessidades
Fome, energia (dorme muito), brincadeira/curiosidade, afeto (menos que o cão), território. Alimentam o humor.
Arranhar: animação e alívio de estresse, com item de arranhador; por padrão não destrói blocos.

## Entre gatos
- Adultos desconhecidos: chiam, se encaram; podem brigar ou não conforme temperamento (sociável, tímido, territorial).
- Tempo de acostumar: alguns dias do jogo de cautela. Depois: amizade, tolerância ou rivalidade.
- Filhote e adulto não brigam.
- Brigas: ferimento leve e estresse, nunca morte.
- Recursos separados (mais potes e camas) reduzem o conflito.

## Reaproveitado do cão (núcleo genérico)
Genes, pelagem (mesmo algoritmo de camadas: tigrado, malhado, calico), fases da vida (filhote, jovem, adulto, idoso), energia, humor, saúde, sexo e reprodução do original (idade mínima/máxima, intervalo entre ninhadas). Decisão de arquitetura: escrever o núcleo do cão de forma genérica desde a v1; o gato custa só a IA própria e os sons.

## Em aberto
- Tamanho da ninhada do gato (sugestão: 2 a 4).
- Tamanho do território e o que acontece se o jogador se muda.
- Se o gato reconhece o nome (atenção mínima) apesar de sem treino.
- Sons do gato: miados, ronronar, chiado, trinado para pássaros.

## Pesquisa: rotina e comportamentos reais
- Crepusculares: mais ativos ao amanhecer e entardecer. Dormem 12 a 18 h/dia em cochilos curtos (15 a 30 min). Ciclo natural: caçar, comer, se limpar, dormir. Lambem o pelo antes de dormir; brincam no começo da noite e da manhã.
- Altura: segurança, observar o território, "status" entre gatos. Buscam calor (temperatura de repouso alta); dormem no alto no frio e no chão no calor.
- Linguagem: piscada lenta = confiança; amassar (kneading) = conforto (resto de filhote); rabo para cima (com tremor na ponta) = saudação; ronronar = contentamento, mas também acalma estresse/dor; presentes = confiança e compartilhar comida.
- Apresentar gatos: 2-3 dias a 2-3 semanas para se acostumar; amizade leva 8 a 12 meses. Passos: separar, trocar cheiros (cama/brinquedos), contato visual curto, contato supervisionado. Cada gato precisa dos próprios recursos (pote, cama, arranhador); mais gatos = mais conflito.

## Escopo proposto (v2, a confirmar com o autor)
### Primeira leva (barato, alto charme)
| Comportamento | Como entra |
|---|---|
| Cochilos curtos o dia todo | Deitado mais da metade do tempo, em ciclos, sem parecer morto |
| Mais ativo ao amanhecer/entardecer | Brinca e passeia nessas janelas do dia do jogo |
| Escada de afeto | Estágios: observa de longe, chega perto, esfrega nas pernas, rabo para cima, piscada lenta, dorme perto, deita na cama/amassa, traz presentes |
| Piscada lenta de volta | Jogador agacha olhando o gato; ele responde; ganha afeto |
| Calor | Procura fornos acesos, fogueiras (ao lado, nunca em cima), cama, lã, sol; busca mais no frio |
| Lugares altos fáceis | Baús, camas, lajes, cercas, telhados baixos, até ~2 blocos |
| Deitar na cama depois do jogador | Ligado ao afeto |
| Lamber o pelo | Antes de dormir e depois de comer |
| Brincar com barbante | Item que já existe |
| Presentes | Já existe; dependente do afeto |
### Segunda leva (mais caro)
- Altura maior com navegação própria (pulos encadeados): a parte tecnicamente mais trabalhosa.
- Apresentação entre gatos por cheiro e território, com "quarto seguro".
- Caçada de bichos pequenos como ambiente.
- Esconderijos (caixas, baús).
### Cortado
- Caixa de areia: tarefa de limpeza, contra a regra "sem tarefa chata".
### Escala de tempo
2-3 dias a 2-3 semanas -> ~3 a 10 dias do jogo para acostumar. Amizade (8-12 meses) -> ~1 ano do mod (10 dias).

## Fontes
- https://www.catster.com/lifestyle/do-cats-have-an-evening-routine
- https://www.hepper.com/what-do-cats-do-all-day/
- https://zoetispetcare.com/blog/article/why-cats-like-high-places
- https://www.ellevetsciences.com/blog/why-do-cats-love-high-places/
- https://katkin.com/articles/what-do-these-common-cat-behaviours-mean
- https://animalfoundation.com/introducing-a-new-cat-to-your-resident-cat-a-step-by-step-guide/
- https://www.sfspca.org/resource/bringing-your-new-cat-home/

## Decisões do autor (resposta à pesquisa)
- Escopo da v2: primeira leva, sem caixa de areia.
- Convivência cão x gato: socialização na infância. Quem cresce junto vira amigo; quem se conhece adulto estranha.
- Ideia do autor: leite no pote, só para filhote órfão (cão e gato); com pais é automático e sem tarefa. Consumo automático, sem animação, saem corações (ver 18).
