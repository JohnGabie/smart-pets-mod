#!/usr/bin/env bash
# Installs Temurin JDK 25 into the user's home (no sudo) and points Gradle at it.
set -euo pipefail
URL="https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1/OpenJDK25U-jdk_x64_linux_hotspot_25.0.4.1_1.tar.gz"
SHA256="dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e"
DEST="$HOME/.local/jdk-25"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -x "$DEST/bin/java" ] && "$DEST/bin/java" -version 2>&1 | grep -q '25\.0\.4'; then echo "JDK already installed"; else
  curl -fL "$URL" -o "$TMP/jdk.tgz"
  echo "$SHA256  $TMP/jdk.tgz" | sha256sum -c -
  rm -rf "$DEST"; mkdir -p "$DEST"
  tar -xzf "$TMP/jdk.tgz" -C "$DEST" --strip-components=1
fi
mkdir -p "$HOME/.gradle"
touch "$HOME/.gradle/gradle.properties"
grep -q '^org.gradle.java.home=' "$HOME/.gradle/gradle.properties" \
  || echo "org.gradle.java.home=$DEST" >> "$HOME/.gradle/gradle.properties"
"$DEST/bin/java" -version
