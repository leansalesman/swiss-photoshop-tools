# SwissGrid panel

A dockable or floating Photoshop panel for building grids like GuideGuide. Every grid gets its own color, grids stack, and the panel stays open while you work on your canvas.

Works with Photoshop CC 2019 through 2024 on Windows, including Photoshop 2022. No Creative Cloud app, UXP Developer Tool or Adobe installer needed.

## Install

1. Unzip this folder anywhere.
2. Double-click **Install-SwissGrid.bat**. It does two things:
   - turns on Photoshop's setting for your own unsigned panels (`PlayerDebugMode = 1` under `HKEY_CURRENT_USER\Software\Adobe\CSXS.9` to `CSXS.12`, current user only), and
   - copies the `SwissGrid` folder to `%APPDATA%\Adobe\CEP\extensions\SwissGrid`.
3. Restart Photoshop.
4. Open **Window > Extensions (legacy) > SwissGrid**.
5. Leave it floating, or drag its tab into a sidebar dock (next to Layers or Properties). Photoshop remembers where you put it.

Manual install, if you'd rather not run a .bat: copy the `SwissGrid` folder into `%APPDATA%\Adobe\CEP\extensions\` and add the registry value above for `CSXS.11` (Photoshop 2022).

To remove it: **Uninstall-SwissGrid.bat**.

## Using the panel

- **Tabs:** Grid, Type sizes, Document and Presets, so everything stays near the top of the panel.
- **Suggested grid (Grid tab):** SwissGrid recognizes the canvas (A0 to A6, Letter, Legal, Tabloid, square, social sizes) and suggests a Swiss grid for it. Use Columns and Rows (+/-), or Looser / Denser, to go from 1 up to 12 columns; rows follow automatically for Square, Golden (tall or wide) or Fibonacci fields, or set them yourself. Margins, gutters and fields are whole baseline lines, and the body size and leading are shown. **Apply suggestion** draws it; **Edit in fields** loads it into the form to fine-tune.
- **Presets** are grouped: Classic Swiss, Golden ratio & Fibonacci, Letter, A2, A3, A4, A5 and My presets. The group for your canvas opens automatically. Paper presets are in mm, so they work at any resolution.
- **Name and color:** name the grid, click the color square (opens a color picker), type a hex value, or click a swatch.
- **Draw as:**
  - **Guides + colored layer (default):** guides for snapping, plus the grid drawn in your color on a locked layer named `SwissGrid · <grid name>`.
  - **Colored layer only.**
  - **Guides only:** on Photoshop 2023+ guides take your color. On Photoshop 2022 guides can only use one global color, which is why the colored layer exists.
- **Line:** thickness of the drawn lines, 1 to 4 px.
- **Unit:** applies to fields without a unit. Any field can include its own: `15.24mm`, `75px`, `1in`, `12pt`, `5%`.
- **Switching units converts your numbers.** Change the Unit menu and every margin, width, height and gutter is rewritten in the new unit (15.24 mm becomes 180 px at 300 ppi). Switching back and forth never drifts. If you had typed numbers meant for the new unit (px numbers while mm was selected), click **Keep the numbers instead** in the status line and they go back exactly as typed.
- **Columns / Rows:** margins, count, width or height, gutter, position, midpoint. Leave Width or Height blank and it's calculated.
- **Live preview:** the line under the fields shows the result as you type (for example `6 col × 30.48 mm · 6 row × 30.48 mm · 24 lines`), or what's wrong.
- **Type sizes for this grid:** recommended size/leading for Caption, Body, Subhead, Heading, Title and Display, all locked to the grid's baseline. The unit comes from a baseline grid's row height, or a field grid's row gutter (one empty line), or is estimated from the canvas. It also says how many columns body text should span for 45–75 characters per line.
- **Apply (type sizes):** select one or more text layers in Photoshop, then click **Apply** on a row. The size and leading are set on every selected text layer (non-text layers are skipped), as one History step. Right-click **Apply** to copy the value (`12/14.4 pt`) instead.
- Gutterless rows taller than 40 pt are read as fields, not baselines: each row is split into whole lines sized to the canvas.
- **Apply matching baseline:** adds the baseline grid that belongs to the grid in the inputs, using the same line the type sizes use (body leading). It runs from the top of the first field to the bottom of the last, gets its own color and a name like `Swiss Pop A3 Grid 12x10 Baseline 14.4 pt`, and SwissType picks it up for snapping. Your inputs stay as they are.
- **Apply grid** (or press Enter in any field). Change measurements and color and apply again: grids stack.
- **On this document:** every grid you've applied, with its color, top and line height (e.g. `top 118 · line 48 px`). Each grid is also saved inside the .psd so SwissType can snap text to it (SwissType > Align > Grid). **Hide/Show** toggles that grid's layer. **Remove** deletes that grid's guides and layer.
- **Clear all grids:** removes every guide and every SwissGrid layer in the document.
- **Save preset / Clear inputs / Presets (Load, Apply, ✕) / Export… / Import…**
- Every apply, remove and clear is one History step, so Ctrl+Z undoes it.

**Before exporting your artwork, hide or remove the SwissGrid layers.**

Starter presets: 6x6 Square Swiss Grid (blue), Text Baseline 6x6 Swiss Grid (red), A3 Poster 4x4 + Center Cross (cyan), A3 Poster Baseline (magenta).

## Troubleshooting

- **Not in Window > Extensions (legacy):** check the folder is at `%APPDATA%\Adobe\CEP\extensions\SwissGrid` with `CSXS\manifest.xml` inside, rerun the installer, restart Photoshop.
- **"Extension could not be loaded because it was not properly signed":** the registry step didn't take. Rerun the installer (it writes to your user only, no admin needed).
- **Grid lands in the wrong place:** reset the ruler origin (double-click where the rulers meet).

## Files

- `SwissGrid/index.html`, `css/panel.css`, `js/panel.js`: the panel.
- `SwissGrid/js/grid.js`: grid math.
- `SwissGrid/jsx/host.jsx`: the Photoshop side that draws and removes grids.
- `SwissGrid/CSXS/manifest.xml`: tells Photoshop about the panel.
