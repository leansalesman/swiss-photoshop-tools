/*
 * SwissGrid suggestions: canvas-aware Swiss grids (Mueller-Brockmann method).
 *
 *   1. Body size from the canvas (short side / 24 mm, whole points, 8 pt minimum).
 *   2. One baseline line = body leading (1.2 x body). Everything is a whole number of lines:
 *      margins, gutters (one empty line), and field heights.
 *   3. Columns 1-12; rows chosen so fields come closest to the module shape
 *      (square, golden tall, golden wide, or Fibonacci), or set by the user.
 *   4. Left-over lines go to the bottom margin, which is always the heaviest.
 *
 * Output forms use mm, so they work at any resolution.
 */
(function (root) {
  "use strict";

  var PAPERS = [
    { id: "A0", w: 841, h: 1189 }, { id: "A1", w: 594, h: 841 }, { id: "A2", w: 420, h: 594 },
    { id: "A3", w: 297, h: 420 }, { id: "A4", w: 210, h: 297 }, { id: "A5", w: 148, h: 210 }, { id: "A6", w: 105, h: 148 },
    { id: "Letter", w: 215.9, h: 279.4 }, { id: "Legal", w: 215.9, h: 355.6 }, { id: "Tabloid", w: 279.4, h: 431.8 },
    { id: "B4", w: 250, h: 353 }, { id: "B5", w: 176, h: 250 }
  ];
  var SCREENS = [
    { id: "Instagram square", w: 1080, h: 1080 }, { id: "Instagram portrait", w: 1080, h: 1350 },
    { id: "Story / Reel", w: 1080, h: 1920 }, { id: "Full HD", w: 1920, h: 1080 }, { id: "4K", w: 3840, h: 2160 }
  ];
  var FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55];
  var SHAPES = { square: 1, golden: 1.618, wide: 0.618, fibonacci: 1.618 };

  function mm(px, ppi) { return px / ppi * 25.4; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function nearestFib(n) { return FIB.reduce(function (a, b) { return Math.abs(b - n) < Math.abs(a - n) ? b : a; }, 1); }

  /* ---------- what canvas is this? ---------- */
  function detect(doc) {
    var wm = mm(doc.width, doc.ppi), hm = mm(doc.height, doc.ppi);
    var orient = Math.abs(wm - hm) < 0.5 ? "square" : (wm < hm ? "portrait" : "landscape");
    for (var i = 0; i < PAPERS.length; i++) {
      var p = PAPERS[i];
      if ((Math.abs(wm - p.w) < 1.5 && Math.abs(hm - p.h) < 1.5) || (Math.abs(wm - p.h) < 1.5 && Math.abs(hm - p.w) < 1.5)) {
        return { id: p.id, kind: "paper", orientation: orient, label: p.id + " " + orient, mm: [wm, hm] };
      }
    }
    for (var j = 0; j < SCREENS.length; j++) {
      var s = SCREENS[j];
      if (Math.round(doc.width) === s.w && Math.round(doc.height) === s.h) return { id: s.id, kind: "screen", orientation: orient, label: s.id, mm: [wm, hm] };
    }
    return { id: "custom", kind: "custom", orientation: orient, label: (orient === "square" ? "Square" : "Custom " + orient), mm: [wm, hm] };
  }

  /* ---------- type size for the canvas ---------- */
  function bodyPt(doc) {
    var d = detect(doc);
    if (d.kind === "screen") return Math.max(16, Math.round(Math.min(doc.width, doc.height) / 45)); // px-based screens: readable on phones
    return Math.max(8, Math.round(Math.min(d.mm[0], d.mm[1]) / 24));
  }

  /* ---------- one suggestion ---------- */
  // opts: { cols, rows (optional = automatic), shape: square|golden|wide|fibonacci }
  function suggest(doc, opts) {
    opts = opts || {};
    var shape = SHAPES[opts.shape] ? opts.shape : "square";
    var W = doc.width, H = doc.height, ppi = doc.ppi;
    var body = bodyPt(doc), leadPt = Math.round(body * 1.2 * 100) / 100;
    var L = leadPt / 72 * ppi;                              // one baseline line in px
    if (detect(doc).kind === "screen") { L = Math.round(L); leadPt = Math.round(L * 72 / ppi * 100) / 100; } // whole pixels on screens
    var short = Math.min(W, H);
    var m = Math.max(2, Math.round(short * 0.06 / L));      // margin in lines (~6% of the short side)
    var side = m, top = m, bottomMin = Math.round(m * 1.5);
    if (shape === "fibonacci") { side = nearestFib(m); top = side; bottomMin = FIB[FIB.indexOf(side) + 1]; }

    var cols = Math.max(1, Math.min(12, Math.round(opts.cols || 4)));
    var colW = (W - 2 * side * L - (cols - 1) * L) / cols;
    if (colW < 2 * L) throw new Error(cols + " columns is too dense for this canvas. Try fewer.");

    var N = Math.floor((H - top * L - bottomMin * L) / L + 1e-6); // lines available for fields + gutters
    var target = SHAPES[shape];
    var rows = opts.rows ? Math.max(1, Math.round(opts.rows)) : null, auto = !rows;
    if (auto) {
      var best = null;
      for (var r = 1; r <= 40; r++) {
        var k = Math.floor((N - (r - 1)) / r);
        if (k < 1) break;
        var left = N - (r * k + (r - 1));
        var score = Math.abs(Math.log((k * L) / colW / target)) + 1.2 * left / N;   // shape first, then waste
        if (shape === "fibonacci" && FIB.indexOf(r) < 0) score += 0.25; // prefer Fibonacci row counts
        if (shape === "fibonacci" && FIB.indexOf(k) < 0) score += 0.15; // and Fibonacci lines per field
        if (!best || score < best.score - 1e-9) best = { r: r, score: score };
      }
      rows = best ? best.r : 1;
    }
    var kLines = Math.floor((N - (rows - 1)) / rows);
    if (kLines < 1) throw new Error(rows + " rows is too dense for this canvas. Try fewer.");
    var usedLines = rows * kLines + (rows - 1);
    top += Math.floor((N - usedLines) / 3);                 // a third of any left-over lines to the top,
    var bottomPx = H - top * L - usedLines * L;             // the rest to the bottom (always the heaviest margin)

    var f = function (px) { return String(r4(mm(px, ppi))); };
    var form = {
      unit: "mm",
      marginLeft: f(side * L), marginRight: f(side * L), columns: String(cols), columnWidth: "", columnGutter: f(L),
      marginTop: f(top * L), marginBottom: f(bottomPx), rows: String(rows), rowHeight: f(kLines * L), rowGutter: f(L),
      alignH: "start", alignV: "start", midVertical: false, midHorizontal: false
    };
    return {
      form: form,
      info: {
        canvas: detect(doc), cols: cols, rows: rows, autoRows: auto, shape: shape,
        bodyPt: body, leadingPt: leadPt, linePx: L, lineMm: mm(L, ppi), linesPerField: kLines,
        marginsLines: { side: side, top: top, bottom: Math.round(bottomPx / L * 100) / 100 },
        marginsMm: { side: mm(side * L, ppi), top: mm(top * L, ppi), bottom: mm(bottomPx, ppi) },
        moduleMm: [mm(colW, ppi), mm(kLines * L, ppi)], totalLines: usedLines
      }
    };
  }

  // The baseline grid that belongs to a suggestion: one line per body leading, top of first field to bottom of last.
  function baselineFor(s) {
    var i = s.info;
    return {
      unit: "mm", marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "",
      marginTop: s.form.marginTop, marginBottom: "", rows: String(i.totalLines), rowHeight: String(r4(i.lineMm)), rowGutter: "0",
      alignH: "start", alignV: "start", midVertical: false, midHorizontal: false
    };
  }

  // Next / previous density: columns step 1..12 (Fibonacci shape steps through 1, 2, 3, 5, 8).
  function stepCols(cols, dir, shape) {
    if (shape === "fibonacci") {
      var list = [1, 2, 3, 5, 8], i = list.indexOf(nearestFib(cols));
      return list[Math.max(0, Math.min(list.length - 1, i + dir))];
    }
    return Math.max(1, Math.min(12, cols + dir));
  }

  /* ---------- built-in presets per paper (portrait, mm) ---------- */
  var PAPER_COLORS = { Letter: "#00AEEF", A2: "#AF52DE", A3: "#FF2D95", A4: "#34C759", A5: "#FF9500" };
  function paperPresets(id) {
    var p = PAPERS.filter(function (x) { return x.id === id; })[0];
    var doc = { width: p.w / 25.4 * 300, height: p.h / 25.4 * 300, ppi: 300 };
    var out = [], color = PAPER_COLORS[id] || "#00AEEF", base = null;
    [[4, "classic"], [6, "dense"], [12, "fine"]].forEach(function (v) {
      try {
        var s = suggest(doc, { cols: v[0], shape: "square" });
        if (!base) base = s;
        out.push(Object.assign({ gridName: id + " · " + s.info.cols + " × " + s.info.rows + " " + v[1] + " (" + s.info.bodyPt + "/" + s.info.leadingPt + " pt)",
          colorHex: color, drawMode: "both", lineWidth: "1", group: id }, s.form));
      } catch (e) {}
    });
    if (base) out.push(Object.assign({ gridName: id + " · Baseline " + base.info.bodyPt + "/" + base.info.leadingPt + " pt", colorHex: "#FF3B30",
      drawMode: "both", lineWidth: "1", group: id }, baselineFor(base)));
    return out;
  }
  function fibonacciPresets() {
    return ["A4", "A3", "Letter"].map(function (id) {
      var p = PAPERS.filter(function (x) { return x.id === id; })[0];
      var s = suggest({ width: p.w / 25.4 * 300, height: p.h / 25.4 * 300, ppi: 300 }, { cols: 5, shape: "fibonacci" });
      return Object.assign({ gridName: "Fibonacci " + id + " · " + s.info.cols + " × " + s.info.rows, colorHex: "#E0A800", drawMode: "both", lineWidth: "1", group: "Golden ratio & Fibonacci" }, s.form);
    });
  }

  var api = { PAPERS: PAPERS, detect: detect, bodyPt: bodyPt, suggest: suggest, baselineFor: baselineFor, stepCols: stepCols,
              paperPresets: paperPresets, fibonacciPresets: fibonacciPresets };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GridSuggest = api;
})(typeof window !== "undefined" ? window : globalThis);
