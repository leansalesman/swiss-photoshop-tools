#!/bin/bash
# Removes the SwissType panel (macOS). Your license and presets on other panels are untouched.
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/SwissType"
if [ -d "$DEST" ]; then rm -rf "$DEST"; echo " SwissType removed. Restart Photoshop."; else echo " SwissType isn't installed."; fi
read -n 1 -s -r -p " Press any key to close."
echo ""
