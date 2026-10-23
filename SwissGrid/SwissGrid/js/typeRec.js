/*
 * SwissGrid type recommendations.
 * Reads the baseline unit from the grid (Müller-Brockmann: fields are whole lines,
 * gutters are empty lines) and builds a type hierarchy whose leadings are whole
 * (or half) units, so every role sits on the same baseline grid.
 */
(function (root) {
  "use strict";

  function half(v) { return Math.round(v * 2) / 2; }
  function halfDown(v) { return Math.floor(v * 2 + 1e-9) / 2; }
  function r2(v) { return Math.round(v * 100) / 100; }

  /**
   * form: SwissGrid form fields; doc: { width, height, ppi }; grid: GridMath.computeGrid result
   * Returns { unitPt, source, note, fieldUnits, roles: [...], body: {...} }
   */
  function recommend(form, doc, grid, G) {
    var unit = form.unit || "px";
    var cy = { ppi: doc.ppi, size: doc.height, defaultUnit: unit };
    var cx = { ppi: doc.ppi, size: doc.width, defaultUnit: unit };
    var toPt = function (px) { return px * 72 / doc.ppi; };

    var rowGap = G.toPx(form.rowGutter, cy);
    var colGap = G.toPx(form.columnGutter, cx);
    var rows = grid.rows, cols = grid.columns;
    var Lpx = null, source = "", note = "", fieldUnits = null;

    var shortMm = Math.min(doc.width, doc.height) / doc.ppi * 25.4;
    var guessPx = Math.max(8, Math.min(48, Math.round(shortMm / 25))) * 1.2 * doc.ppi / 72;

    if (rows.count && rows.cell && (rowGap === null || rowGap === 0) && toPt(rows.cell) <= 40) {
      Lpx = rows.cell;
      source = "baseline grid (row height = body leading)";
    } else if (rows.count && rows.cell && (rowGap === null || rowGap === 0)) {
      // Tall gutterless rows are fields, not baselines: split each into whole lines.
      var n = Math.max(1, Math.round(rows.cell / guessPx));
      Lpx = rows.cell / n;
      fieldUnits = n;
      source = "row height split into " + n + " lines (rows have no gutter, so the line count is estimated from the canvas)";
    } else if (rows.count && rowGap > 0) {
      Lpx = rowGap;
      source = "row gutter (one empty line = body leading)";
      var k = rows.cell / rowGap;
      if (Math.abs(k - Math.round(k)) < 0.02) fieldUnits = Math.round(k);
      else note = "Fields are " + r2(k) + " lines deep. Müller-Brockmann uses whole lines; try a row height of " +
        r2(Math.round(k) * rowGap) + " px (" + Math.round(k) + " lines).";
    } else if (cols.count && colGap > 0) {
      Lpx = colGap;
      source = "column gutter (estimated, add rows for a precise answer)";
    } else {
      Lpx = guessPx;
      source = "canvas size (estimated, add a baseline grid for a precise answer)";
    }

    var L = toPt(Lpx);
    var bodySize = half(L / 1.2);
    if (bodySize < 5) note = (note ? note + " " : "") + "The unit is very small (" + r2(L) + " pt); check your gutter or row height.";
    if (bodySize > 60) note = (note ? note + " " : "") + "The unit is very large (" + r2(L) + " pt), suited to wall-size posters.";

    function role(name, units, sizeFactor, extra) {
      var leading = r2(L * units);
      return { role: name, size: half(leading / 1.2 * (sizeFactor || 1)), leading: leading, units: units, note: extra || "" };
    }

    var roles = [
      (L / 2 / 1.2 >= 6
        ? role("Caption / credit", 0.5, 1, "2 caption lines = 1 body line")
        : { role: "Caption / credit", size: Math.max(6, half(bodySize * 0.75)), leading: r2(L), units: 1, note: "Smaller size on the body line (half a line would be under 6 pt)" }),
      role("Body", 1, 1, "Regular weight"),
      { role: "Subhead", size: bodySize, leading: r2(L), units: 1, note: "Body size in bold: change one thing (Bringhurst)" },
      role("Heading", 2, 1, ""),
      role("Title", 3, 1, ""),
    ];
    if (fieldUnits && fieldUnits > 3) {
      roles.push(role("Display", fieldUnits, 1, "One line fills one field"));
      roles.push({ role: "Display, tight", size: halfDown(L * fieldUnits), leading: r2(L * fieldUnits), units: fieldUnits, note: "Set solid, one line per field" });
    } else {
      roles.push(role("Display", 4, 1, ""));
      roles.push(role("Display XL", 6, 1, ""));
    }

    // Body measure: which column span gives the best line length (Bringhurst 45-75, ideal 66)?
    var avgCharPx = 0.5 * bodySize * doc.ppi / 72; // average sans character is about half an em
    var spans = [];
    if (cols.count && cols.cell) {
      for (var n = 1; n <= cols.count; n++) {
        var w = n * cols.cell + (n - 1) * (colGap || 0);
        spans.push({ cols: n, chars: Math.round(w / avgCharPx) });
      }
    } else {
      var ml = G.toPx(form.marginLeft, cx) || 0, mr = G.toPx(form.marginRight, cx) || 0;
      spans.push({ cols: 0, chars: Math.round((doc.width - ml - mr) / avgCharPx) });
    }
    var inRange = spans.filter(function (x) { return x.chars >= 45 && x.chars <= 75; });
    var pool = inRange.length ? inRange : spans;
    var best = pool.reduce(function (a, b) { return Math.abs(b.chars - 66) < Math.abs(a.chars - 66) ? b : a; });
    var body = { best: best, spans: spans, ok: best.chars >= 45 && best.chars <= 75 };

    return { unitPt: r2(L), unitMm: r2(L / 72 * 25.4), unitPx: r2(Lpx), lpx: Lpx, isBaseline: source.indexOf("baseline grid") === 0, source: source, note: note, fieldUnits: fieldUnits, roles: roles, body: body };
  }

  var api = { recommend: recommend };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TypeRec = api;
})(typeof window !== "undefined" ? window : globalThis);
