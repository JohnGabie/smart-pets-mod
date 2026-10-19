#!/usr/bin/env bash
# Downloads DebugBridge for MC 26.2 (Modrinth version id NO17UtXL) into the dev run dir.
# The jar goes only in mod/run/mods (git-ignored): debug tools belong in disposable dev instances.
# The jar is downloaded to a temp file and moved into place only after the sha512 check passes.
set -euo pipefail
cd "$(dirname "$0")/../.."
UA="User-Agent: smartpets-dev-setup/0.1"
EXPECTED_NAME="debugbridge-26.2-2.1.0.jar"
meta=$(curl -fsS -H "$UA" "https://api.modrinth.com/v2/version/NO17UtXL")
url=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["url"])')
sha=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["hashes"]["sha512"])')
name=$(echo "$meta" | python3 -c 'import sys,json;print(json.load(sys.stdin)["files"][0]["filename"])')
[ "$name" = "$EXPECTED_NAME" ] || { echo "ERROR: Modrinth file '$name' is not $EXPECTED_NAME" >&2; exit 1; }
mkdir -p mod/run/mods
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsSL "$url" -o "$tmp"
echo "$sha  $tmp" | sha512sum -c - >/dev/null || { echo "ERROR: sha512 mismatch for $name; nothing installed" >&2; exit 1; }
chmod 644 "$tmp"
mv "$tmp" "mod/run/mods/$name"
echo "installed mod/run/mods/$name (sha512 OK)"
ls -l mod/run/mods
