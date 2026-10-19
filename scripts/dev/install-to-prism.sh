#!/usr/bin/env bash
# Copies the built mod + Fabric API into a Prism instance.
# Usage: PRISM_MODS_DIR=<instance>/minecraft/mods bash scripts/dev/install-to-prism.sh
set -euo pipefail
: "${PRISM_MODS_DIR:?set PRISM_MODS_DIR to the instance mods folder}"
cd "$(dirname "$0")/../.."

FABRIC_API_VERSION_ID="ewUK83HI"          # Modrinth version id of Fabric API 0.161.0+26.2
FABRIC_API_EXPECTED="0.161.0+26.2"

./gradlew :mod:build
mkdir -p "$PRISM_MODS_DIR"

# Exactly the remapped mod jar; never the -sources jar.
version=$(sed -n 's/^version=//p' gradle.properties)
jar="mod/build/libs/smartpets-${version}.jar"
[ -f "$jar" ] || { echo "ERROR: $jar not found" >&2; exit 1; }
rm -f "$PRISM_MODS_DIR"/smartpets-*.jar   # drop stale builds of the mod
cp "$jar" "$PRISM_MODS_DIR"/

meta=$(curl -fsS -H "User-Agent: smartpets-dev-setup/0.1" "https://api.modrinth.com/v2/version/$FABRIC_API_VERSION_ID")
read -r url name sha < <(echo "$meta" | python3 -c 'import sys,json;f=json.load(sys.stdin)["files"][0];print(f["url"],f["filename"],f["hashes"]["sha512"])')
case "$name" in
  *"$FABRIC_API_EXPECTED"*) ;;
  *) echo "ERROR: Modrinth file '$name' does not contain $FABRIC_API_EXPECTED" >&2; exit 1 ;;
esac

if [ ! -f "$PRISM_MODS_DIR/$name" ]; then
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT
  curl -fsSL "$url" -o "$tmp"
  echo "$sha  $tmp" | sha512sum -c - >/dev/null || { echo "ERROR: sha512 mismatch for $name" >&2; exit 1; }
  chmod 644 "$tmp"
  mv "$tmp" "$PRISM_MODS_DIR/$name"
fi
echo "$sha  $PRISM_MODS_DIR/$name" | sha512sum -c -
ls -l "$PRISM_MODS_DIR"
