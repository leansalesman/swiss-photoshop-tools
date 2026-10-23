#!/bin/bash
# SwissGrid panel installer for Photoshop (macOS)
cd "$(dirname "$0")" || exit 1
echo ""
echo " SwissGrid panel installer for Photoshop (macOS)"
echo " -----------------------------------------"
echo ""
echo " 1. Allowing your own (unsigned) panels in Photoshop..."
for v in 9 10 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo "    Done."
echo ""
echo " 2. Copying SwissGrid to your extensions folder..."
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/SwissGrid"
if [ ! -d "SwissGrid" ]; then
  echo "    Can't find the SwissGrid folder. Keep this file next to it and run it again."
  read -n 1 -s -r -p " Press any key to close."; exit 1
fi
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "SwissGrid" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
echo "    Installed to: $DEST"
echo ""
echo " 3. Quit and reopen Photoshop, then open:"
echo "    Window > Extensions (legacy) > SwissGrid"
echo ""
read -n 1 -s -r -p " Press any key to close."
echo ""
