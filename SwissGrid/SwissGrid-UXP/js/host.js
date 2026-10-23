/* SwissGrid panel: Photoshop side (UXP). Port of the CEP panel's jsx/host.jsx.
   The panel computes the grid; these functions draw and remove it.
   Every function takes a plain object and resolves to {ok:true,...} or {ok:false,error:"..."}. */
(function (root) {
  "use strict";

  var ps = require("photoshop");
  var app = ps.app, core = ps.core, action = ps.action, constants = ps.constants;
  var fs = require("uxp").storage.localFileSystem;

  var SG_LAYER_PREFIX = "SwissGrid · ";
  var SG_PS_MAJOR = parseInt(String(app.version).split(".")[0], 10);
  var sgColorWorks = SG_PS_MAJOR >= 24; // per-guide colors exist from Photoshop 2023 (v24)
  var sgScaleCache = {};
  var SG_NS = "http://ns.swissgrid.local/1.0/";

  function ok(o) { o = o || {}; o.ok = true; return o; }
  function err(e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }

  function play(descs) { return action.batchPlay(descs, {}); }
  function failed(results) {
    return !results || results.some(function (r) { return r && r._obj === "error"; });
  }
  function px(v) { return { _unit: "pixelsUnit", _value: v }; }
  var DOC = { _ref: "document", _enum: "ordinal", _value: "targetEnum" };

  function activeDoc() { return app.documents.length ? app.activeDocument : null; }

  // Runs fn as one modal Photoshop command and one history step (a single Ctrl+Z).
  // If fn throws, the history step is rolled back.
  function modal(doc, name, fn) {
    return core.executeAsModal(async function (ctx) {
      var token = await ctx.hostControl.suspendHistory({ documentID: doc.id, name: name });
      var commit = false;
      try { var r = await fn(ctx); commit = true; return r; }
      finally { await ctx.hostControl.resumeHistory(token, commit); }
    }, { commandName: name });
  }

  // ---------------------------------------------------------------- document info

  async function docInfo() {
    try {
      var d = activeDoc();
      if (!d) return ok({ doc: null, psVersion: String(app.version), colorGuides: sgColorWorks });
      return ok({
        doc: { name: d.name, width: d.width, height: d.height, ppi: d.resolution, guides: d.guides.length },
        psVersion: String(app.version),
        colorGuides: sgColorWorks
      });
    } catch (e) { return err(e); }
  }

  // ---------------------------------------------------------------- guides

  function guideDesc(vertical, pos, rgb) {
    var g = { _obj: "guide", position: px(pos), orientation: { _enum: "orientation", _value: vertical ? "vertical" : "horizontal" } };
    if (rgb) { g.$GdCA = 0; g.$GdCR = rgb.r; g.$GdCG = rgb.g; g.$GdCB = rgb.b; }
    var d = { _obj: "make", new: g };
    if (rgb) d.guideTarget = { _enum: "guideTarget", _value: "guideTargetCanvas" };
    return d;
  }

  // Some builds read pixel positions as 72-ppi pixels. Measure once per document and correct.
  async function positionScale(doc) {
    var key = doc.id + "|" + doc.resolution;
    if (sgScaleCache[key]) return sgScaleCache[key];
    var scale = 1;
    try {
      var before = doc.guides.length;
      await play([guideDesc(true, 1000, null)]);
      if (doc.guides.length > before) {
        var g = doc.guides[doc.guides.length - 1];
        var got = g.coordinate;
        if (got && Math.abs(got - 1000) > 0.5) scale = 1000 / got;
        g.delete();
      }
    } catch (e) { scale = 1; }
    sgScaleCache[key] = scale;
    return scale;
  }

  // Adds all guides in one batch. Returns how many took the grid color.
  async function addGuides(doc, vertical, horizontal, rgb, scale) {
    var all = vertical.map(function (p) { return [true, p]; }).concat(horizontal.map(function (p) { return [false, p]; }));
    if (!all.length) return 0;
    if (sgColorWorks) {
      // Try the first guide in color; if this build refuses colored guides, fall back to plain ones.
      if (failed(await play([guideDesc(all[0][0], all[0][1] * scale, rgb)]))) sgColorWorks = false;
      else {
        if (all.length > 1) await play(all.slice(1).map(function (a) { return guideDesc(a[0], a[1] * scale, rgb); }));
        return all.length;
      }
    }
    await play(all.map(function (a) { return guideDesc(a[0], a[1] * scale, null); }));
    return 0;
  }

  // ---------------------------------------------------------------- colored grid layer

  function selectDesc(id, add) {
    var d = { _obj: "select", _target: [{ _ref: "layer", _id: id }], makeVisible: false };
    if (add) d.selectionModifier = { _enum: "selectionModifierType", _value: "addToSelection" };
    return d;
  }

  async function restoreSelection(ids) {
    if (!ids.length) return;
    try { await play(ids.map(function (id, i) { return selectDesc(id, i > 0); })); } catch (e) { /* layer gone */ }
  }

  async function drawLayer(doc, p) {
    var prev = doc.activeLayers.map(function (l) { return l.id; });
    await play([{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: SG_LAYER_PREFIX + p.name } }]);
    var layer = doc.activeLayers[0];
    var W = doc.width, H = doc.height, lw = p.lineWidth || 1, descs = [], i, a;
    function rect(x0, y0, x1, y1) {
      descs.push({ _obj: descs.length ? "addTo" : "set", _target: [{ _ref: "channel", _property: "selection" }],
        to: { _obj: "rectangle", top: px(y0), left: px(x0), bottom: px(y1), right: px(x1) } });
    }
    for (i = 0; i < p.vertical.length; i++) {
      a = Math.max(0, Math.min(W - lw, Math.round(p.vertical[i]) - Math.floor(lw / 2)));
      rect(a, 0, a + lw, H);
    }
    for (i = 0; i < p.horizontal.length; i++) {
      a = Math.max(0, Math.min(H - lw, Math.round(p.horizontal[i]) - Math.floor(lw / 2)));
      rect(0, a, W, a + lw);
    }
    if (descs.length) {
      descs.push({ _obj: "fill", using: { _enum: "fillContents", _value: "color" },
        color: { _obj: "RGBColor", red: p.rgb.r, grain: p.rgb.g, blue: p.rgb.b },
        opacity: { _unit: "percentUnit", _value: 100 }, mode: { _enum: "blendMode", _value: "normal" } });
      descs.push({ _obj: "set", _target: [{ _ref: "channel", _property: "selection" }], to: { _enum: "ordinal", _value: "none" } });
      await play(descs);
    }
    layer.allLocked = true;
    if (prev.length && prev.indexOf(layer.id) < 0) await restoreSelection(prev);
    return layer;
  }

  function findLayer(layers, id) {
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (l.id === id) return l;
      if (l.layers && l.layers.length) {
        var f = findLayer(l.layers, id);
        if (f) return f;
      }
    }
    return null;
  }

  function deleteGridLayers(layers) {
    var n = 0;
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i];
      if (l.layers && l.layers.length) n += deleteGridLayers(l.layers);
      else if (l.name.indexOf(SG_LAYER_PREFIX) === 0) { l.allLocked = false; l.delete(); n++; }
    }
    return n;
  }

  // ---------------------------------------------------------------- grid records in the document (XMP)
  // Each applied grid is saved inside the .psd so SwissType (and SwissGrid later) can read it.
  // Stored as swissgrid:grids on its own rdf:Description, the same property the CEP panel writes.

  async function readXmp() {
    var r = await play([{ _obj: "get", _target: [{ _property: "XMPMetadataAsUTF8" }, DOC] }]);
    return (r && r[0] && r[0].XMPMetadataAsUTF8) || "";
  }

  function xmlUnescape(t) {
    return t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#xA;/gi, "\n").replace(/&#xD;/gi, "\r").replace(/&#x9;/gi, "\t").replace(/&amp;/g, "&");
  }
  function xmlEscape(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;").replace(/\t/g, "&#x9;");
  }

  function parseRecords(xmp) {
    if (xmp.indexOf("swissgrid:grids") < 0) return [];
    var m = xmp.match(/swissgrid:grids="([^"]*)"/) || xmp.match(/<swissgrid:grids>([\s\S]*?)<\/swissgrid:grids>/);
    if (!m) return [];
    try {
      var list = JSON.parse(xmlUnescape(m[1]));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function withRecords(xmp, list) {
    var block = '<rdf:Description rdf:about="" xmlns:swissgrid="' + SG_NS + '" swissgrid:grids="' + xmlEscape(JSON.stringify(list)) + '"/>';
    // Drop any earlier value: our own block, or the property as written by XMPScript (attribute or element).
    xmp = xmp.replace(/<rdf:Description rdf:about="" xmlns:swissgrid="[^"]*" swissgrid:grids="[^"]*"\/>/g, "")
      .replace(/\s+swissgrid:grids="[^"]*"/g, "")
      .replace(/<swissgrid:grids>[\s\S]*?<\/swissgrid:grids>/g, "");
    if (xmp.indexOf("</rdf:RDF>") >= 0) return xmp.replace("</rdf:RDF>", block + "</rdf:RDF>");
    return '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      block + "</rdf:RDF></x:xmpmeta>";
  }

  async function readRecords() {
    try { return parseRecords(await readXmp()); } catch (e) { return []; }
  }

  async function writeRecords(list) {
    try {
      var xmp = withRecords(await readXmp(), list);
      await play([{ _obj: "set", _target: [{ _ref: "property", _property: "XMPMetadataAsUTF8" }, DOC],
        to: { _obj: "document", XMPMetadataAsUTF8: xmp } }]);
      return true;
    } catch (e) { return false; }
  }

  async function records() {
    try {
      if (!activeDoc()) return ok({ grids: [] });
      return ok({ grids: await readRecords() });
    } catch (e) { return err(e); }
  }

  // ---------------------------------------------------------------- panel API

  // p: { name, rgb:{r,g,b}, mode:"both"|"layer"|"guides", lineWidth, vertical:[px], horizontal:[px], record }
  async function apply(p) {
    try {
      var doc = activeDoc();
      if (!doc) return err("Open a document first.");
      var res = { colored: 0, guides: 0, layerId: null, layerName: null, docName: doc.name };
      await modal(doc, "SwissGrid: " + p.name, async function () {
        if (p.mode !== "layer") {
          var scale = await positionScale(doc);
          res.colored = await addGuides(doc, p.vertical, p.horizontal, p.rgb, scale);
          res.guides = p.vertical.length + p.horizontal.length;
        }
        if (p.mode !== "guides") {
          var layer = await drawLayer(doc, p);
          res.layerId = layer.id;
          res.layerName = layer.name;
        }
        if (p.record) {
          var recs = await readRecords();
          p.record.layerId = res.layerId;
          recs.push(p.record);
          res.saved = await writeRecords(recs);
        }
      });
      res.colorGuides = sgColorWorks;
      return ok(res);
    } catch (e) { return err(e); }
  }

  // p: { docName, vertical:[px], horizontal:[px], layerId, name, uid }
  async function remove(p) {
    try {
      var doc = activeDoc();
      if (!doc || doc.name !== p.docName) return err("Switch to " + p.docName + " first.");
      var removed = 0, layerGone = false;
      await modal(doc, "SwissGrid: Remove " + p.name, async function () {
        var want = [], i, j;
        for (i = 0; i < p.vertical.length; i++) want.push({ v: true, p: p.vertical[i] });
        for (i = 0; i < p.horizontal.length; i++) want.push({ v: false, p: p.horizontal[i] });
        var guides = doc.guides;
        for (i = guides.length - 1; i >= 0 && want.length; i--) {
          var g = guides[i];
          var isV = g.direction === constants.Direction.VERTICAL;
          var pos = g.coordinate;
          for (j = 0; j < want.length; j++) {
            if (want[j].v === isV && Math.abs(want[j].p - pos) < 0.05) { g.delete(); removed++; want.splice(j, 1); break; }
          }
        }
        if (p.layerId !== null && p.layerId !== undefined) {
          var l = findLayer(doc.layers, p.layerId);
          if (l) { l.allLocked = false; l.delete(); layerGone = true; }
        }
        var recs = await readRecords();
        var keep = recs.filter(function (r) {
          var same = p.uid ? r.uid === p.uid : (r.name === p.name && (p.layerId === null || p.layerId === undefined || r.layerId === p.layerId));
          return !same;
        });
        if (keep.length !== recs.length) await writeRecords(keep);
      });
      return ok({ removed: removed, layerGone: layerGone });
    } catch (e) { return err(e); }
  }

  async function clearAll() {
    try {
      var doc = activeDoc();
      if (!doc) return err("Open a document first.");
      var guides = 0, layers = 0;
      await modal(doc, "SwissGrid: Clear all grids", async function () {
        guides = doc.guides.length;
        doc.guides.removeAll();
        layers = deleteGridLayers(doc.layers);
        if ((await readRecords()).length) await writeRecords([]);
      });
      return ok({ guides: guides, layers: layers, docName: doc.name });
    } catch (e) { return err(e); }
  }

  // Toggle visibility of one grid layer.
  async function toggleLayer(p) {
    try {
      var doc = activeDoc();
      if (!doc || doc.name !== p.docName) return err("Switch to " + p.docName + " first.");
      var l = findLayer(doc.layers, p.layerId);
      if (!l) return err("That grid layer no longer exists.");
      await core.executeAsModal(function () { l.visible = !l.visible; }, { commandName: "SwissGrid: Show/hide grid" });
      return ok({ visible: l.visible });
    } catch (e) { return err(e); }
  }

  async function exportPresets(json) {
    try {
      var f = await fs.getFileForSaving("SwissGrid presets.json", { types: ["json"] });
      if (!f) return ok({ cancelled: true });
      await f.write(json);
      return ok({ path: f.nativePath });
    } catch (e) { return err(e); }
  }

  async function importPresets() {
    try {
      var f = await fs.getFileForOpening({ types: ["json"] });
      if (!f) return ok({ cancelled: true });
      return ok({ text: await f.read() });
    } catch (e) { return err(e); }
  }

  /* ---------- type sizes: apply to selected text layers ---------- */

  // Same command the Character panel sends when you change a value with a text layer selected.
  // Photoshop applies only the feature named in textOverrideFeatureName, so size and leading are sent separately.
  function textStyleDesc(style) {
    style._obj = "textStyle";
    style.typeStyleOperationType = 3;
    return { _obj: "set", _target: [{ _ref: "property", _property: "textStyle" }, { _ref: "textLayer", _enum: "ordinal", _value: "targetEnum" }], to: style };
  }
  function sizeDesc(size) {
    return textStyleDesc({ textOverrideFeatureName: 808465458, size: { _unit: "pointsUnit", _value: size } });
  }
  function leadingDesc(leading) {
    return textStyleDesc({ textOverrideFeatureName: 808465461, autoLeading: false, leading: { _unit: "pointsUnit", _value: leading } });
  }

  // p = { size: pt, leading: pt, role: "Body" }
  async function applyType(p) {
    try {
      var doc = activeDoc();
      if (!doc) return err("Open a document first.");
      var res = { done: 0, skipped: 0 };
      var selected = doc.activeLayers, ids = selected.map(function (l) { return l.id; }), text = [];
      selected.forEach(function (l) { if (l.kind === constants.LayerKind.TEXT) text.push(l); else res.skipped++; });
      if (!text.length) return err("Select a text layer first" + (res.skipped ? " (the selected layer isn't text)." : "."));
      await modal(doc, "SwissGrid: " + (p.role || "Type") + " " + p.size + "/" + p.leading + " pt", async function () {
        for (var k = 0; k < text.length; k++) {
          var r = await play([selectDesc(text[k].id, false), sizeDesc(p.size), leadingDesc(p.leading)]);
          if (!failed(r)) { res.done++; continue; }
          // The Character panel command didn't take: set it on the text item instead.
          try {
            var cs = text[k].textItem.characterStyle;
            cs.size = p.size;
            cs.useAutoLeading = false;
            cs.leading = p.leading;
            res.fallback = true;
            res.done++;
          } catch (e) {
            res.amError = String(e && e.message ? e.message : e);
            res.failed = (res.failed || 0) + 1;
          }
        }
        await restoreSelection(ids);
      });
      if (!res.done) return err("Photoshop didn't change the size" + (res.amError ? " (" + res.amError + ")" : "") + ". Try with the text layer selected but not in edit mode.");
      return ok(res);
    } catch (e) { return err(e); }
  }

  root.SGHost = {
    docInfo: docInfo, records: records, apply: apply, remove: remove, clearAll: clearAll, toggleLayer: toggleLayer,
    exportPresets: exportPresets, importPresets: importPresets, applyType: applyType,
    // exposed for tests
    _parseRecords: parseRecords, _withRecords: withRecords
  };
})(typeof window !== "undefined" ? window : globalThis);
