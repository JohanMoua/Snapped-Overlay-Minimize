#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ID="snapped-overlap-minimize"

kwriteconfig6 --file kwinrc --group Plugins --key "${SCRIPT_ID}Enabled" false
qdbus-qt6 org.kde.KWin /Scripting unloadScript "$SCRIPT_ID" 2>/dev/null || true
kpackagetool6 --type=KWin/Script -r "$SCRIPT_ID" 2>/dev/null || true
qdbus-qt6 org.kde.KWin /KWin reconfigure

echo "Uninstalled ${SCRIPT_ID}."
