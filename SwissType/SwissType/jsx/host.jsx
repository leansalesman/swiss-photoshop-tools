// SwissType panel: Photoshop side (ExtendScript, ES3).
// Each st_* function takes a JSON string (or nothing) and returns a JSON string:
// {"ok":true,...} or {"ok":false,"error":"..."}.

// ---------------------------------------------------------------- JSON helpers

function stParse(s) { return eval("(" + s + ")"); }

function stStr(v) {
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(stStr(v[i])); return "[" + a.join(",") + "]"; }
    var p = [];
    for (var k in v) if (v.hasOwnProperty(k)) p.push(stStr(String(k)) + ":" + stStr(v[k]));
    return "{" + p.join(",") + "}";
}

function stOk(o) { o = o || {}; o.ok = true; return stStr(o); }
function stErr(e) { return stStr({ ok: false, error: String(e && e.message ? e.message : e) }); }

// ---------------------------------------------------------------- pure helpers (also tested outside Photoshop)

// Nearest value in list to v. direction: "nearest" | "up" (smaller y) | "down" (larger y)
function stNearest(v, list, direction) {
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
function stGridLines(top, unit, height) {
    var out = [];
    if (!(unit > 0)) return out;
    for (var y = top; y <= height + 0.001; y += unit) out.push(Math.round(y * 1000) / 1000);
    return out;
}

// ---------------------------------------------------------------- Photoshop helpers

function cT(s) { return charIDToTypeID(s); }
function sT(s) { return stringIDToTypeID(s); }

// Switch to px/pt only when needed, and put things back only if we changed them.
// Writing preferences (type units especially) can make Photoshop re-read its print setup, so never touch them needlessly.
function stUnits(fn) {
    var ru = app.preferences.rulerUnits, tu = app.preferences.typeUnits;
    var setR = ru !== Units.PIXELS, setT = tu !== TypeUnits.POINTS;
    if (setR) app.preferences.rulerUnits = Units.PIXELS;
    if (setT) app.preferences.typeUnits = TypeUnits.POINTS;
    try { return fn(); } finally {
        if (setR) app.preferences.rulerUnits = ru;
        if (setT) app.preferences.typeUnits = tu;
    }
}

// Read-only variant for the status poll: never writes preferences. Sizes are converted from whatever unit Photoshop reports.
function stNoPrefs(fn) { return fn(); }

// Unit-safe conversions that don't depend on the ruler/type unit preferences.
function stRes() { return app.activeDocument.resolution; }
function stUvPx(uv, res) { return uv.type === "px" ? uv.value : uv.as("in") * res; }
function stUvPt(uv, res) { return uv.type === "px" ? uv.value * 72 / res : uv.as("pt"); }
function stGuidesAny(doc, vertical) {
    var out = [], res = doc.resolution;
    for (var i = 0; i < doc.guides.length; i++) {
        var g = doc.guides[i];
        if ((g.direction === Direction.VERTICAL) === vertical) out.push(stUvPx(g.coordinate, res));
    }
    return out;
}

// Ask the document for one property only (a full document read includes print settings).
function stDocProp(key) {
    var ref = new ActionReference();
    ref.putProperty(sT("property"), sT(key));
    ref.putEnumerated(cT("Dcmn"), cT("Ordn"), cT("Trgt"));
    return executeActionGet(ref);
}

function stRequireDoc() {
    if (!app.documents.length) throw new Error("Open a document first.");
    return app.activeDocument;
}

function stHasBackground(doc) {
    try { return !!doc.backgroundLayer; } catch (e) { return false; }
}

// IDs of the selected layers.
function stSelectedIds(doc) {
    var ids = [];
    var d = stDocProp("targetLayers");
    var offset = stHasBackground(doc) ? 0 : 1;
    if (d.hasKey(sT("targetLayers"))) {
        var list = d.getList(sT("targetLayers"));
        for (var i = 0; i < list.count; i++) {
            var r = new ActionReference();
            r.putIndex(cT("Lyr "), list.getReference(i).getIndex() + offset);
            try { ids.push(executeActionGet(r).getInteger(sT("layerID"))); } catch (e) {}
        }
    }
    if (!ids.length) {
        try { ids.push(doc.activeLayer.id); } catch (e2) {}
    }
    return ids;
}

function stSelectById(id, add) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(cT("Lyr "), id);
    desc.putReference(cT("null"), ref);
    if (add) desc.putEnumerated(sT("selectionModifier"), sT("selectionModifierType"), sT("addToSelection"));
    desc.putBoolean(cT("MkVs"), false);
    executeAction(cT("slct"), desc, DialogModes.NO);
}

function stRestoreSelection(ids) {
    for (var i = 0; i < ids.length; i++) { try { stSelectById(ids[i], i > 0); } catch (e) {} }
}

// Runs fn(layer) for every selected text layer. Returns how many were processed.
function stEachText(doc, fn) {
    var ids = stSelectedIds(doc), n = 0, skipped = 0;
    for (var i = 0; i < ids.length; i++) {
        stSelectById(ids[i], false);
        var l = doc.activeLayer;
        if (l.kind === LayerKind.TEXT) { fn(l); n++; } else skipped++;
    }
    stRestoreSelection(ids);
    return { done: n, skipped: skipped };
}

function stFirstText(doc) {
    var ids = stSelectedIds(doc);
    for (var i = 0; i < ids.length; i++) {
        stSelectById(ids[i], false);
        if (doc.activeLayer.kind === LayerKind.TEXT) { var l = doc.activeLayer; stRestoreSelection(ids); return l; }
    }
    stRestoreSelection(ids);
    throw new Error("Select a text layer first.");
}

function stGuides(doc, vertical) {
    var out = [];
    for (var i = 0; i < doc.guides.length; i++) {
        var g = doc.guides[i];
        if ((g.direction === Direction.VERTICAL) === vertical) out.push(stUvPx(g.coordinate, stRes()));
    }
    out.sort(function (a, b) { return a - b; });
    return out;
}

// Baseline (px) of the first line of a text layer.
function stBaseline(doc, layer) {
    var ti = layer.textItem;
    if (ti.kind === TextType.POINTTEXT) return stUvPx(ti.position[1], stRes());
    // Paragraph text: measure on a point-text copy, which keeps the first baseline in place.
    var dup = layer.duplicate();
    try {
        dup.textItem.kind = TextType.POINTTEXT;
        return stUvPx(dup.textItem.position[1], stRes());
    } finally {
        dup.remove();
        doc.activeLayer = layer;
    }
}

function stPx(pt, doc) { return pt * doc.resolution / 72; }
function stPt(px, doc) { return px * 72 / doc.resolution; }

function stColorHex(ti) {
    try { return "#" + ti.color.rgb.hexValue; } catch (e) { return null; }
}

// ---------------------------------------------------------------- panel API


// Grids SwissGrid saved inside the document (XMP property swissgrid:grids).
// Read through a single ActionManager property get and plain text parsing: no XMP library load and no
// Document.xmpMetadata access, both of which can make Photoshop wake up its print/page setup on first use.
function stXmlUnescape(t) {
    return t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&#xA;/gi, "\n").replace(/&#xD;/gi, "\r").replace(/&#x9;/gi, "\t").replace(/&amp;/g, "&");
}
function stReadGrids(doc) {
    try {
        var ref = new ActionReference();
        ref.putProperty(sT("property"), sT("XMPMetadataAsUTF8"));
        ref.putEnumerated(cT("Dcmn"), cT("Ordn"), cT("Trgt"));
        var d = executeActionGet(ref);
        if (!d.hasKey(sT("XMPMetadataAsUTF8"))) return [];
        var xmp = d.getString(sT("XMPMetadataAsUTF8"));
        if (xmp.indexOf("swissgrid:grids") < 0) return [];
        var m = xmp.match(/swissgrid:grids="([^"]*)"/) || xmp.match(/<swissgrid:grids>([\s\S]*?)<\/swissgrid:grids>/);
        if (!m) return [];
        var list = stParse(stXmlUnescape(m[1]));
        return list && list.length !== undefined ? list : [];
    } catch (e) { return []; }
}

function st_info() {
    // Read-only and selection-safe: called every couple of seconds by the panel.
    try {
        if (!app.documents.length) return stOk({ doc: null });
        var doc = app.activeDocument;
        return stNoPrefs(function () {
            var count = 0;
            try {
                var d = stDocProp("targetLayers");
                count = d.hasKey(sT("targetLayers")) ? d.getList(sT("targetLayers")).count : 1;
            } catch (e) { count = 1; }
            var first = null, l = null;
            try { l = doc.activeLayer; } catch (e2) {}
            if (l && l.kind === LayerKind.TEXT) {
                var ti = l.textItem;
                var res = doc.resolution;
                first = {
                    name: l.name, font: ti.font, size: stUvPt(ti.size, res),
                    leading: ti.useAutoLeading ? null : stUvPt(ti.leading, res),
                    tracking: ti.tracking, kind: ti.kind === TextType.POINTTEXT ? "point" : "paragraph"
                };
            }
            return stOk({
                doc: { name: doc.name, width: Math.round(stUvPx(doc.width, doc.resolution)), height: Math.round(stUvPx(doc.height, doc.resolution)), ppi: doc.resolution },
                selected: count, first: first, activeName: l ? l.name : null,
                hGuides: stGuidesAny(doc, false).length, vGuides: stGuidesAny(doc, true).length,
                grids: stReadGrids(doc)
            });
        });
    } catch (e) { return stErr(e); }
}

// p: { target:"guides"|"grid", top:px, unit:px, direction:"nearest"|"up"|"down" }
function st_snapBaseline(json) {
    try {
        var p = stParse(json), doc = stRequireDoc(), res = { moved: 0, skipped: 0, details: [] };
        stUnits(function () {
            var lines = p.lines && p.lines.length ? p.lines : (p.target === "grid" ? stGridLines(p.top, p.unit, stUvPx(doc.height, stRes())) : stGuides(doc, false));
            if (!lines.length) throw new Error(p.target === "grid" ? "Enter a baseline grid (top and unit)." : "No horizontal guides. Add a baseline grid with SwissGrid, or switch to Baseline grid.");
            $.global.__st_job = function () {
                var r = stEachText(doc, function (l) {
                    var b = stBaseline(doc, l);
                    var t = stNearest(b, lines, p.direction);
                    if (t === null) { res.details.push(l.name + ": no guide in that direction"); return; }
                    var dy = t - b;
                    if (Math.abs(dy) > 0.01) l.translate(new UnitValue(0, "px"), new UnitValue(dy, "px"));
                    res.moved++;
                    res.details.push(l.name + ": " + (dy >= 0 ? "+" : "") + (Math.round(dy * 10) / 10) + " px");
                });
                res.skipped = r.skipped;
            };
            doc.suspendHistory("SwissType: Snap to baseline", "$.global.__st_job()");
        });
        return stOk(res);
    } catch (e) { return stErr(e); }
}

// p: { edge:"left"|"right"|"top"|"bottom", direction:"nearest"|"in"|"out" }
// Aligns the visible ink of each selected text layer (not its text box) to the nearest guide.
function st_opticalAlign(json) {
    try {
        var p = stParse(json), doc = stRequireDoc(), res = { moved: 0, skipped: 0, details: [] };
        stUnits(function () {
            var vertical = p.edge === "left" || p.edge === "right";
            var lines = stGuides(doc, vertical);
            if (!lines.length) throw new Error("No " + (vertical ? "vertical" : "horizontal") + " guides to align to.");
            $.global.__st_job = function () {
                var r = stEachText(doc, function (l) {
                    var b = l.bounds; // visible pixels: [left, top, right, bottom]
                    var idx = { left: 0, top: 1, right: 2, bottom: 3 }[p.edge];
                    var edge = stUvPx(b[idx], stRes());
                    var t = stNearest(edge, lines, "nearest");
                    if (t === null) return;
                    var d = t - edge;
                    if (Math.abs(d) > 0.01) {
                        if (vertical) l.translate(new UnitValue(d, "px"), new UnitValue(0, "px"));
                        else l.translate(new UnitValue(0, "px"), new UnitValue(d, "px"));
                    }
                    res.moved++;
                    res.details.push(l.name + ": " + (d >= 0 ? "+" : "") + (Math.round(d * 10) / 10) + " px");
                });
                res.skipped = r.skipped;
            };
            doc.suspendHistory("SwissType: Optical edge align", "$.global.__st_job()");
        });
        return stOk(res);
    } catch (e) { return stErr(e); }
}

// p: { size:pt, leading:pt|null, tracking:number|null, snap:{target,top,unit}|null }
function st_applySize(json) {
    try {
        var p = stParse(json), doc = stRequireDoc(), res = { done: 0, skipped: 0 };
        stUnits(function () {
            var lines = null;
            if (p.snap) lines = p.snap.lines && p.snap.lines.length ? p.snap.lines : p.snap.target === "grid" ? stGridLines(p.snap.top, p.snap.unit, stUvPx(doc.height, stRes())) : stGuides(doc, false);
            $.global.__st_job = function () {
                var r = stEachText(doc, function (l) {
                    var ti = l.textItem;
                    var before = lines && lines.length ? stBaseline(doc, l) : null;
                    ti.size = new UnitValue(p.size, "pt");
                    if (p.leading) { ti.useAutoLeading = false; ti.leading = new UnitValue(p.leading, "pt"); }
                    if (p.tracking !== null && p.tracking !== undefined) ti.tracking = p.tracking;
                    if (before !== null) {
                        var b = stBaseline(doc, l);
                        var t = stNearest(b, lines, "nearest");
                        if (t !== null && Math.abs(t - b) > 0.01) l.translate(new UnitValue(0, "px"), new UnitValue(t - b, "px"));
                    }
                });
                res.done = r.done; res.skipped = r.skipped;
            };
            doc.suspendHistory("SwissType: " + p.size + "/" + (p.leading || "auto") + " pt", "$.global.__st_job()");
        });
        return stOk(res);
    } catch (e) { return stErr(e); }
}

// Measure the first selected text layer (Bringhurst copyfitting: lowercase alphabet length).
function st_measure() {
    try {
        var doc = stRequireDoc();
        return stUnits(function () {
            var l = stFirstText(doc), ti = l.textItem;
            var size = stUvPt(ti.size, stRes());
            var b = l.bounds;
            var measurePx = stUvPx(b[2], stRes()) - stUvPx(b[0], stRes());
            var isPoint = ti.kind === TextType.POINTTEXT;
            var boxPx = null;
            if (!isPoint) { try { boxPx = stUvPx(ti.width, stRes()); } catch (e) { boxPx = null; } }

            // Alphabet length in the same font, size and tracking.
            var alphaPx = null;
            $.global.__st_job = function () {
                var t = doc.artLayers.add();
                t.kind = LayerKind.TEXT;
                var tt = t.textItem;
                tt.kind = TextType.POINTTEXT;
                tt.contents = "abcdefghijklmnopqrstuvwxyz";
                tt.font = ti.font;
                tt.size = new UnitValue(size, "pt");
                try { tt.tracking = ti.tracking; } catch (e) {}
                tt.position = [new UnitValue(0, "px"), new UnitValue(stUvPx(doc.height, stRes()) / 2, "px")];
                var tb = t.bounds;
                alphaPx = stUvPx(tb[2], stRes()) - stUvPx(tb[0], stRes());
                t.remove();
                doc.activeLayer = l;
            };
            doc.suspendHistory("SwissType: Measure", "$.global.__st_job()");

            var lines = [];
            if (isPoint) {
                var parts = String(ti.contents).split(/\r|\n|\u0003/);
                for (var i = 0; i < parts.length; i++) lines.push(parts[i].length);
            }
            return stOk({
                name: l.name, font: ti.font, size: size, kind: isPoint ? "point" : "paragraph",
                measurePt: stPt(measurePx, doc), boxPt: boxPx === null ? null : stPt(boxPx, doc),
                alphabetPt: alphaPx === null ? null : stPt(alphaPx, doc),
                chars: String(ti.contents).length, lines: lines
            });
        });
    } catch (e) { return stErr(e); }
}

function st_readStyle() {
    try {
        var doc = stRequireDoc();
        return stUnits(function () {
            var l = stFirstText(doc), ti = l.textItem, s = {};
            s.font = ti.font;
            s.size = stUvPt(ti.size, stRes());
            s.autoLeading = ti.useAutoLeading;
            s.leading = ti.useAutoLeading ? null : stUvPt(ti.leading, stRes());
            s.tracking = ti.tracking;
            s.color = stColorHex(ti);
            try { s.capitalization = String(ti.capitalization); } catch (e) { s.capitalization = null; }
            try { s.justification = String(ti.justification); } catch (e2) { s.justification = null; }
            return stOk({ style: s, layer: l.name });
        });
    } catch (e) { return stErr(e); }
}

// p: { style:{...}, parts:{font,size,leading,tracking,color,case,align} }
function st_applyStyle(json) {
    try {
        var p = stParse(json), doc = stRequireDoc(), s = p.style, on = p.parts || {}, res = { done: 0, skipped: 0 };
        function enumFrom(path) {
            if (!path) return null;
            var bits = String(path).split(".");
            var obj = $.global[bits[0]];
            for (var i = 1; i < bits.length && obj; i++) obj = obj[bits[i]];
            return obj || null;
        }
        stUnits(function () {
            $.global.__st_job = function () {
                var r = stEachText(doc, function (l) {
                    var ti = l.textItem;
                    if (on.font !== false && s.font) ti.font = s.font;
                    if (on.size !== false && s.size) ti.size = new UnitValue(s.size, "pt");
                    if (on.leading !== false) {
                        if (s.autoLeading) ti.useAutoLeading = true;
                        else if (s.leading) { ti.useAutoLeading = false; ti.leading = new UnitValue(s.leading, "pt"); }
                    }
                    if (on.tracking !== false && s.tracking !== null && s.tracking !== undefined) ti.tracking = s.tracking;
                    if (on.color !== false && s.color) {
                        var c = new SolidColor(); c.rgb.hexValue = String(s.color).replace("#", ""); ti.color = c;
                    }
                    if (on["case"] !== false && s.capitalization) { var cap = enumFrom(s.capitalization); if (cap) ti.capitalization = cap; }
                    if (on.align !== false && s.justification) { var j = enumFrom(s.justification); if (j) ti.justification = j; }
                });
                res.done = r.done; res.skipped = r.skipped;
            };
            doc.suspendHistory("SwissType: Apply style", "$.global.__st_job()");
        });
        return stOk(res);
    } catch (e) { return stErr(e); }
}

function st_exportFile(json) {
    try {
        var f = File.saveDialog("Export SwissType styles", "JSON:*.json");
        if (!f) return stOk({ cancelled: true });
        if (!/\.json$/i.test(f.name)) f = new File(f.fsName + ".json");
        f.encoding = "UTF-8"; f.open("w"); f.write(json); f.close();
        return stOk({ path: f.fsName });
    } catch (e) { return stErr(e); }
}

function st_importFile() {
    try {
        var f = File.openDialog("Import SwissType styles", "JSON:*.json");
        if (!f) return stOk({ cancelled: true });
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close();
        return stOk({ text: txt });
    } catch (e) { return stErr(e); }
}


// Read-only report for debugging on other Photoshop versions: what SwissType measures for each selected text layer.
function st_diag() {
    try {
        var doc = stRequireDoc(), out = { ps: String(app.version), os: String($.os), res: doc.resolution,
            rulerUnits: String(app.preferences.rulerUnits), typeUnits: String(app.preferences.typeUnits),
            docPx: [stUvPx(doc.width, doc.resolution), stUvPx(doc.height, doc.resolution)],
            hGuides: stGuidesAny(doc, false).length, layers: [] };
        stUnits(function () {
            $.global.__st_job = function () {
                stEachText(doc, function (l) {
                    var ti = l.textItem, b = l.bounds, info = { name: l.name };
                    try { info.kind = ti.kind === TextType.POINTTEXT ? "point" : "paragraph"; } catch (e) { info.kind = "?" + e; }
                    try { info.position = [String(ti.position[0]), String(ti.position[1])]; } catch (e) { info.position = "?" + e; }
                    try { info.bounds = [String(b[0]), String(b[1]), String(b[2]), String(b[3])]; } catch (e) { info.bounds = "?" + e; }
                    try { info.size = String(ti.size); info.autoLeading = ti.useAutoLeading; info.leading = ti.useAutoLeading ? null : String(ti.leading); } catch (e) { info.size = "?" + e; }
                    try { info.baselinePx = stBaseline(doc, l); } catch (e) { info.baselinePx = "?" + e; }
                    try { info.contentsStart = String(ti.contents).substr(0, 24); } catch (e) {}
                    out.layers.push(info);
                });
            };
            doc.suspendHistory("SwissType: Diagnostics", "$.global.__st_job()");
        });
        return stOk(out);
    } catch (e) { return stErr(e); }
}
