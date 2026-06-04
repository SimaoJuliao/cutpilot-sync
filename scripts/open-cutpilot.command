#!/bin/bash
# Removes the macOS quarantine flag and opens CutPilot Sync.
# Run this once after dragging CutPilot Sync to your Applications folder.

APP="/Applications/CutPilot Sync.app"

if [ ! -d "$APP" ]; then
  osascript -e 'display alert "CutPilot Sync not found" message "Please drag CutPilot Sync to your Applications folder first, then run this script." as warning'
  exit 1
fi

xattr -cr "$APP"
open "$APP"
