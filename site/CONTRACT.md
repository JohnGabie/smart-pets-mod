# Site contract (read before touching anything)

Static site, no build step, relative URLs only (must work under `/<repo>/` on GitHub Pages). Serve locally: `python3 -m http.server -d site 8000`.
Honesty rules: nothing here is real gameplay yet. Label demos "concept demo, not real gameplay". No fabricated numbers, quotes, downloads or screenshots. No AI-generated images; all art is original pixel art (SVG/canvas) drawn by code. Record every non-code asset (fonts, images) in `../ASSETS.md`.

## Ownership (one writer per file; never edit another owner's files)
| Owner | Files |
|---|---|
| foundation (done) | `assets/css/base.css`, `assets/js/i18n.js`, `assets/js/shell.js`, `assets/img/{dirt,stone,deepslate,planks,grass-side}.svg`, `assets/img/logo.svg`, `data/status.json`(schema), `i18n/common.*.json`, `tools/gen-tiles.py`, `CONTRACT.md` |
| A: landing | `index.html`, `assets/css/landing.css`, `assets/js/landing.js`, `i18n/landing.{en,pt-BR}.json`, `assets/fonts/*`, `assets/img/landing-*`, `.github/workflows/pages.yml` |
| B: demos | `assets/js/demos/*.js`, `assets/css/demos.css`, `i18n/demos.{en,pt-BR}.json`, `assets/img/demo-*` |
| C: developers tab | `dev.html`, `assets/css/dev.css`, `assets/js/dev.js`, `assets/img/dev-*` |
| status data | `data/status.json` content is edited by the project's docs-freshness rule only |

## Shared pieces
- Pages: `<body data-page="home|dev">`, `<header id="sp-header">`, `<footer id="sp-footer">`, `<script>window.SP_I18N_MODULES=["common","landing","demos"]</script>` then `assets/js/i18n.js`, `assets/js/shell.js`. Load `base.css` first.
- Components (base.css): `.sp-container .sp-section .sp-hero .mc-title .mc-sub .mc-btn(.mc-btn--green) .mc-panel(.mc-panel--dark) .mc-card-grid .mc-slot .mc-tabs .mc-tab .mc-badge(--done|--progress|--planned|--research) .mc-xp>span .mc-code .mc-kbd .mc-note`.
- Status: `SP.loadStatus()` returns `data/status.json` (phases with `state` in done|progress|planned|research). The roadmap is rendered from it, never hard-coded.
- Demos: B exposes `window.SPDemos = { mount(name, element) }` for names: `coats`, `training`, `lifecycle`, `bond`. A places `<div data-demo="coats"></div>` etc. and calls `SPDemos.mount`. B's scripts live under `assets/js/demos/` and are loaded by A with `<script defer>` in this order: `demos/core.js` then the others.
- i18n: each owner uses only its own module keys (prefix `landing.`, `demos.`, `dev.` not required to be translated; dev tab is English only).
- Accessibility: semantic landmarks, alt text, visible focus, keyboard-operable demos, `prefers-reduced-motion` respected, contrast AA on text.
- Fonts: A downloads `PressStart2P-Regular.ttf` (OFL) to `assets/fonts/` and records license in ASSETS.md.
- Hosting: `.github/workflows/pages.yml` is `workflow_dispatch` only (GitHub Pages needs a public repo on the free plan).
