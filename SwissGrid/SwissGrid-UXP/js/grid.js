/*
 * SwissGrid grid math. Pure functions, no Photoshop dependencies,
 * so the same code runs in the panel and in tests.
 *
 * Columns produce VERTICAL guides (x positions).
 * Rows produce HORIZONTAL guides (y positions).
 * All results are in document pixels.
 */
(function (root) {
  "use strict";

  var UNITS = ["px", "mm", "cm", "in", "pt", "%"];
  var EPS = 0.0005;

  /**
   * Parse a field like "15.24mm", "75px", "12", "5%".
   * Returns null for an empty field.
   * ctx: { ppi, size, defaultUnit }  (size = axis length in px, for %)
   */
  function toPx(raw, ctx) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).trim().toLowerCase().replace(",", ".");
    if (s === "") return null;
    var m = s.match(/^(-?\d*\.?\d+)\s*(px|mm|cm|in|pt|%)?$/);
    if (!m) throw new Error('Can\'t read "' + raw + '". Use a number, optionally with px, mm, cm, in, pt or %.');
    var v = parseFloat(m[1]);
    var unit = m[2] || ctx.defaultUnit || "px";
    switch (unit) {
      case "px": return v;
      case "mm": return (v / 25.4) * ctx.ppi;
      case "cm": return (v / 2.54) * ctx.ppi;
      case "in": return v * ctx.ppi;
      case "pt": return (v / 72) * ctx.ppi;
      case "%": return (v / 100) * ctx.size;
    }
    throw new Error("Unknown unit " + unit);
  }

  function toCount(raw, label) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).trim();
    if (s === "") return null;
    var n = Number(s);
    if (!Number.isInteger(n) || n < 1) throw new Error(label + " must be a whole number of 1 or more.");
    return n;
  }

  function dedupe(list) {
    var sorted = list.slice().sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < sorted.length; i++) {
      if (!out.length || Math.abs(sorted[i] - out[out.length - 1]) > EPS) out.push(sorted[i]);
    }
    return out;
  }

  function round4(v) { return Math.round(v * 10000) / 10000; }

  /**
   * One axis.
   * opts: { size, start, end, count, cell, gutter, align ("start"|"center"|"end"), midpoint }
   * start/end are margins in px (null = none).
   */
  function axisLines(opts, axisName) {
    var size = opts.size;
    var s = opts.start || 0;
    var e = opts.end || 0;
    var g = opts.gutter || 0;
    var count = opts.count;
    var cell = opts.cell;
    var lines = [];

    if (opts.start !== null && opts.start > 0) lines.push(s);
    if (opts.end !== null && opts.end > 0) lines.push(size - e);
    if (opts.midpoint) lines.push(size / 2);

    var avail = size - s - e;
    if (avail <= 0) throw new Error(axisName + ": the margins leave no space.");

    if (count !== null || cell !== null) {
      if (g < 0) throw new Error(axisName + ": gutter can't be negative.");
      if (cell === null) {
        cell = (avail - (count - 1) * g) / count;
        if (cell <= 0) throw new Error(axisName + ": the gutters leave no space for " + count + " " + (axisName === "Columns" ? "columns" : "rows") + ".");
      }
      if (cell <= 0) throw new Error(axisName + ": width and height must be greater than 0.");
      if (count === null) {
        count = Math.floor((avail + g + EPS) / (cell + g));
        if (count < 1) throw new Error(axisName + ": one cell doesn't fit between the margins.");
      }
      var total = count * cell + (count - 1) * g;
      // Up to 1 px over is rounding from unit conversion (e.g. 262 px shown as 22.183 mm): fit it exactly.
      if (total > avail + 0.01 && total <= avail + 1) {
        cell = (avail - (count - 1) * g) / count;
        total = avail;
      }
      if (total > avail + 0.01) {
        var f = opts.fmt || function (v) { return round4(v) + " px"; };
        var noun = axisName === "Columns" ? ["columns", "width", "wide"] : ["rows", "height", "tall"];
        throw new Error(axisName + " don't fit: " + count + " " + noun[0] + " of " + f(cell) +
          (count > 1 ? " plus " + (count - 1) + " gutters of " + f(g) : "") + " need " + f(total) +
          ", but there's only " + f(avail) + " between the margins. Make the " + noun[1] + ", gutter or margins smaller, or leave " +
          (axisName === "Columns" ? "Width" : "Height") + " blank and it's calculated.");
      }
      var offset = s;
      if (opts.align === "center") offset = s + (avail - total) / 2;
      if (opts.align === "end") offset = s + (avail - total);
      for (var i = 0; i < count; i++) {
        var a = offset + i * (cell + g);
        lines.push(a, a + cell);
      }
    }

    return {
      lines: dedupe(lines).filter(function (v) { return v >= -EPS && v <= size + EPS; }).map(round4),
      count: count,
      cell: cell === null || cell === undefined ? null : round4(cell),
    };
  }

  /**
   * form: field strings, see FIELDS in main.js
   * doc:  { width, height, ppi }  (px, px, pixels per inch)
   */
  function computeGrid(form, doc) {
    var unit = form.unit || "px";
    var cx = { ppi: doc.ppi, size: doc.width, defaultUnit: unit };
    var cy = { ppi: doc.ppi, size: doc.height, defaultUnit: unit };

    var cols = axisLines({
      size: doc.width,
      start: toPx(form.marginLeft, cx),
      end: toPx(form.marginRight, cx),
      count: toCount(form.columns, "Columns"),
      cell: toPx(form.columnWidth, cx),
      gutter: toPx(form.columnGutter, cx),
      align: form.alignH || "start",
      midpoint: !!form.midVertical,
      fmt: doc.fmt,
    }, "Columns");

    var rows = axisLines({
      size: doc.height,
      start: toPx(form.marginTop, cy),
      end: toPx(form.marginBottom, cy),
      count: toCount(form.rows, "Rows"),
      cell: toPx(form.rowHeight, cy),
      gutter: toPx(form.rowGutter, cy),
      align: form.alignV || "start",
      midpoint: !!form.midHorizontal,
      fmt: doc.fmt,
    }, "Rows");

    return { vertical: cols.lines, horizontal: rows.lines, columns: cols, rows: rows };
  }

  function hexToRgb(hex) {
    var h = String(hex || "").trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('"' + hex + '" isn\'t a color. Use a hex value like #00AEEF.');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      var x = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return x.length === 1 ? "0" + x : x;
    }).join("").toUpperCase();
  }

  var api = { UNITS: UNITS, toPx: toPx, toCount: toCount, axisLines: axisLines, computeGrid: computeGrid, hexToRgb: hexToRgb, rgbToHex: rgbToHex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GridMath = api;
})(typeof window !== "undefined" ? window : globalThis);
