==============================================================================
 SWISSTYPE  |  Typography tools for Photoshop
 Version 1.0  |  Built for Joseph Martinez
==============================================================================

SwissType is a panel for Photoshop that helps you set type the Swiss way:
every line sitting on one baseline grid, sizes from a proper type scale,
comfortable line lengths, and reusable text styles. It is designed to work
together with SwissGrid.

Works with: Photoshop CC 2019 to 2024 on Windows, including Photoshop 2022.
Needs: nothing else. No Creative Cloud app, no Adobe installer.


------------------------------------------------------------------------------
 CONTENTS
------------------------------------------------------------------------------

  1. Install
  2. Opening the panel
  3. The basics (read this first)
  4. Align tab: Baseline Snap
  5. Align tab: Optical Edge Align
  6. Scale tab: Type Scale
  7. Measure tab: Measure Checker
  8. Styles tab: Text Styles
  9. A typical workflow with SwissGrid
 10. Tips
 11. Troubleshooting
 12. Uninstall
 13. Files in this folder


------------------------------------------------------------------------------
 1. INSTALL
------------------------------------------------------------------------------

  1. Unzip this folder somewhere permanent (for example Documents).
  2. Close Photoshop.
  3. Double-click  Install-SwissType.bat
     It does two things:
       a) Allows your own (unsigned) panels in Photoshop. This writes one
          setting, PlayerDebugMode = 1, under
          HKEY_CURRENT_USER\Software\Adobe\CSXS.9 to CSXS.12
          (your Windows user only, no admin rights needed).
       b) Copies the SwissType folder to
          %APPDATA%\Adobe\CEP\extensions\SwissType
  4. Start Photoshop.

  If you already installed SwissGrid, step (a) is already done. Running it
  again is harmless.

  Manual install (if you prefer not to run the .bat):
    - Copy the SwissType folder into  %APPDATA%\Adobe\CEP\extensions\
      (paste %APPDATA% into the File Explorer address bar to get there).
    - In the Registry Editor, under HKEY_CURRENT_USER\Software\Adobe\CSXS.11,
      add a String Value named PlayerDebugMode with the value 1.
      (CSXS.11 is the one Photoshop 2022 uses.)


------------------------------------------------------------------------------
 2. OPENING THE PANEL
------------------------------------------------------------------------------

  Window > Extensions (legacy) > SwissType

  Leave it floating, or drag its tab into a sidebar dock (next to Layers,
  Properties or your SwissGrid panel). Photoshop remembers where you put it.


------------------------------------------------------------------------------
 3. THE BASICS (READ THIS FIRST)
------------------------------------------------------------------------------

  Top of the panel:
    Line 1: the open document, its size, resolution, and how many
            horizontal / vertical guides it has.
    Line 2: the selected text layer, its font, size/leading and tracking.
            Updates every couple of seconds as you click around.

  Four tabs: ALIGN, SCALE, MEASURE, STYLES.

  Everything works on the SELECTED TEXT LAYERS.
    - Select one or several layers in the Layers panel
      (Ctrl+click to select several).
    - Non-text layers in the selection are skipped automatically.

  Undo:
    Every action is ONE step in History, so Ctrl+Z undoes it completely.

  Messages:
    The line at the bottom of the panel tells you what happened.
    Green = done. Red = something to fix (it says what).

  Baseline = the invisible line letters sit on (the bottom of f, l, r).
  Descenders (y, p, g) hang below it. Round letters (o, e) dip a hair below
  it on purpose. SwissType always works with the true baseline.


------------------------------------------------------------------------------
 4. ALIGN TAB: BASELINE SNAP
------------------------------------------------------------------------------

  What it does:
    Moves each selected text layer up or down so its FIRST baseline lands
    exactly on a baseline line. This replaces zooming in and nudging with
    the arrow keys.

  Settings:
    Snap to
      - Nearest horizontal guide: uses the guides already in your document,
        for example the baseline grid you added with SwissGrid
        ("Text Baseline 6x6 Swiss Grid", "A4 Baseline 10/12" and so on).
      - Baseline grid: no guides needed. SwissType calculates the lines
        from a Top value and a Unit.

    Grid (only for "Baseline grid")
      From SwissGrid (this document):
        Every grid you apply with SwissGrid is saved inside the .psd, and
        it shows up here by name, for example
        "Swiss Pop A3 Baseline 48 (top 118, line 48 px)".
        Pick one and Top and Unit fill in by themselves and lock, and the
        snap uses that grid's lines exactly as SwissGrid drew them.
        If the document has a baseline grid (evenly spaced lines, 40 pt or
        less apart), SwissType picks it for you when you open the document
        or apply a new grid. Grids applied before this update are not in
        the list: apply them once more in SwissGrid.
      Quick choices that match your SwissGrid presets:
        6x6 Square ............ top 15.24 mm, unit 5.08 mm
        A3 Poster ............. top 118 px,   unit 75 px
        A4 or Letter 10/12 .... top 200 px,   unit 50 px
      Or type your own Top and Unit. Units allowed: mm, px, in, cm, pt, %.
      Example: Top 15.24mm, Unit 5.08mm.

    Direction
      Nearest .... moves to whichever line is closest.
      Up only .... only moves the text up.
      Down only .. only moves the text down.

  How to use:
    1. Select the text layer(s).
    2. Choose Snap to, (Grid / Top / Unit if needed) and Direction.
    3. Click "Snap baseline".
    The message shows how far each layer moved, for example
    "foryour pleasure: -25 px".

  Works on:
    - Point text (click-and-type text).
    - Paragraph text (text in a box). SwissType measures the first line's
      baseline for you.

  Tip: once the first baseline is on the grid, every following line lands
  on the grid too, as long as the leading equals the unit (or a multiple).
  The Scale tab sets that for you.


------------------------------------------------------------------------------
 5. ALIGN TAB: OPTICAL EDGE ALIGN
------------------------------------------------------------------------------

  What it does:
    Aligns the LETTERS THEMSELVES, not the invisible text box, to the
    nearest guide. Letters carry a little built-in space on their sides
    (that is why your "f" didn't touch the margin guide). This fixes it.

  Buttons:
    Left edge ..... moves the layer so the leftmost ink touches the nearest
                    vertical guide. Use for flush-left headlines.
    Right edge .... rightmost ink to the nearest vertical guide. Use to end
                    a headline exactly on a column edge.
    Top edge ...... top of the tallest letter to the nearest horizontal guide.
    Bottom edge ... lowest ink (including descenders) to the nearest
                    horizontal guide.

  How to use:
    1. Make sure the guide you want is the closest one to that edge.
    2. Select the text layer(s), click the edge button.

  Note: for body text, use Baseline Snap for vertical position. Top and
  Bottom edge are meant for large display type.


------------------------------------------------------------------------------
 6. SCALE TAB: TYPE SCALE
------------------------------------------------------------------------------

  What it does:
    Shows a list of type sizes, each with a leading that is a whole number
    of baseline units, so every size you use stays on the same grid.
    "Apply" sets the selected text to that size and leading in one click.

  Settings:
    Body .... your body text size in pt (12 for your 6x6 square grid,
              10 for A4/Letter, 15 for the A3 poster).
    Unit .... your baseline unit = the body leading. Type it in pt
              (14.4) or with a unit (5.08mm). Tip: SwissGrid's
              "Type sizes for this grid" section shows the unit for any grid.
    Scale ... which family of sizes to show:
              Fibonacci (Bringhurst) . 6 8 10 13 16 21 26 34 42 55 68 89 ...
              Traditional ............ 6 7 8 9 10 11 12 14 16 18 21 24 36 ...
              Golden ratio 1.618 ..... each size 1.618 x the last
              Perfect fifth 1.5, Perfect fourth 1.333, Major third 1.25
    Leading . minimum line spacing relative to size (1.2 x is a good
              default; use 1.3 for long reading text or sans serifs).

    Tight leading for display sizes (36 pt and up)
      ON: big type is set solid or close to it (leading about equal to the
          size), which makes headlines read as one block. Swiss posters do
          this.
      OFF: big type keeps the normal 1.2 x spacing.

    Snap baseline after applying (uses Align settings)
      ON: after changing the size, SwissType re-snaps the baseline using
          the settings on the Align tab. Recommended.

  Reading the list:
    "Aa 12   / 14.4 pt . 1 unit   [Apply]"
      12 ........ type size (pt)
      14.4 pt ... leading to use
      1 unit .... how many baseline lines one line of this text takes
    Your body size is highlighted. Small sizes (under about 70% of body)
    use half units, so two caption lines fit exactly in one body line.

  How to use:
    1. Select the text layer(s).
    2. Click Apply next to the size you want.

  Example for your 6x6 grid (Body 12, Unit 14.4, Fibonacci, tight on):
    6/7.2 caption, 12/14.4 body, 21/28.8 subheading, 42/43.2 headline,
    68/72 display.


------------------------------------------------------------------------------
 7. MEASURE TAB: MEASURE CHECKER
------------------------------------------------------------------------------

  What it does:
    Tells you if your line length (the "measure") is comfortable to read,
    using Robert Bringhurst's method from The Elements of Typographic Style.

  Settings:
    Setting
      Single column ...... target 45 to 75 characters per line, ideal 66.
      Multi-column ....... target 40 to 50 characters per line.

  How to use:
    1. Select ONE text layer (if several are selected, the first is used).
    2. Click "Measure selected text".

  Results:
    Big number ........... characters per line.
    Verdict .............. green = comfortable or ideal,
                           yellow = a bit short or long,
                           red = too short or too long.
    Words per line ....... characters divided by 6 (average word + space).
    Measure .............. line length in pt and mm.
    Measure / type size .. Bringhurst says books usually sit around 30 x the
                           type size (20 to 40 x is normal).
    Type ................. font, size and whether it is point or paragraph text.
    For 66 characters .... the measure (in mm) or the type size that would
                           give the ideal line length. Use it to resize the
                           text box or change the size.
    Rag chart ............ (point text with line breaks only) one bar per
                           line, colored by length, so you can spot lines
                           that are too short or too long and fix the rag.

  How it measures:
    It briefly creates a sample line "abcdefghijklmnopqrstuvwxyz" in the same
    font, size and tracking, measures it, and deletes it. This is
    Bringhurst's copyfitting method. You will see a "SwissType: Measure"
    step in History; your artwork is not changed.

  Note: for headlines a "too short" verdict is normal. The checker is meant
  for body text and captions.


------------------------------------------------------------------------------
 8. STYLES TAB: TEXT STYLES
------------------------------------------------------------------------------

  What it does:
    Saves the look of a text layer as a named style and applies it to other
    text layers in one click. Like InDesign's paragraph styles, but simple.

  A style stores:
    Font, size, leading, tracking, color, case (normal / all caps / small
    caps) and alignment.

  Save a style:
    1. Select a text layer that already looks right.
    2. Type a name in the box (for example "Body 12/14.4").
    3. Click "Save from selected".
    Saving with an existing name replaces that style.

  Apply a style:
    1. Select the text layer(s) to change.
    2. Tick the parts you want to apply ("Apply these parts"). For example,
       untick Color to change everything except the color.
    3. Click Apply next to the style.

  Other buttons:
    Update ...... replaces the style with the selected layer's look.
    X ........... deletes the style.
    Export... ... saves all styles to a .json file (backup, or to move them
                  to another computer).
    Import... ... loads styles from a .json file (styles with the same name
                  are replaced).

  Suggested starter styles for your 6x6 square grid:
    Caption 6/7.2 ...... Neue Haas 55 Roman, 6 pt / 7.2 pt, tracking +10
    Body 12/14.4 ....... Neue Haas 55 Roman, 12 pt / 14.4 pt, tracking 0
    Subhead 12/14.4 .... Neue Haas 75 Bold, 12 pt / 14.4 pt
    Display 72/86.4 .... Neue Haas 75 Bold, 72 pt / 86.4 pt, tracking -20


------------------------------------------------------------------------------
 9. A TYPICAL WORKFLOW WITH SWISSGRID
------------------------------------------------------------------------------

  1. SwissGrid: apply your field grid (for example "6x6 Square Swiss Grid")
     and its baseline grid ("Text Baseline 6x6 Swiss Grid").
  2. SwissGrid: read "Type sizes for this grid" for your unit (14.4 pt) and
     body size (12 pt).
  3. SwissType > Align: Snap to "Baseline grid". The Grid menu already
     shows your SwissGrid baseline grid; leave it selected.
  4. SwissType > Scale: enter Body 12 and Unit 14.4.
  5. Type your headline. Select it, Apply a display size (for example 68 or
     72). With "Snap baseline after applying" on, it lands on the grid.
  6. SwissType > Align: Left edge, so the letters sit exactly on the margin.
  7. Type your body text in a box as wide as the columns it should span.
     Apply 12/14.4. Check it on the Measure tab (aim for about 45 to 75
     characters per line).
  8. Save the looks you like on the Styles tab and reuse them on the next
     poster.


------------------------------------------------------------------------------
 10. TIPS
------------------------------------------------------------------------------

  - Keep the ruler origin at the top-left corner (double-click where the
    rulers meet to reset it). Guides and grids are measured from there.
  - If you scaled a text layer with Free Transform, Photoshop may report a
    different size than you see. After applying a size in SwissType, the
    Character panel shows the true value.
  - Tight tracking (-20) is for big display type only. Body text and
    captions read best at 0 or slightly positive tracking.
  - Hide your SwissGrid layers before exporting your artwork.


------------------------------------------------------------------------------
 11. TROUBLESHOOTING
------------------------------------------------------------------------------

  SwissType is not in Window > Extensions (legacy)
    - Check the folder exists:
      %APPDATA%\Adobe\CEP\extensions\SwissType\CSXS\manifest.xml
    - Run Install-SwissType.bat again, then restart Photoshop.

  "The extension could not be loaded because it was not properly signed"
    - The registry setting did not take. Run Install-SwissType.bat again
      (no admin needed) and restart Photoshop.

  The panel is blank or says "Not running inside Photoshop"
    - Close and reopen the panel from the Window menu. If it persists,
      restart Photoshop.

  "Select a text layer first"
    - Click a text layer (the T icon) in the Layers panel, not a group.

  "No horizontal guides"
    - Add a baseline grid with SwissGrid, or switch "Snap to" to
      "Baseline grid".

  Text snapped to the wrong line
    - Use Direction "Up only" or "Down only", or check the ruler origin.

  Something looks wrong after an action
    - Ctrl+Z undoes the whole action. Send a screenshot to Claude.


------------------------------------------------------------------------------
 12. UNINSTALL
------------------------------------------------------------------------------

  Double-click  Uninstall-SwissType.bat , then restart Photoshop.
  (It removes the panel folder. The registry setting is left in place
  because SwissGrid uses it too.)


------------------------------------------------------------------------------
 13. FILES IN THIS FOLDER
------------------------------------------------------------------------------

  readme.txt ................. this file
  README.md .................. shorter version of this guide
  Install-SwissType.bat ...... installer
  Uninstall-SwissType.bat .... uninstaller
  SwissType\
    CSXS\manifest.xml ........ tells Photoshop about the panel
    index.html ............... panel layout
    css\panel.css ............ panel look (follows Photoshop's theme)
    js\panel.js .............. panel logic
    js\type.js ............... type scale and measure math
    js\grid.js ............... unit conversion
    jsx\host.jsx ............. the Photoshop side (moves, sizes and styles text)
    icons\icon.png ........... panel icon

==============================================================================
