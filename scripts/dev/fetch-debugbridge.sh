#!/usr/bin/env bash
# Downloads DebugBridge for MC 26.2 (Modrinth version id NO17UtXL) into the dev run dir.
# The jar goes only in mod/run/mods (git-ignored): debug tools belong in disposable dev instances.
set -euo pipefail
cd "$(dirname "$0")/../.."
UA="User-Agent: smartpets-dev-setup/0.1"
meta=$(curl -fsS -H "$UA" "https://api.modrinth.com/v2/version/NO17UtXL")
url=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["url"])')
sha=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["hashes"]["sha512"])')
name=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["filename"])')
mkdir -p mod/run/mods
curl -fsSL "$url" -o "mod/run/mods/$name"
echo "$sha  mod/run/mods/$name" | sha512sum -c -
ls -l mod/run/mods
