// SwissGrid panel: Photoshop side (ExtendScript, ES3).
// The panel computes the grid; these functions draw and remove it.
// Every function takes a JSON string and returns a JSON string: {"ok":true,...} or {"ok":false,"error":"..."}.

var SG_LAYER_PREFIX = "SwissGrid · ";
var SG_PS_MAJOR = parseInt(String(app.version).split(".")[0], 10);
var sgColorWorks = SG_PS_MAJOR >= 24; // per-guide colors exist from Photoshop 2023 (v24)
var sgScaleCache = {};

// ---------------------------------------------------------------- JSON helpers (ExtendScript has no JSON object)

function sgParse(s) { return eval("(" + s + ")"); }

function sgStr(v) {
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") {
        return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
    }
    if (v instanceof Array) {
        var a = [];
        for (var i = 0; i < v.length; i++) a.push(sgStr(v[i]));
        return "[" + a.join(",") + "]";
    }
    var parts = [];
    for (var k in v) if (v.hasOwnProperty(k)) parts.push(sgStr(String(k)) + ":" + sgStr(v[k]));
    return "{" + parts.join(",") + "}";
}

function sgOk(obj) { obj = obj || {}; obj.ok = true; return sgStr(obj); }
function sgErr(e) { return sgStr({ ok: false, error: String(e && e.message ? e.message : e) }); }

function sgWithPixels(fn) {
    var ru = app.preferences.rulerUnits, set = ru !== Units.PIXELS;
    if (set) app.preferences.rulerUnits = Units.PIXELS;
    try { return fn(); } finally { if (set) app.preferences.rulerUnits = ru; }
}

// ---------------------------------------------------------------- document info

function sg_docInfo() {
    try {
        if (!app.documents.length) return sgOk({ doc: null, psVersion: String(app.version), colorGuides: sgColorWorks });
        var d = app.activeDocument;
        return sgWithPixels(function () {
            return sgOk({
                doc: { name: d.name, width: d.width.as("px"), height: d.height.as("px"), ppi: d.resolution, guides: d.guides.length },
                psVersion: String(app.version),
                colorGuides: sgColorWorks
            });
        });
    } catch (e) { return sgErr(e); }
}

// ---------------------------------------------------------------- guides

function sgCT(s) { return charIDToTypeID(s); }
function sgST(s) { return stringIDToTypeID(s); }

function sgMakeGuideAM(vertical, pos, rgb) {
    var desc = new ActionDescriptor();
    var g = new ActionDescriptor();
    g.putUnitDouble(sgCT("Pstn"), sgCT("#Pxl"), pos);
    g.putEnumerated(sgCT("Ornt"), sgCT("Ornt"), sgCT(vertical ? "Vrtc" : "Hrzn"));
    if (rgb) {
        g.putInteger(sgCT("GdCA"), 0);
        g.putInteger(sgCT("GdCR"), rgb.r);
        g.putInteger(sgCT("GdCG"), rgb.g);
        g.putInteger(sgCT("GdCB"), rgb.b);
    }
    desc.putObject(sgCT("Nw  "), sgCT("Gd  "), g);
    if (rgb) desc.putEnumerated(sgST("guideTarget"), sgST("guideTarget"), sgST("guideTargetCanvas"));
    executeAction(sgCT("Mk  "), desc, DialogModes.NO);
}

// Some builds read #Pxl as 72-ppi pixels. Measure once per document and correct.
function sgPositionScale(doc) {
    var key = doc.name + "|" + doc.resolution;
    if (sgScaleCache[key]) return sgScaleCache[key];
    var scale = 1;
    try {
        var before = doc.guides.length;
        sgMakeGuideAM(true, 1000, null);
        if (doc.guides.length > before) {
            var got = doc.guides[doc.guides.length - 1].coordinate.as("px");
            if (got && Math.abs(got - 1000) > 0.5) scale = 1000 / got;
            doc.guides[doc.guides.length - 1].remove();
        }
    } catch (e) { scale = 1; }
    sgScaleCache[key] = scale;
    return scale;
}

function sgAddGuide(doc, vertical, pos, rgb, scale) {
    if (sgColorWorks) {
        try { sgMakeGuideAM(vertical, pos * scale, rgb); return true; }
        catch (e) { sgColorWorks = false; }
    }
    try { sgMakeGuideAM(vertical, pos * scale, null); }
    catch (e2) { doc.guides.add(vertical ? Direction.VERTICAL : Direction.HORIZONTAL, new UnitValue(pos, "px")); }
    return false;
}

// ---------------------------------------------------------------- colored grid layer

function sgDrawLayer(doc, p) {
    var prevActive = doc.activeLayer;
    var layer = doc.artLayers.add();
    layer.name = SG_LAYER_PREFIX + p.name;
    var W = doc.width.as("px"), H = doc.height.as("px"), lw = p.lineWidth || 1, first = true, i, a;
    function rect(x0, y0, x1, y1) {
        doc.selection.select([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], first ? SelectionType.REPLACE : SelectionType.EXTEND, 0, false);
        first = false;
    }
    for (i = 0; i < p.vertical.length; i++) {
        a = Math.max(0, Math.min(W - lw, Math.round(p.vertical[i]) - Math.floor(lw / 2)));
        rect(a, 0, a + lw, H);
    }
    for (i = 0; i < p.horizontal.length; i++) {
        a = Math.max(0, Math.min(H - lw, Math.round(p.horizontal[i]) - Math.floor(lw / 2)));
        rect(0, a, W, a + lw);
    }
    if (!first) {
        var c = new SolidColor();
        c.rgb.red = p.rgb.r; c.rgb.green = p.rgb.g; c.rgb.blue = p.rgb.b;
        doc.selection.fill(c, ColorBlendMode.NORMAL, 100, false);
        doc.selection.deselect();
    }
    layer.allLocked = true;
    try { if (prevActive && prevActive !== layer) doc.activeLayer = prevActive; } catch (e) {}
    return layer;
}

function sgFindLayerById(container, id) {
    for (var i = 0; i < container.layers.length; i++) {
        var l = container.layers[i];
        if (l.id === id) return l;
        if (l.typename === "LayerSet") {
            var f = sgFindLayerById(l, id);
            if (f) return f;
        }
    }
    return null;
}

function sgDeleteGridLayers(container) {
    var n = 0;
    for (var i = container.layers.length - 1; i >= 0; i--) {
        var l = container.layers[i];
        if (l.typename === "LayerSet") n += sgDeleteGridLayers(l);
        else if (l.name.indexOf(SG_LAYER_PREFIX) === 0) { l.allLocked = false; l.remove(); n++; }
    }
    return n;
}


// ---------------------------------------------------------------- grid records in the document (XMP)
// Each applied grid is saved inside the .psd so SwissType (and SwissGrid later) can read it.
var SG_NS = "http://ns.swissgrid.local/1.0/";

function sgXmpReady() {
    try {
        if (typeof XMPMeta === "undefined") {
            if (ExternalObject.AdobeXMPScript === undefined) ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
        }
        XMPMeta.registerNamespace(SG_NS, "swissgrid:");
        return true;
    } catch (e) { return false; }
}

function sgReadRecords(doc) {
    if (!sgXmpReady()) return [];
    try {
        var x = new XMPMeta(doc.xmpMetadata.rawData);
        var v = x.getProperty(SG_NS, "grids");
        if (!v) return [];
        var list = sgParse(String(v));
        return list && list.length !== undefined ? list : [];
    } catch (e) { return []; }
}

function sgWriteRecords(doc, list) {
    if (!sgXmpReady()) return false;
    try {
        var x = new XMPMeta(doc.xmpMetadata.rawData);
        x.setProperty(SG_NS, "grids", sgStr(list));
        doc.xmpMetadata.rawData = x.serialize();
        return true;
    } catch (e) { return false; }
}

function sg_records() {
    try {
        if (!app.documents.length) return sgOk({ grids: [] });
        return sgOk({ grids: sgReadRecords(app.activeDocument) });
    } catch (e) { return sgErr(e); }
}

// ---------------------------------------------------------------- panel API

// payload: { name, rgb:{r,g,b}, mode:"both"|"layer"|"guides", lineWidth, vertical:[px], horizontal:[px] }
function sg_apply(json) {
    try {
        if (!app.documents.length) return sgErr("Open a document first.");
        var p = sgParse(json);
        var doc = app.activeDocument;
        var res = { colored: 0, guides: 0, layerId: null, layerName: null, docName: doc.name };
        $.global.__sg_job = function () {
            if (p.mode !== "layer") {
                var scale = sgPositionScale(doc), i;
                for (i = 0; i < p.vertical.length; i++) { if (sgAddGuide(doc, true, p.vertical[i], p.rgb, scale)) res.colored++; res.guides++; }
                for (i = 0; i < p.horizontal.length; i++) { if (sgAddGuide(doc, false, p.horizontal[i], p.rgb, scale)) res.colored++; res.guides++; }
            }
            if (p.mode !== "guides") {
                var layer = sgDrawLayer(doc, p);
                res.layerId = layer.id;
                res.layerName = layer.name;
            }
            if (p.record) {
                var recs = sgReadRecords(doc);
                p.record.layerId = res.layerId;
                recs.push(p.record);
                res.saved = sgWriteRecords(doc, recs);
            }
        };
        sgWithPixels(function () { doc.suspendHistory("SwissGrid: " + p.name, "$.global.__sg_job()"); });
        res.colorGuides = sgColorWorks;
        return sgOk(res);
    } catch (e) { return sgErr(e); }
}

// payload: { docName, vertical:[px], horizontal:[px], layerId, name }
function sg_remove(json) {
    try {
        var p = sgParse(json);
        if (!app.documents.length || app.activeDocument.name !== p.docName) return sgErr("Switch to " + p.docName + " first.");
        var doc = app.activeDocument;
        var removed = 0, layerGone = false;
        $.global.__sg_job = function () {
            var want = [], i, j;
            for (i = 0; i < p.vertical.length; i++) want.push({ v: true, p: p.vertical[i] });
            for (i = 0; i < p.horizontal.length; i++) want.push({ v: false, p: p.horizontal[i] });
            for (i = doc.guides.length - 1; i >= 0 && want.length; i--) {
                var g = doc.guides[i];
                var isV = g.direction === Direction.VERTICAL;
                var pos = g.coordinate.as("px");
                for (j = 0; j < want.length; j++) {
                    if (want[j].v === isV && Math.abs(want[j].p - pos) < 0.05) { g.remove(); removed++; want.splice(j, 1); break; }
                }
            }
            if (p.layerId !== null && p.layerId !== undefined) {
                var l = sgFindLayerById(doc, p.layerId);
                if (l) { l.allLocked = false; l.remove(); layerGone = true; }
            }
            var recs = sgReadRecords(doc), keep = [];
            for (i = 0; i < recs.length; i++) {
                var r = recs[i];
                var same = p.uid ? r.uid === p.uid : (r.name === p.name && (p.layerId === null || p.layerId === undefined || r.layerId === p.layerId));
                if (!same) keep.push(r);
            }
            if (keep.length !== recs.length) sgWriteRecords(doc, keep);
        };
        sgWithPixels(function () { doc.suspendHistory("SwissGrid: Remove " + p.name, "$.global.__sg_job()"); });
        return sgOk({ removed: removed, layerGone: layerGone });
    } catch (e) { return sgErr(e); }
}

function sg_clearAll() {
    try {
        if (!app.documents.length) return sgErr("Open a document first.");
        var doc = app.activeDocument, guides = 0, layers = 0;
        $.global.__sg_job = function () {
            guides = doc.guides.length;
            while (doc.guides.length) doc.guides[0].remove();
            layers = sgDeleteGridLayers(doc);
            if (sgReadRecords(doc).length) sgWriteRecords(doc, []);
        };
        doc.suspendHistory("SwissGrid: Clear all grids", "$.global.__sg_job()");
        return sgOk({ guides: guides, layers: layers, docName: doc.name });
    } catch (e) { return sgErr(e); }
}

// Toggle visibility of one grid layer.
function sg_toggleLayer(json) {
    try {
        var p = sgParse(json);
        if (!app.documents.length || app.activeDocument.name !== p.docName) return sgErr("Switch to " + p.docName + " first.");
        var l = sgFindLayerById(app.activeDocument, p.layerId);
        if (!l) return sgErr("That grid layer no longer exists.");
        l.visible = !l.visible;
        return sgOk({ visible: l.visible });
    } catch (e) { return sgErr(e); }
}

function sg_exportPresets(json) {
    try {
        var f = File.saveDialog("Export SwissGrid presets", "JSON:*.json");
        if (!f) return sgOk({ cancelled: true });
        if (!/\.json$/i.test(f.name)) f = new File(f.fsName + ".json");
        f.encoding = "UTF-8"; f.open("w"); f.write(json); f.close();
        return sgOk({ path: f.fsName });
    } catch (e) { return sgErr(e); }
}

function sg_importPresets() {
    try {
        var f = File.openDialog("Import SwissGrid presets", "JSON:*.json");
        if (!f) return sgOk({ cancelled: true });
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close();
        return sgOk({ text: txt });
    } catch (e) { return sgErr(e); }
}

/* ---------- type sizes: apply to selected text layers ---------- */

function sgHasBackground(doc) { try { return !!doc.backgroundLayer; } catch (e) { return false; } }

function sgSelectedIds(doc) {
    var ids = [];
    // Ask for this one property only: a full document read includes print settings and makes
    // Photoshop wait for the default printer ("Waiting for printer connection").
    var ref = new ActionReference();
    ref.putProperty(sgST("property"), sgST("targetLayers"));
    ref.putEnumerated(sgCT("Dcmn"), sgCT("Ordn"), sgCT("Trgt"));
    var d = executeActionGet(ref);
    var offset = sgHasBackground(doc) ? 0 : 1;
    if (d.hasKey(sgST("targetLayers"))) {
        var list = d.getList(sgST("targetLayers"));
        for (var i = 0; i < list.count; i++) {
            var r = new ActionReference();
            r.putIndex(sgCT("Lyr "), list.getReference(i).getIndex() + offset);
            try { ids.push(executeActionGet(r).getInteger(sgST("layerID"))); } catch (e) {}
        }
    }
    if (!ids.length) { try { ids.push(doc.activeLayer.id); } catch (e2) {} }
    return ids;
}

function sgSelectById(id, add) {
    var desc = new ActionDescriptor(), ref = new ActionReference();
    ref.putIdentifier(sgCT("Lyr "), id);
    desc.putReference(sgCT("null"), ref);
    if (add) desc.putEnumerated(sgST("selectionModifier"), sgST("selectionModifierType"), sgST("addToSelection"));
    desc.putBoolean(sgCT("MkVs"), false);
    executeAction(sgCT("slct"), desc, DialogModes.NO);
}

// Point size from a UnitValue without depending on the type units preference.
function sgUvPt(uv, res) { return uv.type === "px" ? uv.value * 72 / res : uv.as("pt"); }

// Is this layer a text layer? (ActionManager property read, no DOM text access)
function sgIsTextLayer(id) {
    try {
        var r = new ActionReference();
        r.putProperty(sgST("property"), sgST("layerKind"));
        r.putIdentifier(sgCT("Lyr "), id);
        return executeActionGet(r).getInteger(sgST("layerKind")) === 3;
    } catch (e) { return false; }
}

// Same command the Character panel sends when you change a value with a text layer selected.
// Photoshop applies only the feature named in textOverrideFeatureName, so size and leading are sent separately.
// (Editing textItem through the DOM can make Photoshop wait for the default printer.)
function sgSetTextStyleKeys(fill) {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putProperty(sgCT("Prpr"), sgCT("TxtS"));          // the layer's text style
    r.putEnumerated(sgCT("TxLr"), sgCT("Ordn"), sgCT("Trgt"));
    d.putReference(sgCT("null"), r);
    var t = new ActionDescriptor();
    fill(t);
    d.putObject(sgST("to"), sgST("textStyle"), t);
    executeAction(sgCT("setd"), d, DialogModes.NO);
}

function sgSetTextSize(size) {
    sgSetTextStyleKeys(function (t) {
        t.putInteger(sgST("textOverrideFeatureName"), 808465458);
        t.putInteger(sgST("typeStyleOperationType"), 3);
        t.putUnitDouble(sgST("size"), sgST("pointsUnit"), size);
    });
}

function sgSetTextLeading(leading) {
    sgSetTextStyleKeys(function (t) {
        t.putInteger(sgST("textOverrideFeatureName"), 808465461);   // leading
        t.putInteger(sgST("typeStyleOperationType"), 3);
        t.putBoolean(sgST("autoLeading"), false);
        t.putUnitDouble(sgCT("Ldng"), sgCT("#Pnt"), leading);
    });
}

// p = { size: pt, leading: pt, role: "Body" }
function sg_applyType(json) {
    try {
        var p = sgParse(json);
        if (!app.documents.length) return sgErr("Open a document first.");
        var doc = app.activeDocument, res = { done: 0, skipped: 0 };
        var ids = sgSelectedIds(doc), text = [];
        for (var i = 0; i < ids.length; i++) { if (sgIsTextLayer(ids[i])) text.push(ids[i]); else res.skipped++; }
        if (!text.length) return sgErr("Select a text layer first" + (res.skipped ? " (the selected layer isn't text)." : "."));
        $.global.__sg_job = function () {
            for (var k = 0; k < text.length; k++) {
                sgSelectById(text[k], false);
                try { sgSetTextSize(p.size); } catch (e1) { res.amError = String(e1.message || e1); }
                try { sgSetTextLeading(p.leading); } catch (e2) { res.amError = String(e2.message || e2); }
                // Check both took. Anything that didn't is set directly on the text item instead.
                var ti = doc.activeLayer.textItem, rz = doc.resolution;
                if (Math.abs(sgUvPt(ti.size, rz) - p.size) > 0.05) { ti.size = new UnitValue(p.size, "pt"); res.fallback = true; }
                var leadOk = false;
                try { leadOk = !ti.useAutoLeading && Math.abs(sgUvPt(ti.leading, rz) - p.leading) < 0.05; } catch (e3) {}
                if (!leadOk) { ti.useAutoLeading = false; ti.leading = new UnitValue(p.leading, "pt"); res.fallback = true; }
                var sizeOk = Math.abs(sgUvPt(ti.size, rz) - p.size) < 0.05;
                try { leadOk = !ti.useAutoLeading && Math.abs(sgUvPt(ti.leading, rz) - p.leading) < 0.05; } catch (e4) { leadOk = false; }
                if (sizeOk && leadOk) res.done++;
                else { res.failed = (res.failed || 0) + 1; if (sizeOk) res.done++; }
            }
            for (var j = 0; j < ids.length; j++) { try { sgSelectById(ids[j], j > 0); } catch (e) {} }
        };
        doc.suspendHistory("SwissGrid: " + (p.role || "Type") + " " + p.size + "/" + p.leading + " pt", "$.global.__sg_job()");
        if (!res.done) return sgErr("Photoshop didn't change the size" + (res.amError ? " (" + res.amError + ")" : "") + ". Try with the text layer selected but not in edit mode.");
        return sgOk(res);
    } catch (e) { return sgErr(e); }
}
