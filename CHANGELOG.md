# Changelog

## 1.2.0 (2026-10-23)

Everything unlocked: licensing switched off (one switch, `SWISS_LICENSING_ON`). The repository is the installable version.

**SwissGrid**
- New: **Suggested grid** in the Grid tab. Recognizes the canvas (A0 to A6, B4, B5, Letter, Legal, Tabloid, square, screen sizes), suggests a Swiss grid with margins, gutters and fields in whole baseline lines, and steps Looser / Denser from 1 to 12 columns. Field shapes: square, golden tall, golden wide, Fibonacci. Thumbnail preview, specs, Apply suggestion and Edit in fields.
- New: presets grouped into Classic Swiss, Golden ratio & Fibonacci, Letter, A2, A3, A4, A5 and My presets, collapsible, with the canvas's group opened automatically.
- New: built-in presets for Letter, A2, A3, A4 and A5 (classic, dense, fine, baseline), in mm, and Fibonacci presets for A4, A3 and Letter.
- New: four tabs (Grid, Type sizes, Document, Presets) so everything stays near the top on Windows machines where Photoshop cuts off the bottom of the panel.
- New: Copy diagnostics (Document tab).
- Grids are also saved to a shared file on the computer, so SwissType finds them even when Photoshop won't let scripts write into the document.
- Each field grid stores its recommended body leading so SwissType can offer the matching baseline.
- Scrolling works in every CEP version (own scroll container, wheel fallback, Page Up/Down, Home/End).
- Dock icons ship at 23 px and 46 px (@2x).

**SwissType**
- New: grids from SwissGrid's shared file, plus a **calculated baseline** for field grids, picked automatically.
- New: Copy diagnostics (Align tab).
- Long lists (type scale, styles) scroll inside their own box.

## 1.1.x

- Type sizes **Apply** sets size and leading on the selected text layers (Character panel commands, read back and verified).
- No more "Waiting for printer connection": no full-document reads and no needless preference writes.
- Unit switching converts the fields exactly; rounding no longer breaks a grid; clearer "doesn't fit" errors.
- SwissType Measure reads paragraph box widths correctly at any resolution.
- Apply matching baseline (+ Baseline).
- SwissType reads SwissGrid's grids and snaps to them.
- Gumroad licensing, Mac installers, release builder.

## 1.0.0

- SwissGrid: GuideGuide-style grids with per-grid colors, presets, colored grid layers for Photoshop 2022, type size recommendations.
- SwissType: baseline snap, optical edge align, type scales, measure checker, text styles.
