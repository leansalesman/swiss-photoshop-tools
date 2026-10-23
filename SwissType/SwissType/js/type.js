/* SwissType math: type scales, grid-locked leading, measure analysis. Pure functions. */
(function (root) {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var TRAD = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 21, 24, 36, 48, 60, 72];
  var FIB = [6, 8, 10, 13, 16, 21, 26, 34, 42, 55, 68, 89, 110, 144];
  var RATIOS = { golden: PHI, fifth: 1.5, fourth: 4 / 3, third: 1.25 };

  // "14.4", "14.4pt", "5.08mm", "0.2in", "1.2pc" -> points (independent of ppi)
  function toPt(raw) {
    var s = String(raw == null ? "" : raw).trim().toLowerCase().replace(",", ".");
    if (!s) return null;
    var m = s.match(/^(\d*\.?\d+)\s*(pt|mm|cm|in|pc)?$/);
    if (!m) throw new Error('Can\'t read "' + raw + '". Use pt, mm, cm, in or pc.');
    var v = parseFloat(m[1]);
    switch (m[2] || "pt") {
      case "pt": return v;
      case "mm": return v / 25.4 * 72;
      case "cm": return v / 2.54 * 72;
      case "in": return v * 72;
      case "pc": return v * 12;
    }
    return v;
  }

  function r2(v) { return Math.round(v * 100) / 100; }
  function half(v) { return Math.round(v * 2) / 2; }

  /** Sizes for a scale around a base size. */
  function scaleSizes(type, base) {
    if (type === "trad") return TRAD.slice();
    if (type === "fib") return FIB.slice();
    var r = RATIOS[type] || PHI, out = [];
    for (var k = -2; k <= 7; k++) {
      var s = half(base * Math.pow(r, k));
      if (s >= 5 && s <= 400 && out.indexOf(s) < 0) out.push(s);
    }
    return out;
  }

  /**
   * Leading for a size, locked to the baseline unit.
   * Small sizes (under 70% of body) may use half units, so two caption lines = one body line.
   * Display sizes (>= 36 pt) can be set tight (leading >= size) when tight = true.
   */
  function gridLeading(size, unit, base, minRatio, tight) {
    var ratio = tight && size >= 36 ? 1.0 : minRatio;
    var target = size * ratio;
    var step = size < base * 0.7 ? unit / 2 : unit;
    var units = Math.ceil(target / step - 1e-9) * (step / unit);
    return { leading: r2(units * unit), units: Math.round(units * 100) / 100 };
  }

  function buildScale(opts) {
    var sizes = scaleSizes(opts.type, opts.base);
    return sizes.map(function (s) {
      var l = gridLeading(s, opts.unit, opts.base, opts.minRatio, opts.tight);
      return { size: s, leading: l.leading, units: l.units, isBase: Math.abs(s - opts.base) < 0.01 };
    });
  }

  /**
   * Bringhurst copyfitting: characters per line = measure * 26 / lowercase alphabet length.
   * m: { size, measurePt, boxPt, alphabetPt, kind, lines:[charCounts] }
   */
  function analyzeMeasure(m, mode) {
    var lo = mode === "multi" ? 40 : 45, hi = mode === "multi" ? 50 : 75, ideal = mode === "multi" ? 45 : 66;
    var measure = m.kind === "paragraph" && m.boxPt ? m.boxPt : m.measurePt;
    var cpl;
    if (m.kind === "point" && m.lines && m.lines.length) {
      cpl = Math.max.apply(null, m.lines);
    } else {
      if (!m.alphabetPt) throw new Error("Couldn't measure the alphabet for this font.");
      cpl = measure * 26 / m.alphabetPt;
    }
    var verdict, cls;
    if (cpl < lo - 5 || cpl > hi + 10) cls = "bad";
    else if (cpl < lo || cpl > hi) cls = "warn";
    else cls = "good";
    if (cpl < lo) verdict = "Too short for comfortable reading";
    else if (cpl > hi) verdict = "Too long for comfortable reading";
    else verdict = Math.abs(cpl - ideal) <= 4 ? "Ideal measure" : "Comfortable measure";

    var res = {
      cpl: Math.round(cpl), words: r2(cpl / 6), measurePt: r2(measure), measureMm: r2(measure / 72 * 25.4),
      ratio: r2(measure / m.size), verdict: verdict, cls: cls, range: lo + "–" + hi, ideal: ideal
    };
    if (m.alphabetPt) {
      var idealMeasure = ideal * m.alphabetPt / 26;
      res.idealMeasurePt = r2(idealMeasure);
      res.idealMeasureMm = r2(idealMeasure / 72 * 25.4);
      res.idealSize = half(m.size * (cpl / ideal));
    }
    if (m.lines && m.lines.length) {
      res.lines = m.lines.map(function (n) {
        return { n: n, cls: n === 0 ? "" : (n < lo - 5 || n > hi + 10 ? "bad" : (n < lo || n > hi ? "warn" : "good")) };
      });
    }
    return res;
  }

  var api = { PHI: PHI, toPt: toPt, scaleSizes: scaleSizes, gridLeading: gridLeading, buildScale: buildScale, analyzeMeasure: analyzeMeasure };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TypeMath = api;
})(typeof window !== "undefined" ? window : globalThis);
