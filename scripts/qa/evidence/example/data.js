window.EVIDENCE = [
  {
    "id": "EV-0003",
    "date": "2026-01-03",
    "name": "EXEMPLO (fictício): cão ignora comando em casa de 1 bloco",
    "test": "example/scenario-three",
    "under_test": "Resposta a comando de sentar em espaço apertado",
    "entities": [
      "cão (fictício)",
      "jogador"
    ],
    "description": "Registro de exemplo que precisa de decisão. Nada aqui aconteceu de verdade.",
    "media": [
      {
        "type": "image",
        "path": "media/EV-0003/sample.svg",
        "caption": "Imagem fictícia"
      }
    ],
    "kind": "unexpected",
    "status": "open",
    "why_it_matters": "Exemplo: mostra como uma decisão é apresentada ao mantenedor.",
    "reproduction": {
      "runs": 5,
      "reproduced": 5,
      "how": "comando fictício: exemplo-repro --runs 5"
    },
    "decision_needed": {
      "question": "Tratar como bug ou documentar como comportamento?",
      "options": [
        {
          "label": "Bug",
          "consequence": "Corrigir antes da próxima fase"
        },
        {
          "label": "Comportamento aceito",
          "consequence": "Adicionar linha em UNSPECIFIED"
        }
      ],
      "recommendation": "Bug",
      "default_if_no_answer": "Tratar como bug"
    },
    "links": [
      "specs/UNSPECIFIED.md (exemplo)"
    ]
  },
  {
    "id": "EV-0002",
    "date": "2026-01-02",
    "name": "EXEMPLO (fictício): energia cai mais rápido ao chover",
    "test": "example/scenario-two",
    "under_test": "Curva de energia sob chuva",
    "entities": [
      "cão (fictício)"
    ],
    "description": "Registro de exemplo inesperado com reprodução 2 de 3. Fictício.",
    "media": [
      {
        "type": "image",
        "path": "media/EV-0002/sample.svg",
        "caption": "Imagem fictícia"
      }
    ],
    "kind": "unexpected",
    "status": "seen",
    "why_it_matters": "Exemplo de por que o achado importa.",
    "reproduction": {
      "runs": 3,
      "reproduced": 2,
      "how": "receita fictícia: chover, esperar 60 s"
    },
    "decision_needed": null,
    "links": []
  },
  {
    "id": "EV-0001",
    "date": "2026-01-01",
    "name": "EXEMPLO (fictício): menu de pausa abre",
    "test": "example/scenario-one",
    "under_test": "Abertura do menu de pausa",
    "entities": [
      "jogador"
    ],
    "description": "Registro informativo de exemplo. Fictício.",
    "media": [
      {
        "type": "image",
        "path": "media/EV-0001/sample.svg",
        "caption": "Imagem fictícia"
      }
    ],
    "kind": "info",
    "status": "seen",
    "links": []
  }
];
