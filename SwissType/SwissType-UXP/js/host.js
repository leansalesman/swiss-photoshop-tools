/* SwissType panel: Photoshop side (UXP). Port of the CEP panel's jsx/host.jsx.
   Every function takes a plain object (or nothing) and resolves to {ok:true,...} or {ok:false,error:"..."}.
   Positions are in document pixels; type sizes, leading and measures in points. */
(function (root) {
  "use strict";

  var ps = require("photoshop");
  var app = ps.app, core = ps.core, action = ps.action, constants = ps.constants;
  var fs = require("uxp").storage.localFileSystem;

  function ok(o) { o = o || {}; o.ok = true; return o; }
  function err(e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }

  // ---------------------------------------------------------------- pure helpers (also tested outside Photoshop)

  // Nearest value in list to v. direction: "nearest" | "up" (smaller y) | "down" (larger y)
  function nearest(v, list, direction) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var d = list[i] - v;
      if (direction === "up" && d > 0.0001) continue;
      if (direction === "down" && d < -0.0001) continue;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = list[i]; }
    }
    return best;
  }

  // Baseline grid positions: top + n*unit, up to height.
  function gridLines(top, unit, height) {
    var out = [];
    if (!(unit > 0)) return out;
    for (var y = top; y <= height + 0.001; y += unit) out.push(Math.round(y * 1000) / 1000);
    return out;
  }

  // A number from either a plain number or an ActionDescriptor unit value ({_unit, _value}).
  function num(v) { return typeof v === "number" ? v : v && typeof v._value === "number" ? v._value : NaN; }

  // ---------------------------------------------------------------- Photoshop helpers

  function play(descs) { return action.batchPlay(descs, {}); }
  var DOC = { _ref: "document", _enum: "ordinal", _value: "targetEnum" };

  function activeDoc() { return app.documents.length ? app.activeDocument : null; }
  function requireDoc() {
    var d = activeDoc();
    if (!d) throw new Error("Open a document first.");
    return d;
  }

  // Runs fn as one modal Photoshop command and one history step (a single Ctrl+Z).
  // keep:false rolls the step back afterwards (used for temporary measuring layers).
  function modal(doc, name, fn, keep) {
    return core.executeAsModal(async function (ctx) {
      var token = await ctx.hostControl.suspendHistory({ documentID: doc.id, name: name });
      var commit = false;
      try { var r = await fn(ctx); commit = keep !== false; return r; }
      finally { await ctx.hostControl.resumeHistory(token, commit); }
    }, { commandName: name });
  }

  function isText(l) { return l && l.kind === constants.LayerKind.TEXT; }

  function selectDesc(id, add) {
    var d = { _obj: "select", _target: [{ _ref: "layer", _id: id }], makeVisible: false };
    if (add) d.selectionModifier = { _enum: "selectionModifierType", _value: "addToSelection" };
    return d;
  }
  async function restoreSelection(ids) {
    if (!ids.length) return;
    try { await play(ids.map(function (id, i) { return selectDesc(id, i > 0); })); } catch (e) { /* layer gone */ }
  }

  // Runs fn(layer) for every selected text layer, then puts the selection back.
  async function eachText(doc, fn) {
    var layers = doc.activeLayers.slice(), ids = layers.map(function (l) { return l.id; }), n = 0, skipped = 0;
    for (var i = 0; i < layers.length; i++) {
      if (isText(layers[i])) { await fn(layers[i]); n++; } else skipped++;
    }
    await restoreSelection(ids);
    return { done: n, skipped: skipped };
  }

  function firstText(doc) {
    var l = doc.activeLayers.filter(isText)[0];
    if (!l) throw new Error("Select a text layer first.");
    return l;
  }

  function guides(doc, vertical) {
    var out = [], want = vertical ? constants.Direction.VERTICAL : constants.Direction.HORIZONTAL;
    for (var i = 0; i < doc.guides.length; i++) {
      var g = doc.guides[i];
      if (g.direction === want) out.push(g.coordinate);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  // Baseline (px) of the first line of a text layer. Needs to run inside modal() for paragraph text.
  async function baseline(layer) {
    var ti = layer.textItem;
    if (ti.isPointText) return num(ti.textClickPoint.y);
    // Paragraph text: measure on a point-text copy, which keeps the first baseline in place.
    var dup = await layer.duplicate();
    try {
      await dup.textItem.convertToPointText();
      return num(dup.textItem.textClickPoint.y);
    } finally {
      await dup.delete();
    }
  }

  // [left, top, right, bottom] of the visible pixels.
  function inkBounds(layer) {
    var b = layer.bounds;
    return [num(b.left), num(b.top), num(b.right), num(b.bottom)];
  }

  function moveBy(layer, dx, dy) { return layer.translate(dx, dy); }

  function pt(px, doc) { return px * 72 / doc.resolution; }

  function colorHex(cs) {
    try { return "#" + String(cs.color.rgb.hexValue).toUpperCase(); } catch (e) { return null; }
  }

  // Styles are stored as "TextCase.ALLCAPS" / "Justification.LEFT", the same strings the CEP panel saved,
  // so exported style files work in both versions.
  function enumName(group, value) {
    var table = constants[group];
    if (!table || value === null || value === undefined) return null;
    for (var k in table) if (table[k] === value) return group + "." + k;
    return null;
  }
  function enumFrom(path) {
    if (!path) return null;
    var bits = String(path).split(".");
    var table = constants[bits[0]];
    return table && bits[1] && table[bits[1]] !== undefined ? table[bits[1]] : null;
  }

  // Grids SwissGrid saved inside the document (XMP property swissgrid:grids).
  function xmlUnescape(t) {
    return t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#xA;/gi, "\n").replace(/&#xD;/gi, "\r").replace(/&#x9;/gi, "\t").replace(/&amp;/g, "&");
  }
  async function readGrids() {
    try {
      var r = await play([{ _obj: "get", _target: [{ _property: "XMPMetadataAsUTF8" }, DOC] }]);
      var xmp = (r && r[0] && r[0].XMPMetadataAsUTF8) || "";
      if (xmp.indexOf("swissgrid:grids") < 0) return [];
      var m = xmp.match(/swissgrid:grids="([^"]*)"/) || xmp.match(/<swissgrid:grids>([\s\S]*?)<\/swissgrid:grids>/);
      if (!m) return [];
      var list = JSON.parse(xmlUnescape(m[1]));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  // ---------------------------------------------------------------- panel API

  async function info() {
    // Read-only and selection-safe: called every couple of seconds by the panel.
    try {
      var doc = activeDoc();
      if (!doc) return ok({ doc: null });
      var sel = doc.activeLayers, l = sel[0] || null, first = null;
      if (isText(l)) {
        try {
          var ti = l.textItem, cs = ti.characterStyle;
          first = {
            name: l.name, font: cs.font, size: cs.size,
            leading: cs.useAutoLeading ? null : cs.leading,
            tracking: cs.tracking, kind: ti.isPointText ? "point" : "paragraph"
          };
        } catch (e) { first = null; }
      }
      return ok({
        doc: { name: doc.name, width: Math.round(doc.width), height: Math.round(doc.height), ppi: doc.resolution },
        selected: sel.length, first: first, activeName: l ? l.name : null,
        hGuides: guides(doc, false).length, vGuides: guides(doc, true).length,
        grids: await readGrids()
      });
    } catch (e) { return err(e); }
  }

  // p: { target:"guides"|"grid", lines:[px]|undefined, top:px, unit:px, direction:"nearest"|"up"|"down" }
  async function snapBaseline(p) {
    try {
      var doc = requireDoc(), res = { moved: 0, skipped: 0, details: [] };
      var lines = p.lines && p.lines.length ? p.lines : (p.target === "grid" ? gridLines(p.top, p.unit, doc.height) : guides(doc, false));
      if (!lines.length) throw new Error(p.target === "grid" ? "Enter a baseline grid (top and unit)." : "No horizontal guides. Add a baseline grid with SwissGrid, or switch to Baseline grid.");
      await modal(doc, "SwissType: Snap to baseline", async function () {
        var r = await eachText(doc, async function (l) {
          var b = await baseline(l);
          var t = nearest(b, lines, p.direction);
          if (t === null) { res.details.push(l.name + ": no guide in that direction"); return; }
          var dy = t - b;
          if (Math.abs(dy) > 0.01) await moveBy(l, 0, dy);
          res.moved++;
          res.details.push(l.name + ": " + (dy >= 0 ? "+" : "") + (Math.round(dy * 10) / 10) + " px");
        });
        res.skipped = r.skipped;
      });
      return ok(res);
    } catch (e) { return err(e); }
  }

  // p: { edge:"left"|"right"|"top"|"bottom" }
  // Aligns the visible ink of each selected text layer (not its text box) to the nearest guide.
  async function opticalAlign(p) {
    try {
      var doc = requireDoc(), res = { moved: 0, skipped: 0, details: [] };
      var vertical = p.edge === "left" || p.edge === "right";
      var lines = guides(doc, vertical);
      if (!lines.length) throw new Error("No " + (vertical ? "vertical" : "horizontal") + " guides to align to.");
      var idx = { left: 0, top: 1, right: 2, bottom: 3 }[p.edge];
      await modal(doc, "SwissType: Optical edge align", async function () {
        var r = await eachText(doc, async function (l) {
          var edge = inkBounds(l)[idx];
          var t = nearest(edge, lines, "nearest");
          if (t === null) return;
          var d = t - edge;
          if (Math.abs(d) > 0.01) await (vertical ? moveBy(l, d, 0) : moveBy(l, 0, d));
          res.moved++;
          res.details.push(l.name + ": " + (d >= 0 ? "+" : "") + (Math.round(d * 10) / 10) + " px");
        });
        res.skipped = r.skipped;
      });
      return ok(res);
    } catch (e) { return err(e); }
  }

  // p: { size:pt, leading:pt|null, tracking:number|null, snap:{target,lines,top,unit}|null }
  async function applySize(p) {
    try {
      var doc = requireDoc(), res = { done: 0, skipped: 0 };
      var lines = null;
      if (p.snap) lines = p.snap.lines && p.snap.lines.length ? p.snap.lines : p.snap.target === "grid" ? gridLines(p.snap.top, p.snap.unit, doc.height) : guides(doc, false);
      await modal(doc, "SwissType: " + p.size + "/" + (p.leading || "auto") + " pt", async function () {
        var r = await eachText(doc, async function (l) {
          var cs = l.textItem.characterStyle;
          cs.size = p.size;
          if (p.leading) { cs.useAutoLeading = false; cs.leading = p.leading; }
          if (p.tracking !== null && p.tracking !== undefined) cs.tracking = p.tracking;
          if (lines && lines.length) {
            var b = await baseline(l);
            var t = nearest(b, lines, "nearest");
            if (t !== null && Math.abs(t - b) > 0.01) await moveBy(l, 0, t - b);
          }
        });
        res.done = r.done; res.skipped = r.skipped;
      });
      return ok(res);
    } catch (e) { return err(e); }
  }

  // Width (pt) of a paragraph text box, from the layer's text settings. null if it can't be read.
  async function boxWidthPt(layer, doc) {
    try {
      var r = await play([{ _obj: "get", _target: [{ _property: "textKey" }, { _ref: "layer", _id: layer.id }] }]);
      var tk = r && r[0] && r[0].textKey;
      var shape = tk && tk.textShape && tk.textShape[0];
      if (!shape || !shape.bounds) return null;
      var w = num(shape.bounds.right) - num(shape.bounds.left);
      var scale = tk.transform && typeof tk.transform.xx === "number" ? Math.abs(tk.transform.xx) : 1;
      return isFinite(w) && w > 0 ? w * scale : null;
    } catch (e) { return null; }
  }

  // Measure the first selected text layer (Bringhurst copyfitting: lowercase alphabet length).
  async function measure() {
    try {
      var doc = requireDoc();
      var l = firstText(doc), ti = l.textItem, cs = ti.characterStyle;
      var size = cs.size, font = cs.font, tracking = cs.tracking, isPoint = ti.isPointText;
      var b = inkBounds(l);
      var measurePt = pt(b[2] - b[0], doc);
      var boxPt = null;
      if (!isPoint) {
        boxPt = await boxWidthPt(l, doc);
        // Text-box widths can come back in an unexpected unit; only trust a plausible one.
        if (boxPt !== null && (boxPt < measurePt * 0.9 || boxPt > measurePt * 4)) boxPt = null;
      }
      var contents = String(ti.contents);

      // Alphabet length in the same font, size and tracking, on a temporary layer that is rolled back.
      var alphaPx = null;
      var ids = doc.activeLayers.map(function (x) { return x.id; });
      await modal(doc, "SwissType: Measure", async function () {
        var t = await doc.createTextLayer({ contents: "abcdefghijklmnopqrstuvwxyz", fontName: font, fontSize: size,
          position: { x: 0, y: doc.height / 2 } });
        try { if (tracking) t.textItem.characterStyle.tracking = tracking; } catch (e) { /* keep default */ }
        var tb = inkBounds(t);
        alphaPx = tb[2] - tb[0];
        await t.delete();
        await restoreSelection(ids);
      }, false);

      var lines = [];
      if (isPoint) contents.split(/\r|\n|\u0003/).forEach(function (s) { lines.push(s.length); });
      return ok({
        name: l.name, font: font, size: size, kind: isPoint ? "point" : "paragraph",
        measurePt: measurePt, boxPt: boxPt,
        alphabetPt: alphaPx === null || !(alphaPx > 0) ? null : pt(alphaPx, doc),
        chars: contents.length, lines: lines
      });
    } catch (e) { return err(e); }
  }

  async function readStyle() {
    try {
      var doc = requireDoc();
      var l = firstText(doc), cs = l.textItem.characterStyle, s = {};
      s.font = cs.font;
      s.size = cs.size;
      s.autoLeading = cs.useAutoLeading;
      s.leading = cs.useAutoLeading ? null : cs.leading;
      s.tracking = cs.tracking;
      s.color = colorHex(cs);
      try { s.capitalization = enumName("TextCase", cs.capitalization); } catch (e) { s.capitalization = null; }
      try { s.justification = enumName("Justification", l.textItem.paragraphStyle.justification); } catch (e2) { s.justification = null; }
      return ok({ style: s, layer: l.name });
    } catch (e) { return err(e); }
  }

  // p: { style:{...}, parts:{font,size,leading,tracking,color,case,align} }
  async function applyStyle(p) {
    try {
      var doc = requireDoc(), s = p.style, on = p.parts || {}, res = { done: 0, skipped: 0 };
      await modal(doc, "SwissType: Apply style", async function () {
        var r = await eachText(doc, async function (l) {
          var cs = l.textItem.characterStyle;
          if (on.font !== false && s.font) cs.font = s.font;
          if (on.size !== false && s.size) cs.size = s.size;
          if (on.leading !== false) {
            if (s.autoLeading) cs.useAutoLeading = true;
            else if (s.leading) { cs.useAutoLeading = false; cs.leading = s.leading; }
          }
          if (on.tracking !== false && s.tracking !== null && s.tracking !== undefined) cs.tracking = s.tracking;
          if (on.color !== false && s.color) {
            var c = new app.SolidColor(); c.rgb.hexValue = String(s.color).replace("#", ""); cs.color = c;
          }
          if (on["case"] !== false && s.capitalization) { var cap = enumFrom(s.capitalization); if (cap !== null) cs.capitalization = cap; }
          if (on.align !== false && s.justification) { var j = enumFrom(s.justification); if (j !== null) l.textItem.paragraphStyle.justification = j; }
        });
        res.done = r.done; res.skipped = r.skipped;
      });
      return ok(res);
    } catch (e) { return err(e); }
  }

  async function exportFile(json) {
    try {
      var f = await fs.getFileForSaving("SwissType styles.json", { types: ["json"] });
      if (!f) return ok({ cancelled: true });
      await f.write(json);
      return ok({ path: f.nativePath });
    } catch (e) { return err(e); }
  }

  async function importFile() {
    try {
      var f = await fs.getFileForOpening({ types: ["json"] });
      if (!f) return ok({ cancelled: true });
      return ok({ text: await f.read() });
    } catch (e) { return err(e); }
  }

  root.STHost = {
    info: info, snapBaseline: snapBaseline, opticalAlign: opticalAlign, applySize: applySize, measure: measure,
    readStyle: readStyle, applyStyle: applyStyle, exportFile: exportFile, importFile: importFile,
    // exposed for tests
    _nearest: nearest, _gridLines: gridLines
  };
})(typeof window !== "undefined" ? window : globalThis);
