#!/usr/bin/env bash
# One headless Blockbench MCP tool call (no Blockbench app, no GUI, no network listener: MCP over stdio).
# usage: bb-call.sh --root <workspace dir> --list
#        bb-call.sh --root <workspace dir> <tool> '<json args>' | @args.json
# Uses the pinned plugin checkout and Node from nvm WITHOUT touching the nvm default (see README.md).
# Overrides: BB_MCP_DIR (plugin checkout), BB_NODE_BIN (dir with node/npm >= 23.6), BB_BUN (bun binary).
set -euo pipefail
PIN=16d3631c0572e9439d2273ac2a675e10e6873b58   # jasonjgardner/blockbench-mcp-plugin tag v1.10.1
dir=${BB_MCP_DIR:-$HOME/.local/opt/blockbench-mcp-plugin}
node_bin=${BB_NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v24.*/bin 2>/dev/null | sort -V | tail -1)}
bun=${BB_BUN:-$dir/node_modules/@oven/bun-linux-x64/bin/bun}
[ -x "$bun" ] || { echo "bb-call: bun not found at $bun (see README.md install)" >&2; exit 2; }
[ -x "$node_bin/node" ] || { echo "bb-call: node >= 23.6 not found (BB_NODE_BIN)" >&2; exit 2; }
head=$(git -C "$dir" rev-parse HEAD 2>/dev/null || echo none)
[ "$head" = "$PIN" ] || { echo "bb-call: plugin checkout is at $head, expected reviewed pin $PIN" >&2; exit 2; }
[ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ] || { echo "bb-call: plugin checkout has local changes" >&2; exit 2; }
# call.ts starts `bun` from PATH and the server runs the renderer with `node` from PATH: put the pinned ones first.
shim=$(mktemp -d); trap 'rm -rf "$shim"' EXIT
ln -s "$bun" "$shim/bun"
PATH="$shim:$node_bin:$PATH" "$bun" "$dir/headless/call.ts" "$@"
