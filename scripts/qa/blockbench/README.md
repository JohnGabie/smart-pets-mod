# Blockbench toolkit (agent-autonomous model, texture and animation checks)

Lets an agent build, validate, render and export Blockbench models with no human and no GUI, and check
textures with Pillow. Renders are exploratory evidence for the author: the final oracle stays in-game
(DebugBridge screenshot, client GameTest, ADR-0002). Whether a model "looks good" is the human's call
(CLAUDE.md §8). First run: 2026-10-19 (see `MODLOG.md`).

| File | What |
|---|---|
| `bb-call.sh` | one headless MCP tool call (`--list`, or `<tool> '<json>'` / `@args.json`); refuses to run unless the plugin checkout is at the reviewed pin and clean |
| `check-texture.py` | PNG validator (stdlib + Pillow): size vs model, power of two, alpha mode, UV islands from a `.bbmodel` / `.geo.json` / UV list (out of bounds, holes, paint outside), palette stats and limits |
| `test_check_texture.py` | 16 tests on crafted images: `python3 -m unittest discover -s scripts/qa/blockbench -p 'test_*.py'` |

## Installed software (user level, outside the repo, no sudo)

| What | Version / pin | Where | Command used |
|---|---|---|---|
| Blockbench desktop | 5.2.2, Flathub commit `01a979dd57a9...` (runtime org.freedesktop.Platform 26.08) | Flatpak user install (`~/.local/share/flatpak`) | `flatpak install --user -y --noninteractive flathub net.blockbench.Blockbench` |
| Node for the renderer | 24.22.0 (nvm). The nvm **default stays 20** | `~/.nvm/versions/node/v24.22.0` | `nvm install 24` (no `nvm alias default`); afterwards `nvm alias default` still prints `20` and `node -v` prints `v20.20.2` |
| Blockbench MCP plugin (jasonjgardner/blockbench-mcp-plugin, GPL-3.0-only) | tag v1.10.1 = commit `16d3631c0572e9439d2273ac2a675e10e6873b58` | `~/.local/opt/blockbench-mcp-plugin` (git checkout, detached) | `git clone https://github.com/jasonjgardner/blockbench-mcp-plugin` then `git checkout 16d3631c...` |
| Its runtime deps | bun 1.4.3 (sha256 `7ce7d6b6...f8f24b`), @modelcontextprotocol/sdk 1.32.1, zod 3.25.76 | `<plugin>/node_modules` | with Node 24 on PATH: `npm install --omit=dev --ignore-scripts --no-audit --no-fund` (npm ignores the repo's `bun.lock`, so versions are newer than the lock: bun lock 1.4.2, sdk lock 1.25.3) |
| Render engine deps | three 0.184.0, three-blockbench 0.1.0, @rendergl/headless-three-webgpu 0.2.0, webgpu (Dawn) 0.4.0, sharp 0.34.5; `package-lock.json` sha256 `b48831c5...ff90bf` | `~/.cache/blockbench-mcp-headless/render` (~125 MB) | first `npm install --ignore-scripts` by hand to read the install scripts; the first render then ran its own `npm install` there |

No GeckoLib Blockbench plugin and no desktop MCP plugin are loaded in the app yet (that needs a GUI click, see below).

## Headless route (what an agent runs)

```
W=<scratch workspace>          # every path in a call is relative to --root and cannot escape it
bash scripts/qa/blockbench/bb-call.sh --root "$W" --list
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_create '{"file":"m.bbmodel","format":"geckolib_model","resolution":{"width":64,"height":32}}'
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_edit @ops.json          # add_group / add_cube / add_animation / set_keyframe ...
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_add_texture '{"file":"m.bbmodel","image":"m.png","assign_to":["body"]}'
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_validate '{"file":"m.bbmodel"}'             # add "self_test":true to prove each gate fires
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_validate_animations '{"file":"m.bbmodel"}'
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_render '{"file":"m.bbmodel","view":"right","output":"renders/r.png","overwrite":true,"clip":"walk","time":0.5}'
bash scripts/qa/blockbench/bb-call.sh --root "$W" bbmodel_export_bedrock_geometry '{"file":"m.bbmodel","output":"export/assets/smartpets/geckolib/models/entity/m.geo.json","identifier":"geometry.m"}'
python3 scripts/qa/blockbench/check-texture.py "$W/m.png" --model "$W/m.bbmodel"
```
Then open the PNG with the image reader and look at it. Views: front, back, left, right, three-quarter, iso, top
(front = -Z). One render takes about 0.45 s. `bbmodel_contact_sheet` works too, but through `call.ts` it writes
into a private folder under the OS temp dir (no `--scratch` option there): prefer `bbmodel_render` with `output`.

Facts learned on the first run (all on this machine, 2026-10-19):
- The renderer worked with no X display, no Xvfb and no GPU setup. Forcing the Vulkan driver (`VK_DRIVER_FILES` =
  lavapipe, Intel, or a missing file) gave byte-identical PNGs, so which adapter Dawn really uses is UNVERIFIED;
  renders are deterministic (loop frame 0 and frame 1.0 s had the same hash).
- Rotation sign: `[40,0,0]` on the head bone tilted the head UP (nose up), not down. Group rotation `-30` on X is
  exported to `.geo.json` as `30` (Bedrock mirrors X). Keep this in mind when writing keyframes.
- There is NO headless GeckoLib animation export. The headless server exports geometry (`.geo.json`, format 1.12.0)
  only. Animation JSON came from a 40-line scratch converter (numeric keyframes, copied verbatim); its sign
  convention against the GeckoLib runtime is UNVERIFIED until E7 (in game).
- `bbmodel_validate` warns (does not error) on floating parts, ground sinking and detached limbs; read `warnings`.

## Desktop route (not autonomous yet)
`env -u WAYLAND_DISPLAY xvfb-run -a -s "-screen 0 1280x800x24" flatpak run --user --nosocket=wayland --socket=x11 net.blockbench.Blockbench --ozone-platform=x11`
starts Blockbench 5.2.2 under Xvfb (first screen: "Quick setup"). Without `--nosocket=wayland --socket=x11` and
`--ozone-platform=x11` it exits ("Failed to connect to Wayland display"). Grab the screen with
`ffmpeg -f x11grab -video_size 1280x800 -i "$DISPLAY" -frames:v 1 shot.png`; stop it by the PID of `flatpak run`.
Loading the desktop MCP plugin and the GeckoLib plugin is a GUI step (File > Plugins > load from file). It needs the
maintainer once; the agent does not click it. Until then E3/E4-desktop/E6-plugin stay UNVERIFIED.

## Safety rules
- Pin: `bb-call.sh` checks the commit. To move the pin, read the diff of `headless/` and `bin/` first, then update
  `PIN` here and in `MODLOG.md`.
- Reviewed in v1.10.1 (`headless/`): MCP over **stdio only**; no HTTP listener, no `eval`/`new Function`. Child
  processes: `npm install` (first render, in the cache folder), `node cli.mjs` per render, and `blockbench_launch`
  (spawns the desktop app, then polls `http://localhost:3000/bb-mcp`). Network: npm registry on first render, and
  `bbmodel_web_url` only builds `web.blockbench.net` links (model data after `#`, nothing is sent). Paths outside
  `--root` are refused (symlinks too). Written models get `ai_used`/`ai_agents` (keep it on: AI disclosure trail).
- Do not call `blockbench_launch` from the headless server: it starts the GUI app outside this README's Xvfb rules.
- Desktop plugin (when loaded later): its HTTP server binds loopback and rejects non-loopback Origin/Host (README,
  not yet read in source); keep `risky_eval` OFF; load a pinned local file, never "load from URL".
- Render deps are installed by `npm install` from version ranges (no lockfile upstream). The resulting lock hash is
  recorded above; a reinstall may pull newer versions. Read install scripts before letting npm run them
  (`webgpu` postinstall is macOS-only `xattr`; `sharp` install is a libvips check).
- Never put Mojang textures, traced copies or decompiled code in the workspace that gets committed. Examples and
  renders live in a scratch folder, not in `assets/`. No binary art is committed by this toolkit.
- One heavy thing at a time (8 cores, ~7 GB RAM): do not render while Minecraft or a Gradle build is running.

## Results (first run, 2026-10-19)

| E | Experiment | Status | Evidence (short) |
|---|---|---|---|
| E1 | headless `--list`, create + validate a model | PASS | 23 tools listed; cube and 7-bone quadruped created, textured, validated (0 errors); `self_test` proves every gate fires; broken copy flagged floating part, ground sink, detachment |
| E2 | headless render (contact sheet / views) | PASS | non-blank PNGs (`check-screenshot.sh`: OK), textures and face colors visible, 6 angles differ |
| E3 | desktop Blockbench under Xvfb + plugin over HTTP | PARTIAL | app starts under Xvfb (screen grabbed); plugin load needs a GUI click: UNVERIFIED |
| E4 | screenshots from several angles | PASS (headless) | cube 6 views, quadruped 5 views, looked at by the agent; desktop `capture_screenshot` UNVERIFIED |
| E5 | animation frames | PASS (headless) | 2-keyframe `nod`: head pose changed between t=0 and t=1; `walk` 9 frames, frame 0 == frame 8 (same hash), symmetric frames identical |
| E6 | GeckoLib export, file layout | PARTIAL | `.geo.json` exported headless into `assets/smartpets/geckolib/models/entity/` (scratch); animation JSON only via scratch converter into `geckolib/animations/entity/`; GeckoLib plugin export UNVERIFIED |
| E7 | GeckoLib loads the files in game | NOT RUN | needs a throwaway branch with GeckoLib 5.5.5 and a client GameTest |
| E8 | `check-texture.py` | PASS (crafted) | 16 unit tests; scratch textures pass; a broken copy fails (semi alpha, hole, paint outside). Vanilla wolf PNG run not done |
| E9-E14 | in-game preview, coats, props, pixel-art generator, anim quality loop | NOT RUN | |
