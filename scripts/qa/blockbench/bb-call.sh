#!/usr/bin/env bash
# One headless Blockbench MCP tool call (no Blockbench app, no GUI, no network listener: MCP over stdio).
# usage: bb-call.sh --root <workspace dir> --list
#        bb-call.sh --root <workspace dir> <tool> '<json args>' | @args.json
# Uses the pinned plugin checkout and Node from nvm WITHOUT touching the nvm default (see README.md).
# Fails closed: plugin commit, clean tracked tree, bun sha256 and Node version are checked on every call.
# Overrides BB_MCP_DIR (plugin checkout), BB_NODE_BIN (dir with node/npm >= 23.6), BB_BUN (bun binary) are for
# the maintainer only and are refused unless BB_ALLOW_OVERRIDE=1 (the bun sha256 check still applies).
# Note: the FIRST render runs `npm install` (network, version ranges, no upstream lock) in the render cache.
set -euo pipefail
PIN=16d3631c0572e9439d2273ac2a675e10e6873b58   # jasonjgardner/blockbench-mcp-plugin tag v1.10.1
BUN_SHA256=7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b   # bun 1.4.3 linux-x64, reviewed install
die() { echo "bb-call: $*" >&2; exit 2; }
if [ "${BB_ALLOW_OVERRIDE:-0}" != 1 ]; then
  for v in BB_MCP_DIR BB_NODE_BIN BB_BUN; do
    [ -z "${!v:-}" ] || die "$v is set; overrides are maintainer-only (set BB_ALLOW_OVERRIDE=1 to accept)"
  done
fi
dir=${BB_MCP_DIR:-$HOME/.local/opt/blockbench-mcp-plugin}
node_bin=${BB_NODE_BIN:-$(ls -d "$HOME"/.nvm/versions/node/v24.*/bin 2>/dev/null | sort -V | tail -1)}
bun=${BB_BUN:-$dir/node_modules/@oven/bun-linux-x64/bin/bun}
[ -x "$bun" ] || die "bun not found at $bun (see README.md install)"
sum=$(sha256sum "$bun" | cut -d' ' -f1)
[ "$sum" = "$BUN_SHA256" ] || die "bun sha256 $sum != reviewed $BUN_SHA256"
[ -n "$node_bin" ] && [ -x "$node_bin/node" ] && [ -x "$node_bin/npm" ] || die "node/npm >= 23.6 not found (nvm install 24)"
nv=$("$node_bin/node" -p 'process.versions.node')
IFS=. read -r major minor _ <<<"$nv"
{ [ "$major" -gt 23 ] || { [ "$major" -eq 23 ] && [ "$minor" -ge 6 ]; }; } || die "node $nv < 23.6 at $node_bin"
head=$(git -C "$dir" rev-parse HEAD 2>/dev/null || echo none)
[ "$head" = "$PIN" ] || die "plugin checkout is at $head, expected reviewed pin $PIN"
[ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ] || die "plugin checkout has local changes"
# call.ts starts `bun` from PATH and the server runs the renderer with `node` from PATH: put the pinned ones first.
shim=$(mktemp -d); trap 'rm -rf "$shim"' EXIT
ln -s "$bun" "$shim/bun"
PATH="$shim:$node_bin:$PATH" "$bun" "$dir/headless/call.ts" "$@"
