# Evidence bank

A read-only HTML table (`index.html`) of evidence records. Agents never edit the HTML; they only write `.evidence/data.js` (git-ignored, repo root) and media under `.evidence/media/EV-NNNN/`.

- Open: `bash scripts/qa/evidence/open.sh` (validates, then `xdg-open`), or double-click `index.html`.
- Validate: `bash scripts/qa/evidence/check.sh` (add `--example` for the fictional demo; `EVIDENCE_DIR` overrides the data folder).
- Demo: `index.html?example=1` shows fictional records from `example/`. Never copy them into `.evidence/`.

`.evidence/data.js` must be exactly `window.EVIDENCE = [ ... ];` (loaded by a script tag so it works over `file://`). Newest first is done by the viewer. Ids are sequential and never reused.

## Record schema

Required: `id` ("EV-0001"), `date` (ISO, e.g. "2026-10-19"), `name`, `test` (scenario name or path), `under_test`, `entities` (array of strings), `description`, `media` (array, may be empty) of `{type: "image"|"video", path, caption}`. Media `path` is relative to `.evidence/` (e.g. `media/EV-0001/pause-menu.jpg`); no `..`, no absolute paths, only `A-Za-z0-9._- /`.

Optional: `kind` ("info"|"unexpected"), `why_it_matters`, `reproduction` `{runs, reproduced, how}`, `decision_needed` (`null` or `{question, options:[{label, consequence}] (>=2), recommendation, default_if_no_answer}`), `status` ("open"|"seen"|"decided"|"fixed"), `links` (strings: spec scenario, UNSPECIFIED row, ADR, PR).

An "unexpected" finding should carry `reproduction`; if a decision is needed, set `decision_needed` with options and a recommendation. The viewer counts records with `decision_needed` whose status is not decided/fixed.
