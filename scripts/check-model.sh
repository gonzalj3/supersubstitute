#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
JAVA_BIN="${JAVA_BIN:-java}"
if [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then JAVA_BIN=/opt/homebrew/opt/openjdk@21/bin/java; fi
if [ ! -f .tools/tla2tools.jar ]; then
  mkdir -p .tools
  curl -fsSL https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar -o .tools/tla2tools.jar
fi
echo '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88  .tools/tla2tools.jar' | shasum -a 256 -c -
cd spec
for model in Classroom Preparation Coverage; do
  "$JAVA_BIN" -XX:+UseParallelGC -cp ../.tools/tla2tools.jar tlc2.TLC -workers 1 -config "$model.cfg" "$model.tla"
done
