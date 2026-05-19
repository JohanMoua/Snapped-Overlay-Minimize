#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ID="snapped-overlap-minimize"

kpackagetool6 --type=KWin/Script -u . 2>/dev/null || \
kpackagetool6 --type=KWin/Script -i .

kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT_ID}Enabled" true

qdbus-qt6 org.kde.KWin /Scripting unloadScript "$SCRIPT_ID" 2>/dev/null || true
qdbus-qt6 org.kde.KWin /Scripting start
qdbus-qt6 org.kde.KWin /KWin reconfigure

echo "Installed and enabled ${SCRIPT_ID}."
