# Pelagem e herança

Referências do autor: 9 variantes de lobo do Minecraft (Rusty, Pale/Regular, Black, Striped, Snowy, Ashen, Woods, Spotted, Chestnut); ninhada mista (irmãos parecidos mas diferentes); ninhada de golden retrievers (todos iguais).

## Herança de pelagem: alelos com dominância
Cada característica = um par de genes (um de cada pai), dominante ou recessivo.
- Pais com as duas cópias iguais (homozigotos) -> ninhada praticamente igual (golden).
- Pais diferentes ou portadores escondidos -> cada filhote sorteia uma combinação (ninhada mista).
- Recessivo escondido só aparece quando os dois pais o carregam: surpresa genuína, descoberta no nascimento (combina com "sem scanner").

## Textura estilo CS:GO (pattern seed)
Nas facas do CS:GO, o padrão é uma textura-modelo fixa e um número (seed) muda a posição/rotação do desenho. Aqui, em camadas:
1. Base: cor principal (preto, marrom, vermelho/dourado, cinza, branco), vinda dos genes.
2. Padrões sobre a base, cada um um gene separado: listras (tigrado), manchas, marcas caramelo, máscara no focinho, peito/patas brancas, calico (Spotted).
3. Seed individual desloca/varia os padrões: irmãos com os mesmos genes ainda diferem um pouco.
Salvar só genes + seed; montar a textura em tempo de desenho (textura dinâmica; viável pelo que conheço, não testado).

## Cuidados
1. Estilo Minecraft: texturas do lobo são pequenas (64x32). Desenhar à mão as máscaras de cada padrão em pixel art; o algoritmo só colore, combina e desloca. Evitar ruído procedural puro. Limitar a paleta.
2. As 9 variantes vanilla são os fundadores: cada cão selvagem do bioma nasce com os genes da sua variante. Cruzar biomas cria misturas.
3. Pelagem é estética (sem relação com qualidade) e tem valor de coleção (cores raras).

## Dois tipos de herança
- Pelagem: alelos discretos (acima).
- Inteligência, sentidos, temperamento, tempo de vida: contínuos (média dos pais + variação aleatória, limitada por tetos). Irmãos diferem aqui também.

## Decisões do autor
- Ninhada de 3 a 5 filhotes, variável (às vezes 2, raramente 6).
- Pelagem não precisa ser complexa: o objetivo é o "awn, que fofo" / "que legal". Orçamento de implementação: 1 a 4 dias.

## Escopo (estimativa, depois que a base do mod existir)
| Escopo | Entrega | Esforço |
|---|---|---|
| Simples (recomendado) | Cor base por genes + 3 padrões em pixel (manchas, peito/patas brancas, marcas caramelo) + seed que varia posição/intensidade | 1 a 2 dias |
| Médio | Mais padrões (tigrado, máscara, calico), alelos com dominância e portadores escondidos | 3 a 4 dias |
| Completo | Ruído procedural, dezenas de genes, mutações | Semanas (fora do orçamento) |
O simples já torna praticamente cada cão único (cor contínua x padrões ligados/desligados x seed).
Risco real: o "fofo" vem do desenho dos padrões (meias brancas, focinho claro, mancha num olho, orelhas de cor diferente), não do algoritmo. Máscaras geradas por regras simples + rodadas de ajuste de aparência guiadas pelo autor.

## Em aberto
- Quantos genes de pelagem no primeiro dia (simples ou médio).
- Mutação/raridade: cor nova que nenhum dos pais tinha.
- Como o gene de selvageria e os traços contínuos são combinados (detalhe da herança).
