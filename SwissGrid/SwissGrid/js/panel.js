/* SwissGrid panel (CEP). Computes grids here, draws them through jsx/host.jsx. */
(function () {
  "use strict";

  var G = window.GridMath;
  var cep = window.__adobe_cep__;

  var PRESET_KEY = "swissgrid.presets.v1";
  var LAST_KEY = "swissgrid.lastForm.v1";
  var APPLIED_KEY = "swissgrid.applied.v1";

  var TEXT = ["gridName", "colorHex", "marginLeft", "marginRight", "columns", "columnWidth", "columnGutter",
    "marginTop", "marginBottom", "rows", "rowHeight", "rowGutter"];
  var SELECTS = { unit: "mm", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1" };
  var CHECKS = ["midVertical", "midHorizontal"];

  var QUICK = ["#00AEEF", "#FF2D95", "#FF3B30", "#2F6BFF", "#34C759", "#FF9500", "#FFD60A", "#8E8E93"];

  var DEFAULT_PRESETS = [
    { gridName: "6x6 Square Swiss Grid", colorHex: "#2F6BFF", unit: "mm", marginLeft: "15.24", marginRight: "30.48", columns: "6", columnWidth: "30.48", columnGutter: "5.08", marginTop: "15.24", marginBottom: "30.48", rows: "6", rowHeight: "30.48", rowGutter: "5.08", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "Text Baseline 6x6 Swiss Grid", colorHex: "#FF3B30", unit: "mm", marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "", marginTop: "15.24", marginBottom: "", rows: "41", rowHeight: "5.08", rowGutter: "0", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "A3 Poster 4x4 + Center Cross", colorHex: "#00AEEF", unit: "px", marginLeft: "75", marginRight: "76", columns: "4", columnWidth: "783", columnGutter: "75", marginTop: "118", marginBottom: "118", rows: "4", rowHeight: "1125", rowGutter: "75", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "2", midVertical: true, midHorizontal: true },
    { gridName: "A3 Poster Baseline", colorHex: "#FF2D95", unit: "px", marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "", marginTop: "118", marginBottom: "", rows: "63", rowHeight: "75", rowGutter: "0", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "A4 4x5 Swiss Grid (300 ppi)", colorHex: "#34C759", unit: "px", marginLeft: "150", marginRight: "152", columns: "4", columnWidth: "507", columnGutter: "50", marginTop: "200", marginBottom: "358", rows: "5", rowHeight: "550", rowGutter: "50", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "A4 Baseline 10/12 (300 ppi)", colorHex: "#FF9500", unit: "px", marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "", marginTop: "200", marginBottom: "", rows: "59", rowHeight: "50", rowGutter: "0", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "Letter 4x5 Swiss Grid (300 ppi)", colorHex: "#00AEEF", unit: "px", marginLeft: "200", marginRight: "200", columns: "4", columnWidth: "500", columnGutter: "50", marginTop: "200", marginBottom: "400", rows: "5", rowHeight: "500", rowGutter: "50", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "Letter Baseline 10/12 (300 ppi)", colorHex: "#FF2D95", unit: "px", marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "", marginTop: "200", marginBottom: "", rows: "54", rowHeight: "50", rowGutter: "0", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "1", midVertical: false, midHorizontal: false },
    { gridName: "Golden Section Divisions (any canvas)", colorHex: "#FFD60A", unit: "%", marginLeft: "38.197", marginRight: "38.197", columns: "", columnWidth: "", columnGutter: "", marginTop: "38.197", marginBottom: "38.197", rows: "", rowHeight: "", rowGutter: "", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "2", midVertical: false, midHorizontal: false },
    { gridName: "Golden Textblock A4 (300 ppi)", colorHex: "#E0A800", unit: "px", marginLeft: "275.56", marginRight: "551.11", columns: "", columnWidth: "", columnGutter: "", marginTop: "275.56", marginBottom: "551.11", rows: "", rowHeight: "", rowGutter: "", alignH: "start", alignV: "start", drawMode: "both", lineWidth: "2", midVertical: false, midHorizontal: false }
  ];

  var doc = null;          // { name, width, height, ppi, guides }
  var colorGuides = false; // Photoshop can color individual guides (2023+)
  var busy = false;
  var applied = load(APPLIED_KEY, {}); // docName -> [{ uid, name, hex, mode, layerId, vertical, horizontal, lines, hidden }]

  function $(id) { return document.getElementById(id); }

  function load(key, fallback) {
    try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }

  function status(msg, kind) {
    var el = $("status");
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "cls") n.className = props[k];
      else if (k === "style") n.setAttribute("style", props[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  /* ---------- host bridge ---------- */

  function host(call) {
    return new Promise(function (resolve, reject) {
      if (!cep || !cep.evalScript) { reject(new Error("Not running inside Photoshop.")); return; }
      cep.evalScript(call, function (res) {
        if (res === "EvalScript error.") { reject(new Error("Photoshop script error.")); return; }
        var data;
        try { data = JSON.parse(res); } catch (e) { reject(new Error("Unexpected reply from Photoshop: " + res)); return; }
        if (!data.ok) { reject(new Error(data.error || "Unknown error")); return; }
        resolve(data);
      });
    });
  }

  function arg(obj) { return JSON.stringify(JSON.stringify(obj)); }

  /* ---------- theme ---------- */

  function applyTheme() {
    try {
      var env = JSON.parse(cep.getHostEnvironment());
      var c = env.appSkinInfo.panelBackgroundColor.color;
      var hex = G.rgbToHex(c.red, c.green, c.blue);
      document.documentElement.style.setProperty("--bg", hex);
      var lum = (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255;
      document.body.classList.toggle("light", lum > 0.55);
      if (lum <= 0.55) {
        var shade = function (d) { return G.rgbToHex(c.red + d, c.green + d, c.blue + d); };
        document.documentElement.style.setProperty("--field", shade(-14));
        document.documentElement.style.setProperty("--btn", shade(20));
        document.documentElement.style.setProperty("--btn-hover", shade(32));
        document.documentElement.style.setProperty("--line", shade(24));
      }
    } catch (e) { /* keep defaults */ }
  }

  /* ---------- form ---------- */

  function readForm() {
    var f = {};
    TEXT.forEach(function (id) { f[id] = $(id).value.trim(); });
    Object.keys(SELECTS).forEach(function (id) { f[id] = $(id).value; });
    CHECKS.forEach(function (id) { f[id] = $(id).checked; });
    return f;
  }

  function writeForm(f) {
    TEXT.forEach(function (id) { if (f[id] !== undefined) $(id).value = f[id]; });
    Object.keys(SELECTS).forEach(function (id) { if (f[id] !== undefined) $(id).value = String(f[id]); });
    CHECKS.forEach(function (id) { if (f[id] !== undefined) $(id).checked = !!f[id]; });
    lastUnit = $("unit").value;
    LENGTHS.forEach(function (id) { delete $(id).dataset.px; delete $(id).dataset.shown; });
    syncColor(false);
    updatePreview();
  }

  /* ---------- unit switching ---------- */

  // Length fields and which axis they belong to (for % and conversions).
  var LENGTHS = ["marginLeft", "marginRight", "columnWidth", "columnGutter", "marginTop", "marginBottom", "rowHeight", "rowGutter"];
  var AXIS = { marginLeft: "x", marginRight: "x", columnWidth: "x", columnGutter: "x", marginTop: "y", marginBottom: "y", rowHeight: "y", rowGutter: "y" };
  var DECIMALS = { px: 2, mm: 3, cm: 4, in: 4, pt: 2, "%": 4 };
  var lastUnit = null;

  function unitContext(id, unit) {
    var d = doc || { width: 3000, height: 3000, ppi: 300 };
    return { ppi: d.ppi, size: AXIS[id] === "x" ? d.width : d.height, defaultUnit: unit };
  }

  function fromPx(px, id, unit) {
    var c = unitContext(id, unit), v;
    switch (unit) {
      case "mm": v = px / c.ppi * 25.4; break;
      case "cm": v = px / c.ppi * 2.54; break;
      case "in": v = px / c.ppi; break;
      case "pt": v = px / c.ppi * 72; break;
      case "%": v = px / c.size * 100; break;
      default: v = px;
    }
    var f = Math.pow(10, DECIMALS[unit] || 2);
    return String(Math.round(v * f) / f);
  }

  function convertUnits(from, to) {
    var before = {}, changed = 0, failed = [];
    LENGTHS.forEach(function (id) {
      var e = $(id), raw = e.value.trim();
      before[id] = e.value;
      if (!raw) return;
      var px;
      try {
        // Use the exact value from the last conversion if the field hasn't been edited since.
        px = (e.dataset.px && e.dataset.shown === raw) ? parseFloat(e.dataset.px) : G.toPx(raw, unitContext(id, from));
      } catch (err) { failed.push(id); return; }
      if (px === null || isNaN(px)) return;
      var shown = fromPx(px, id, to);
      e.value = shown;
      e.dataset.px = String(px);
      e.dataset.shown = shown;
      changed++;
    });
    lastUnit = to;
    updatePreview();
    remember();
    if (!changed) { status("Unit set to " + to + "."); return; }
    var msg = "Converted " + changed + (changed === 1 ? " field" : " fields") + " from " + from + " to " + to + (doc ? "" : " (no document open, assumed 300 ppi)") + ". ";
    if (failed.length) msg += "Couldn't read: " + failed.join(", ") + ". ";
    var s = $("status");
    s.className = "status ok";
    s.textContent = msg;
    s.appendChild(el("button", { cls: "icon", text: "Keep the numbers instead", title: "Put the numbers back as they were, read as " + to, onclick: function () {
      LENGTHS.forEach(function (id) { $(id).value = before[id]; delete $(id).dataset.px; delete $(id).dataset.shown; });
      updatePreview(); remember();
      status("Kept your numbers, now read as " + to + ".", "ok");
    } }));
  }

  function remember() { save(LAST_KEY, readForm()); }

  function syncColor(fromPicker) {
    if (fromPicker) {
      $("colorHex").value = $("colorPicker").value.toUpperCase();
    } else {
      try {
        var c = G.hexToRgb($("colorHex").value);
        $("colorPicker").value = G.rgbToHex(c.r, c.g, c.b).toLowerCase();
      } catch (e) { /* invalid while typing */ }
    }
  }

  function clearInputs() {
    var keep = { colorHex: $("colorHex").value, unit: $("unit").value, drawMode: $("drawMode").value, lineWidth: $("lineWidth").value };
    TEXT.forEach(function (id) { $(id).value = ""; });
    $("alignH").value = "start"; $("alignV").value = "start";
    CHECKS.forEach(function (id) { $(id).checked = false; });
    writeForm(keep);
    remember();
    status("Inputs cleared. Color, unit and draw mode kept.", "ok");
  }

  /* ---------- live preview ---------- */

  function compute(f) {
    if (!doc) throw new Error("Open a document to see the grid size.");
    // Fields not edited since a unit switch use their exact pixel value, so rounding never breaks a grid.
    var exact = {};
    Object.keys(f).forEach(function (k) { exact[k] = f[k]; });
    LENGTHS.forEach(function (id) {
      var e = $(id);
      if (e && e.dataset.px && e.value.trim() === e.dataset.shown && exact[id] === e.value) exact[id] = e.dataset.px + "px";
    });
    return G.computeGrid(exact, { width: doc.width, height: doc.height, ppi: doc.ppi, fmt: fmt });
  }

  function fmt(px) {
    if (!doc) return px + " px";
    var u = $("unit").value;
    if (u === "mm") return (px / doc.ppi * 25.4).toFixed(2) + " mm";
    if (u === "in") return (px / doc.ppi).toFixed(3) + " in";
    if (u === "cm") return (px / doc.ppi * 2.54).toFixed(3) + " cm";
    if (u === "pt") return (px / doc.ppi * 72).toFixed(2) + " pt";
    return (Math.round(px * 100) / 100) + " px";
  }

  function updatePreview() {
    var p = $("preview");
    try {
      var g = compute(readForm());
      var parts = [];
      if (g.columns.count) parts.push(g.columns.count + " col × " + fmt(g.columns.cell));
      if (g.rows.count) parts.push(g.rows.count + " row × " + fmt(g.rows.cell));
      var n = g.vertical.length + g.horizontal.length;
      p.textContent = n ? (parts.length ? parts.join("  ·  ") + "  ·  " : "") + n + " lines" : "Enter margins, columns or rows.";
      p.className = "preview";
      renderTypeRec(readForm(), g);
    } catch (e) {
      p.textContent = e.message;
      p.className = "preview err";
      renderTypeRec(null, null);
    }
  }

  /* ---------- type recommendations ---------- */

  function renderTypeRec(form, g) {
    var box = $("typeRec");
    box.innerHTML = "";
    if (!form || !g || !doc || !window.TypeRec) {
      box.appendChild(el("div", { cls: "empty", text: doc ? "Fix the grid above to see type sizes." : "Open a document to see type sizes." }));
      return;
    }
    var r;
    try { r = window.TypeRec.recommend(form, doc, g, G); } catch (e) {
      box.appendChild(el("div", { cls: "empty", text: e.message }));
      return;
    }
    box.appendChild(el("div", { cls: "tr-unit", text: "Baseline unit " + r.unitPt + " pt (" + r.unitMm + " mm, " + r.unitPx + " px)" +
      (r.fieldUnits ? " · " + r.fieldUnits + " lines per field" : "") }));
    box.appendChild(el("div", { cls: "tr-src", text: "From the " + r.source + "." }));
    var table = el("div", { cls: "tr-table" });
    r.roles.forEach(function (x) {
      var sizeTxt = x.size + " / " + x.leading + " pt";
      table.appendChild(el("div", { cls: "tr-row", title: x.note || "" }, [
        el("span", { cls: "tr-role", text: x.role }),
        el("span", { cls: "tr-size", text: sizeTxt }),
        el("span", { cls: "tr-units", text: x.units === 0.5 ? "½ line" : x.units + (x.units === 1 ? " line" : " lines") }),
        el("button", { cls: "icon tr-copy tr-apply", text: "Apply", title: "Set the selected text layer(s) to " + sizeTxt + " (right-click to copy instead)",
          onclick: function () { applyType(x); },
          oncontextmenu: function (ev) { ev.preventDefault(); copyText(x.size + "/" + x.leading + " pt", x.role); } })
      ]));
    });
    box.appendChild(table);
    var b = r.body.best;
    var where = b.cols ? "across " + b.cols + (b.cols === 1 ? " column" : " columns") : "across the full text width";
    box.appendChild(el("div", { cls: "tr-body " + (r.body.ok ? "ok" : "warn"),
      text: "Body text " + where + " ≈ " + b.chars + " characters per line" + (r.body.ok ? " (Bringhurst: 45–75, ideal 66)." : ". Outside Bringhurst's 45–75; add columns or change the body size.") }));
    if (r.note) box.appendChild(el("div", { cls: "tr-note", text: r.note }));
    box.appendChild(el("div", { cls: "tr-src", text: "Select text layers in Photoshop, then Apply. Right-click Apply to copy instead. Hover a row for why; Subhead is the body size in bold." }));
  }

  function applyType(x) {
    var label = x.role + " " + x.size + "/" + x.leading + " pt";
    host("sg_applyType(" + arg({ size: x.size, leading: x.leading, role: x.role }) + ")").then(function (r) {
      status(label + " applied to " + r.done + (r.done === 1 ? " text layer" : " text layers") +
        (r.skipped ? " (" + r.skipped + " non-text skipped)" : "") + (r.failed ? ", " + r.failed + " didn't change" : "") + ". Ctrl+Z undoes it.", r.failed ? "err" : "ok");
    }).catch(function (e) { status(e.message, "err"); });
  }

  function copyText(txt, label) {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      status("Copied " + label + ": " + txt, "ok");
    } catch (e) { status(label + ": " + txt, "ok"); }
  }

  /* ---------- document ---------- */

  function refreshDoc() {
    if (busy) return Promise.resolve();
    return host("sg_docInfo()").then(function (d) {
      var changed = JSON.stringify(d.doc) !== JSON.stringify(doc);
      doc = d.doc;
      colorGuides = !!d.colorGuides;
      if (!doc) {
        $("docInfo").textContent = "No document open · Photoshop " + d.psVersion;
      } else {
        $("docInfo").textContent = doc.name + " · " + doc.width + " × " + doc.height + " px · " + doc.ppi + " ppi · " +
          (doc.width / doc.ppi * 25.4).toFixed(1) + " × " + (doc.height / doc.ppi * 25.4).toFixed(1) + " mm";
      }
      if (changed) { updatePreview(); renderApplied(); }
    }).catch(function (e) {
      $("docInfo").textContent = e.message;
    });
  }

  /* ---------- apply / remove ---------- */

  function setBusy(b) {
    busy = b;
    $("btnApply").disabled = b;
    $("btnBaseline").disabled = b;
    $("btnApply").textContent = b ? "Working…" : "Apply grid";
  }

  function r2(v) { return Math.round(v * 100) / 100; }

  // Horizontal lines of this grid without the midpoint, plus top and line step if evenly spaced.
  function baselineRecord(f, g, uid, name, hex) {
    var lines = g.horizontal;
    if (f.midHorizontal) { try { lines = compute(Object.assign({}, f, { midHorizontal: false })).horizontal; } catch (e) {} }
    lines = lines.slice().sort(function (a, b) { return a - b; });
    var step = null;
    if (lines.length > 2) {
      step = lines[1] - lines[0];
      for (var i = 2; i < lines.length; i++) if (Math.abs(lines[i] - lines[i - 1] - step) > 0.01) { step = null; break; }
    }
    return { uid: uid, name: name, hex: hex, top: lines.length ? lines[0] : null, step: step === null ? null : r2(step),
      rows: g.rows.count || 0, cell: g.rows.cell, lines: lines };
  }

  // Builds the baseline grid that belongs to the grid in the inputs (same unit the type sizes use).
  function baselineForm(f) {
    if (!doc) throw new Error("Open a document first.");
    var g = compute(f);
    var r = window.TypeRec.recommend(f, doc, g, G);
    if (r.isBaseline) throw new Error("These measurements already are a baseline grid (" + r.unitPt + " pt lines). Apply grid adds it.");
    var L = r.lpx;
    var noMid = f.midHorizontal ? compute(Object.assign({}, f, { midHorizontal: false })) : g;
    var h = noMid.rows.count ? noMid.horizontal.slice().sort(function (a, b) { return a - b; }) : [];
    var cy = { ppi: doc.ppi, size: doc.height, defaultUnit: f.unit || "px" };
    var top = h.length ? h[0] : (G.toPx(f.marginTop, cy) || 0);
    var bottom = h.length ? h[h.length - 1] : doc.height - (G.toPx(f.marginBottom, cy) || 0);
    var exact = (bottom - top) / L;
    var count = Math.abs(exact - Math.round(exact)) < 0.02 ? Math.round(exact) : Math.floor(exact);
    if (count < 2) throw new Error("There isn't room for a baseline grid between the margins.");
    var color = String(f.colorHex).toUpperCase() === "#FF3B30" ? "#00AEEF" : "#FF3B30";
    return {
      form: {
        gridName: (f.gridName || "Grid") + " Baseline " + r.unitPt + " pt", colorHex: color,
        drawMode: f.drawMode || "both", lineWidth: f.lineWidth || "1", unit: "px",
        marginLeft: "", marginRight: "", columns: "", columnWidth: "", columnGutter: "", alignH: "start", midVertical: false,
        marginTop: String(top), marginBottom: "", rows: String(count), rowHeight: String(L), rowGutter: "0", alignV: "start", midHorizontal: false
      },
      info: { unitPt: r.unitPt, unitPx: r.unitPx, count: count, body: r.roles[1] }
    };
  }

  function applyBaseline() {
    var b;
    try { b = baselineForm(readForm()); } catch (e) { status(e.message, "err"); return; }
    applyGrid(b.form, function () {
      status("Applied “" + b.form.gridName + "”: " + (b.info.count + 1) + " lines every " + b.info.unitPx + " px (" + b.info.unitPt + " pt), body " +
        b.info.body.size + "/" + b.info.body.leading + " pt. SwissType will snap to it.", "ok");
    });
  }

  function applyGrid(f, done) {
    if (busy) return;
    var g, rgb;
    try { rgb = G.hexToRgb(f.colorHex); g = compute(f); } catch (e) { status(e.message, "err"); return; }
    var total = g.vertical.length + g.horizontal.length;
    if (!total) { status("Nothing to draw. Enter margins, columns or rows.", "err"); return; }

    var name = f.gridName || "Untitled grid";
    var hex = G.rgbToHex(rgb.r, rgb.g, rgb.b);
    var uid = String(Date.now()) + Math.floor(Math.random() * 1000);
    var record = baselineRecord(f, g, uid, name, hex);
    var payload = { name: name, rgb: rgb, mode: f.drawMode || "both", lineWidth: Number(f.lineWidth) || 1, vertical: g.vertical, horizontal: g.horizontal, record: record };

    setBusy(true);
    status("Drawing " + total + " lines…");
    host("sg_apply(" + arg(payload) + ")").then(function (r) {
      setBusy(false);
      var list = applied[r.docName] || [];
      list.push({
        uid: uid, top: record.top, step: record.step, rowLines: record.lines.length,
        name: name, hex: hex, mode: payload.mode, layerId: r.layerId,
        vertical: payload.mode === "layer" ? [] : g.vertical,
        horizontal: payload.mode === "layer" ? [] : g.horizontal,
        lines: total, hidden: false
      });
      applied[r.docName] = list;
      save(APPLIED_KEY, applied);
      renderApplied();
      remember();

      var msg = "Applied “" + name + "” in " + hex + ": " + total + " lines";
      if (payload.mode !== "guides") msg += " on its own layer";
      if (payload.mode === "both") msg += " + guides";
      if (payload.mode === "guides") msg += " as guides";
      if (payload.mode !== "layer" && r.colored < r.guides) msg += ". Guides use your default guide color on this Photoshop version";
      status(msg + ".", "ok");
      if (done) done();
      refreshDoc();
    }).catch(function (e) {
      setBusy(false);
      status(e.message, "err");
    });
  }

  function removeGrid(entry) {
    if (!doc || doc.name !== currentDocName()) return;
    var payload = { docName: doc.name, vertical: entry.vertical, horizontal: entry.horizontal, layerId: entry.layerId, name: entry.name, uid: entry.uid };
    setBusy(true);
    host("sg_remove(" + arg(payload) + ")").then(function (r) {
      setBusy(false);
      applied[doc.name] = (applied[doc.name] || []).filter(function (a) { return a.uid !== entry.uid; });
      save(APPLIED_KEY, applied);
      renderApplied();
      status("Removed “" + entry.name + "” (" + r.removed + " guides" + (r.layerGone ? " and its layer" : "") + ").", "ok");
      refreshDoc();
    }).catch(function (e) { setBusy(false); status(e.message, "err"); });
  }

  function toggleGrid(entry) {
    if (entry.layerId === null || entry.layerId === undefined) {
      status("Guides-only grids have no layer to hide. Use View > Show > Guides (Ctrl+;).", "err");
      return;
    }
    host("sg_toggleLayer(" + arg({ docName: doc.name, layerId: entry.layerId }) + ")").then(function (r) {
      entry.hidden = !r.visible;
      save(APPLIED_KEY, applied);
      renderApplied();
    }).catch(function (e) { status(e.message, "err"); });
  }

  function clearAll() {
    if (busy) return;
    setBusy(true);
    host("sg_clearAll()").then(function (r) {
      setBusy(false);
      applied[r.docName] = [];
      save(APPLIED_KEY, applied);
      renderApplied();
      status("Cleared " + r.guides + (r.guides === 1 ? " guide" : " guides") + (r.layers ? " and " + r.layers + (r.layers === 1 ? " SwissGrid layer" : " SwissGrid layers") : "") + ".", "ok");
      refreshDoc();
    }).catch(function (e) { setBusy(false); status(e.message, "err"); });
  }

  function currentDocName() { return doc ? doc.name : null; }

  /* ---------- lists ---------- */

  function renderApplied() {
    var box = $("appliedList");
    box.innerHTML = "";
    var list = doc ? (applied[doc.name] || []) : [];
    if (!list.length) {
      box.appendChild(el("div", { cls: "empty", text: doc ? "No SwissGrid grids on this document yet." : "No document open." }));
      return;
    }
    list.forEach(function (a) {
      var kind = a.mode === "both" ? "guides + layer" : a.mode;
      box.appendChild(el("div", { cls: "item" + (a.hidden ? " hidden" : "") }, [
        el("span", { cls: "chip", style: "background:" + a.hex }),
        el("span", { cls: "name", text: a.name, title: a.name + " · " + a.hex + " · " + kind }),
        el("span", { cls: "meta", text: a.top !== undefined && a.top !== null ? "top " + r2(a.top) + (a.step ? " · line " + r2(a.step) : "") + " px" : String(a.lines),
          title: a.lines + " lines" + (a.step ? ". SwissType can snap to this grid: pick it under Align > Grid." : "") }),
        el("button", { cls: "icon", text: a.hidden ? "Show" : "Hide", title: "Show or hide this grid's layer", onclick: function () { toggleGrid(a); } }),
        el("button", { cls: "icon", text: "Remove", onclick: function () { removeGrid(a); } })
      ]));
    });
  }

  function getPresets() { return load(PRESET_KEY, []); }
  function setPresets(list) {
    list.sort(function (a, b) { return a.gridName.localeCompare(b.gridName); });
    save(PRESET_KEY, list);
    renderPresets();
  }

  function savePreset() {
    var f = readForm();
    if (!f.gridName) { status("Name the grid first, then save.", "err"); $("gridName").focus(); return; }
    try { G.hexToRgb(f.colorHex); } catch (e) { status(e.message, "err"); return; }
    var list = getPresets();
    var i = list.findIndex(function (p) { return p.gridName.toLowerCase() === f.gridName.toLowerCase(); });
    if (i >= 0) list[i] = f; else list.push(f);
    setPresets(list);
    status((i >= 0 ? "Updated preset “" : "Saved preset “") + f.gridName + "”.", "ok");
  }

  function renderPresets() {
    var box = $("presetList");
    box.innerHTML = "";
    var list = getPresets();
    if (!list.length) {
      box.appendChild(el("div", { cls: "empty", text: "No presets yet. Fill in the form, name it, Save preset." }));
      return;
    }
    list.forEach(function (p) {
      box.appendChild(el("div", { cls: "item" }, [
        el("span", { cls: "chip", style: "background:" + p.colorHex }),
        el("span", { cls: "name", text: p.gridName, title: p.gridName }),
        el("button", { cls: "icon", text: "Load", onclick: function () { writeForm(p); remember(); status("Loaded “" + p.gridName + "”.", "ok"); } }),
        el("button", { cls: "icon", text: "Apply", onclick: function () { writeForm(p); applyGrid(readForm()); } }),
        el("button", { cls: "icon", text: "✕", title: "Delete preset", onclick: function () {
          setPresets(getPresets().filter(function (q) { return q.gridName !== p.gridName; }));
          status("Deleted preset “" + p.gridName + "”.", "ok");
        } })
      ]));
    });
  }

  function exportPresets() {
    var json = JSON.stringify({ app: "SwissGrid", version: 1, presets: getPresets() }, null, 2);
    host("sg_exportPresets(" + JSON.stringify(json) + ")").then(function (r) {
      if (!r.cancelled) status("Exported presets to " + r.path, "ok");
    }).catch(function (e) { status("Export failed: " + e.message, "err"); });
  }

  function importPresets() {
    host("sg_importPresets()").then(function (r) {
      if (r.cancelled) return;
      var data = JSON.parse(r.text);
      var incoming = Array.isArray(data) ? data : data.presets;
      if (!Array.isArray(incoming)) throw new Error("No presets found in that file.");
      var list = getPresets(), n = 0;
      incoming.forEach(function (p) {
        if (!p || !p.gridName) return;
        var i = list.findIndex(function (q) { return q.gridName.toLowerCase() === p.gridName.toLowerCase(); });
        if (i >= 0) list[i] = p; else list.push(p);
        n++;
      });
      setPresets(list);
      status("Imported " + n + " presets.", "ok");
    }).catch(function (e) { status("Import failed: " + e.message, "err"); });
  }

  /* ---------- init ---------- */

  function init() {
    applyTheme();
    if (cep && cep.addEventListener) {
      try { cep.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyTheme); } catch (e) { /* optional */ }
    }

    QUICK.forEach(function (hex) {
      $("quickSwatches").appendChild(el("span", { style: "background:" + hex, title: hex, onclick: function () {
        $("colorHex").value = hex; syncColor(false); remember();
      } }));
    });

    // Seed starter presets. New starters are added once; ones you delete stay deleted.
    var seeded = load("swissgrid.seeded.v1", []);
    var current = load(PRESET_KEY, []);
    DEFAULT_PRESETS.forEach(function (d) {
      if (seeded.indexOf(d.gridName) >= 0) return;
      if (!current.some(function (p) { return p.gridName.toLowerCase() === d.gridName.toLowerCase(); })) current.push(d);
      seeded.push(d.gridName);
    });
    current.sort(function (a, b) { return a.gridName.localeCompare(b.gridName); });
    save(PRESET_KEY, current);
    save("swissgrid.seeded.v1", seeded);
    var last = load(LAST_KEY, null);
    if (last) writeForm(last);

    lastUnit = $("unit").value;
    $("unit").addEventListener("change", function () {
      var to = $("unit").value;
      if (lastUnit && lastUnit !== to) convertUnits(lastUnit, to);
      lastUnit = to;
    });

    TEXT.concat(Object.keys(SELECTS), CHECKS).forEach(function (id) {
      $(id).addEventListener("input", updatePreview);
      $(id).addEventListener("change", function () { updatePreview(); remember(); });
    });
    $("colorPicker").addEventListener("input", function () { syncColor(true); });
    $("colorPicker").addEventListener("change", function () { syncColor(true); remember(); });
    $("colorHex").addEventListener("input", function () { syncColor(false); });

    // Enter in any field applies the grid
    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") applyGrid(readForm());
    });

    $("btnApply").addEventListener("click", function () { applyGrid(readForm()); });
    $("btnBaseline").addEventListener("click", applyBaseline);
    $("btnSavePreset").addEventListener("click", savePreset);
    $("btnClearInputs").addEventListener("click", clearInputs);
    $("btnClearAll").addEventListener("click", clearAll);
    $("btnExport").addEventListener("click", exportPresets);
    $("btnImport").addEventListener("click", importPresets);

    renderPresets();
    refreshDoc().then(function () { renderApplied(); updatePreview(); });
    setInterval(refreshDoc, 1500); // keeps the document line and preview current as you switch documents
  }

  init();
})();
