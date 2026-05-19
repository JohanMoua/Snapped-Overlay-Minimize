#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ID="snapped-overlap-minimize"

cd "$(dirname "$0")"

if [[ ! -f metadata.json ]]; then
  echo "Error: metadata.json is missing from the repo root."
  exit 1
fi

if [[ ! -f contents/code/main.js ]]; then
  echo "Error: contents/code/main.js is missing."
  echo
  echo "Expected layout:"
  echo "  metadata.json"
  echo "  contents/code/main.js"
  exit 1
fi

if kpackagetool6 --type=KWin/Script --show "$SCRIPT_ID" >/dev/null 2>&1; then
  echo "Updating ${SCRIPT_ID}..."
  kpackagetool6 --type=KWin/Script --upgrade .
else
  echo "Installing ${SCRIPT_ID}..."
  kpackagetool6 --type=KWin/Script --install .
fi

kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT_ID}Enabled" true

# Reload quietly. unloadScript prints true/false, so suppress it.
qdbus6 org.kde.KWin /Scripting unloadScript "$SCRIPT_ID" >/dev/null 2>&1 || true
qdbus6 org.kde.KWin /Scripting start >/dev/null 2>&1 || true
qdbus6 org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true

echo "Installed and enabled ${SCRIPT_ID}."
