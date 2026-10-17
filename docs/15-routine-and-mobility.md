# Rotina de sono e mobilidade

## Dormir (ideia do autor)
- O jogador só dorme se os cães perto dele estiverem dormindo (como o sono em multiplayer). Cães longe (canil fora de casa) não contam.
- Cão que quer brincar não dorme: o jogador leva ao cantinho dele ou manda dormir.
- Em pacífico, a cama do cão é o ponto de renascimento.
Riscos e mitigações (ninhada de 5 filhotes agitados vira tarefa toda noite):
1. Cão treinado vai para a cama sozinho ao entardecer; o esforço fica nos filhotes/selvagens.
2. Energia gasta durante o dia gera sono.
3. O líder puxa o grupo para dormir.
4. Comando "todos dormir".
5. Opção nas configurações para desligar.
Dormir não é obrigatório no jogo, então a regra só pesa para quem quer pular a noite.

## Cair no sono (decisão do autor)
Quando o cão quer deitar, há chance de adormecer, conforme humor, saciedade etc. Estados: de pé, deitado, cochilando, dormindo; a passagem deitado -> dormindo é probabilística.
| Aumenta a chance | Diminui |
|---|---|
| Barriga cheia | Fome |
| Energia gasta (passeio, brincadeira) | Muita energia acumulada |
| Humor calmo e seguro | Excitação, medo, alerta |
| Noite, casa, perto da cama/toca | Estranho por perto, barulho |
| Dono por perto (carente) | Dono sumido (carente) |
Efeito: cão bem cuidado adormece sozinho ao entardecer, reduzindo a chatice da regra de dormir.
Bônus: sono leve/pesado como traço herdado. Cão de guarda acorda com pouco barulho (usa a audição); cão pesado dorme fundo.

## Acordar ao ouvir o nome
Depende da profundidade do sono:
| Estado | Chamadas necessárias |
|---|---|
| Cochilando | 1 (levanta a cabeça) |
| Sono normal | 2 ou 3 (orelhas, depois olhos, depois levanta) |
| Sono pesado | Várias, ou toque/comida |
Fatores: audição (alcance/sensibilidade), sono leve/pesado (herdado), força do nome (quanto foi treinado), vínculo e carência.
Detalhe: acordar de repente baixa o humor um pouco; acordar devagar (voz baixa) rende melhor humor.
Os passos de acordar servem de feedback visual e sonoro (orelhas, olhos, resmungo).

## Sem teletransporte (decisão do autor)
Remover o teletransporte do cão (pior mecânica do vanilla). Em troca: seguir de verdade (Exploração), olfato, comando "vá para casa".

## "Vá para casa"
Alto nível de Exploração: o cão acha o caminho de casa sozinho.
Risco técnico (o maior desta parte): o jogo só simula mobs perto do jogador. Solução proposta: viagem simplificada. Quando o cão sai da área simulada, o mod calcula tempo e risco (velocidade, perigos, Exploração, saúde) e o coloca em casa na hora certa.
Dimensões (Nether): o cão não vai sozinho; o jogador o leva pelo portal.

## Cavar para sair de preso (decisão do autor)
- Cão sem caminho até o jogador ou até casa cava terra, areia, cascalho, argila etc.
- Nunca estruturas do jogador; respeita a regra do jogo contra mobs que quebram blocos.
- Habilidade ensinada, da árvore de Exploração.
- Acha o jogador pelo olfato (rastro que o jogador deixou) e pela audição (assobio, nome chamado).
- Ideia extra: cavar areia/cascalho suspeitos (arqueologia do jogo) como habilidade de farejador.

## Decisão do autor: alcance de "vá para casa"
Simulado de verdade (viagem simplificada), alcance realista de 1.000 a 2.000 blocos da cama dele.
| Quem | Alcance |
|---|---|
| Cão comum | ~1.000 blocos |
| Bom explorador/farejador | Até ~2.000 blocos |
| Gênio raro | Acima disso, teto próprio |
O alcance cresce com a árvore de Exploração e o nível de olfato. Além do alcance ele fica perdido: só encontra o jogador se estiver perto (cheiro/som).

## Cama e sono (decisão do autor)
- A cama define a casa e o ponto de renascimento. Se for destruída, a casa passa a ser o spawn do jogador (solução provisória).
- O cão dorme em qualquer lugar, até no chão, e isso conta para a regra de dormir do jogador. Só a cama define a casa.
- As "bags de viagem" que o autor lembrou eram de um mod, não do vanilla. A lógica se mantém: o cão dorme em qualquer lugar; só a cama define a casa. Cama portátil e alforje do cão ficam como ideias de itens futuros (ver habilidades e itens).

## Em aberto
- Percentual de cães dormindo exigido para o jogador dormir.
- Alcance que define "cão perto" para o sono.
- Rastro de cheiro: por quanto tempo dura.
