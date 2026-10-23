# SwissType panel

Typography tools for Photoshop, built to work with SwissGrid: baseline snapping, grid-locked type scales, a measure checker, text styles and optical edge alignment, in one dockable panel.

Works with Photoshop CC 2019 through 2024 on Windows, including Photoshop 2022. No Creative Cloud app or Adobe installer needed.

## Install

1. Unzip this folder anywhere permanent.
2. Double-click **Install-SwissType.bat** (same as SwissGrid: allows your own unsigned panels for your user, then copies the panel to `%APPDATA%\Adobe\CEP\extensions\SwissType`).
3. Restart Photoshop and open **Window > Extensions (legacy) > SwissType**.
4. Dock it next to SwissGrid, or leave it floating.

Remove it with **Uninstall-SwissType.bat**.

## The four tabs

All tools work on the **selected text layers** (select several in the Layers panel to do them all at once; non-text layers are skipped). Each action is one History step, so Ctrl+Z undoes it.

### Align
- **Baseline snap:** moves each selected text layer so its first baseline sits on a line.
  - *Baseline grid:* the Grid menu lists every grid SwissGrid applied to this document (saved inside the .psd). Pick one, or let SwissType pick the baseline grid for you, and Top and Unit fill in automatically.
  - *Nearest horizontal guide:* uses your SwissGrid baseline guides.
  - *Baseline grid:* no guides needed. Pick a grid (6x6 Square, A3 Poster, A4/Letter) or type the top and unit (`15.24mm` and `5.08mm`, or px).
  - *Direction:* nearest, up only or down only.
  - Works on point text and paragraph text.
- **Optical edge align:** moves the letters themselves (not the text box) so their left, right, top or bottom edge sits on the nearest guide. This fixes the built-in space beside letters like f.

### Scale
- Enter your body size and baseline unit (12 and 14.4 for your grids).
- Pick a scale: Fibonacci (Bringhurst's 6 8 10 13 16 21 26 34 42 55 68…), Traditional (6 to 72), Golden ratio, Perfect fifth, Perfect fourth or Major third.
- Every size gets a leading that's a whole number of baseline units (or half a unit for small captions), so everything lines up on the grid. "Tight leading for display" sets 36 pt and up solid or close to it.
- **Apply** sets the selected layers to that size and leading, and (if ticked) snaps them to the baseline.

### Measure
- **Measure selected text** shows characters per line using Bringhurst's method (the length of the lowercase alphabet in that font and size), words per line, measure in pt and mm, and measure ÷ type size.
- Verdict against 45–75 characters (ideal 66) or 40–50 for multi-column work, with the measure or size that would give the ideal.
- Point text with line breaks also shows a **rag chart**: one bar per line, colored by length.

### Styles
- Select a styled text layer, name the style, **Save from selected**. It stores font, size, leading, tracking, color, case and alignment.
- **Apply** to any selected text layers. Use the checkboxes to apply only some parts (for example only size and leading).
- **Update** replaces a style with the selected layer's look. **Export / Import** moves styles between computers.

## Notes

- Measuring adds a "SwissType: Measure" step to History (it briefly creates and deletes a sample text layer). It doesn't change your artwork.
- If a text layer has been scaled with Free Transform, Photoshop may report its size differently from what you see; check the Character panel after applying.
- Reset the ruler origin (double-click where the rulers meet) if you've moved it, so positions match your grid.
