/* SwissType panel (CEP). */
(function () {
  "use strict";

  var G = window.GridMath, T = window.TypeMath, cep = window.__adobe_cep__;
  var K = { settings: "swisstype.settings.v1", styles: "swisstype.styles.v1", tab: "swisstype.tab.v1" };
  var SETTING_IDS = ["snapTarget", "gridPreset", "gridTop", "gridUnit", "snapDir", "baseSize", "leadUnit", "scaleType", "minRatio", "tightDisplay", "snapAfter", "colMode"];
  var PARTS = [["font", "Font"], ["size", "Size"], ["leading", "Leading"], ["tracking", "Tracking"], ["color", "Color"], ["case", "Case"], ["align", "Align"]];

  var info = { doc: null, first: null, selected: 0 };
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  function status(msg, kind) { var s = $("status"); s.textContent = msg || ""; s.className = "status" + (kind ? " " + kind : ""); }

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "cls") n.className = props[k];
      else if (k === "style") n.setAttribute("style", props[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- host bridge ---------- */

  function host(call) {
    return new Promise(function (resolve, reject) {
      if (!cep || !cep.evalScript) { reject(new Error("Not running inside Photoshop.")); return; }
      cep.evalScript(call, function (res) {
        if (res === "EvalScript error.") { reject(new Error("Photoshop script error.")); return; }
        var d;
        try { d = JSON.parse(res); } catch (e) { reject(new Error("Unexpected reply from Photoshop: " + res)); return; }
        if (!d.ok) { reject(new Error(d.error || "Unknown error")); return; }
        resolve(d);
      });
    });
  }
  function arg(o) { return JSON.stringify(JSON.stringify(o)); }

  function run(label, call, onDone) {
    if (busy) return;
    busy = true;
    status(label + "…");
    document.body.classList.add("busy");
    host(call).then(function (r) {
      busy = false; document.body.classList.remove("busy");
      onDone(r);
      refresh();
    }).catch(function (e) {
      busy = false; document.body.classList.remove("busy");
      status(e.message, "err");
    });
  }

  /* ---------- theme ---------- */

  function applyTheme() {
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      var root = document.documentElement.style;
      root.setProperty("--bg", G.rgbToHex(c.red, c.green, c.blue));
      var lum = (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255;
      document.body.classList.toggle("light", lum > 0.55);
      if (lum <= 0.55) {
        var sh = function (d) { return G.rgbToHex(c.red + d, c.green + d, c.blue + d); };
        root.setProperty("--field", sh(-14)); root.setProperty("--btn", sh(20));
        root.setProperty("--btn-hover", sh(32)); root.setProperty("--line", sh(24));
      }
    } catch (e) { /* defaults */ }
  }

  /* ---------- settings ---------- */

  function readSettings() {
    var s = {};
    SETTING_IDS.forEach(function (id) { var e = $(id); s[id] = e.type === "checkbox" ? e.checked : e.value; });
    return s;
  }
  function writeSettings(s) {
    SETTING_IDS.forEach(function (id) {
      if (s[id] === undefined) return;
      var e = $(id); if (e.type === "checkbox") e.checked = !!s[id]; else e.value = s[id];
    });
  }
  function remember() { save(K.settings, readSettings()); }

  /* ---------- status line ---------- */

  function refresh() {
    if (busy) return Promise.resolve();
    return host("st_info()").then(function (d) {
      var prevDoc = JSON.stringify(info.doc);
      info = d;
      if (!d.doc) { $("docInfo").textContent = "No document open"; $("selInfo").textContent = ""; return; }
      $("docInfo").textContent = d.doc.name + " · " + d.doc.width + " × " + d.doc.height + " px · " + d.doc.ppi + " ppi · " +
        d.hGuides + " horizontal / " + d.vGuides + " vertical guides";
      var f = d.first;
      $("selInfo").textContent = f
        ? (d.selected > 1 ? d.selected + " layers · " : "") + f.name + " · " + f.font + " " + r1(f.size) + "/" + (f.leading ? r1(f.leading) : "auto") + " pt" + (f.tracking ? " · " + f.tracking : "")
        : (d.activeName ? d.activeName + " (not a text layer)" : "Select a text layer");
      if (prevDoc !== JSON.stringify(d.doc)) renderScale();
      syncDocGrids(withDerived(mergeGrids(d.grids || [], d.doc)), prevDoc !== JSON.stringify(d.doc));
    }).catch(function (e) { $("docInfo").textContent = e.message; });
  }

  function r1(v) { return Math.round(v * 100) / 100; }

  /* ---------- grids saved by SwissGrid in this document ---------- */

  var docGrids = [], docGridSig = "";

  // Grids from the document (XMP) plus the shared file SwissGrid writes on this computer.
  function mergeGrids(fromDoc, d) {
    var out = [], seen = {};
    var fromFile = [];
    try { if (window.SwissGridStore) fromFile = SwissGridStore.read(d); } catch (e) {}
    fromDoc.concat(fromFile).forEach(function (g) { if (g && g.uid && !seen[g.uid]) { seen[g.uid] = 1; out.push(g); } });
    return out;
  }

  // For field grids, add the baseline SwissGrid recommends (its "Type sizes" unit), calculated here.
  function withDerived(grids) {
    var out = grids.slice();
    grids.forEach(function (g) {
      if (!(g.unitPx > 0) || g.baseTop === undefined || g.baseBottom === undefined) return;
      if (grids.some(function (o) { return o.step && Math.abs(o.step - g.unitPx) < 0.05 && Math.abs(o.top - g.baseTop) < 0.05; })) return; // already applied
      var exact = (g.baseBottom - g.baseTop) / g.unitPx;
      var n = Math.abs(exact - Math.round(exact)) < 0.02 ? Math.round(exact) : Math.floor(exact);
      if (n < 2) return;
      var lines = [];
      for (var i = 0; i <= n; i++) lines.push(Math.round((g.baseTop + i * g.unitPx) * 10000) / 10000);
      out.push({ uid: g.uid + ":base", name: g.name + " · baseline " + (g.unitPt || r1(g.unitPx)) + (g.unitPt ? " pt" : " px") + " (calculated)",
                 top: g.baseTop, step: Math.round(g.unitPx * 100) / 100, lines: lines, derived: true });
    });
    return out;
  }

  function selectedDocGrid() {
    var v = $("gridPreset").value;
    if (v.indexOf("doc:") !== 0) return null;
    for (var i = 0; i < docGrids.length; i++) if (docGrids[i].uid === v.slice(4)) return docGrids[i];
    return null;
  }

  function gridLabel(g) {
    if (g.derived) return g.name;
    if (g.step) return g.name + " (top " + r1(g.top) + ", line " + r1(g.step) + " px)";
    return g.name + " (" + (g.lines ? g.lines.length : 0) + " lines, uneven)";
  }

  // A grid counts as a baseline grid when its lines are evenly spaced at 40 pt or less.
  function isBaseline(g) {
    return g.step && info.doc && g.step * 72 / info.doc.ppi <= 40 && g.lines && g.lines.length > 3;
  }

  function syncDocGrids(grids, docChanged) {
    var sig = JSON.stringify(grids.map(function (g) { return [g.uid, g.top, g.step]; })) + (info.doc ? info.doc.name : "");
    if (sig === docGridSig) return;
    var wasNew = docGridSig !== "" || docChanged;
    docGridSig = sig;
    docGrids = grids.filter(function (g) { return g.lines && g.lines.length; });

    var sel = $("gridPreset"), current = sel.value;
    var old = $("docGridGroup"); if (old) old.parentNode.removeChild(old);
    if (docGrids.length) {
      var group = el("optgroup", { id: "docGridGroup", label: "From SwissGrid (this document)" });
      docGrids.forEach(function (g) { group.appendChild(el("option", { value: "doc:" + g.uid, text: gridLabel(g) })); });
      sel.insertBefore(group, sel.options[1] || null);
    }
    var keep = current.indexOf("doc:") === 0 && selectedDocGridFor(current);
    if (keep) sel.value = current;
    else {
      var best = docGrids.filter(isBaseline).sort(function (a, b) { return (a.derived ? 1 : 0) - (b.derived ? 1 : 0) || a.step - b.step; })[0];
      if (best && (current === "" || current.indexOf("doc:") === 0 || wasNew)) {
        sel.value = "doc:" + best.uid;
        status("Using " + best.name + " from SwissGrid for baseline snapping.", "ok");
      } else if (current.indexOf("doc:") === 0) sel.value = "";
    }
    applyGridChoice();
  }

  function selectedDocGridFor(v) {
    for (var i = 0; i < docGrids.length; i++) if ("doc:" + docGrids[i].uid === v) return docGrids[i];
    return null;
  }

  // Fill Top and Unit from the chosen grid; lock them while a SwissGrid grid is chosen.
  function applyGridChoice() {
    var g = selectedDocGrid(), lock = !!g;
    if (g) {
      $("gridTop").value = r1(g.top) + "px";
      $("gridUnit").value = g.step ? r1(g.step) + "px" : "uneven";
    }
    ["gridTop", "gridUnit"].forEach(function (id) { $(id).readOnly = lock; $(id).classList.toggle("locked", lock); });
    $("gridHint").textContent = !g ? "" : g.derived
      ? "Snaps to " + g.lines.length + " baseline lines SwissType calculated from your SwissGrid grid (the body leading in SwissGrid's Type sizes tab). Tip: SwissGrid's + Baseline button draws them."
      : "Snaps to the " + g.lines.length + " lines of “" + g.name + "” exactly as SwissGrid drew them.";
  }

  /* ---------- align ---------- */

  function snapOptions() {
    var s = readSettings();
    if (s.snapTarget !== "grid") return { target: "guides", direction: s.snapDir };
    if (!info.doc) throw new Error("Open a document first.");
    var dg = selectedDocGrid();
    if (dg) return { target: "grid", lines: dg.lines, direction: s.snapDir, gridName: dg.name };
    var cx = { ppi: info.doc.ppi, size: info.doc.height, defaultUnit: "px" };
    var top = G.toPx(s.gridTop, cx), unit = G.toPx(s.gridUnit, cx);
    if (top === null || !(unit > 0)) throw new Error("Enter the baseline grid's top and unit, for example 15.24mm and 5.08mm.");
    return { target: "grid", top: top, unit: unit, direction: s.snapDir };
  }

  function copyDiagnostics() {
    var o = null; try { o = snapOptions(); } catch (e) { o = { error: e.message }; }
    run("Measuring", "st_diag()", function (r) {
      var cepVer = ""; try { cepVer = window.__adobe_cep__.getCurrentApiVersion(); } catch (e) {}
      var lines = o && o.lines ? o.lines : null;
      var report = {
        swisstype: "1.2.0", cep: cepVer, ua: navigator.userAgent,
        photoshop: r.ps, os: r.os, ppi: r.res, rulerUnits: r.rulerUnits, typeUnits: r.typeUnits, docPx: r.docPx, hGuides: r.hGuides,
        snap: o && !o.error ? { target: o.target, grid: o.gridName || null, top: o.top, unit: o.unit, direction: o.direction,
                     lines: lines ? lines.slice(0, 6).concat(["... " + lines.length + " total"]) : null } : o,
        layers: (r.layers || []).map(function (L) {
          var near = null;
          if (typeof L.baselinePx === "number") {
            var arr = lines || (o && o.unit ? null : null);
            if (arr) { near = arr.reduce(function (a, b) { return Math.abs(b - L.baselinePx) < Math.abs(a - L.baselinePx) ? b : a; }, arr[0]); }
          }
          L.nearestLine = near; return L;
        })
      };
      var txt = JSON.stringify(report, null, 2);
      try {
        var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        status("Diagnostics copied (" + report.layers.length + " text layer" + (report.layers.length === 1 ? "" : "s") + "). Paste them to Claude.", "ok");
      } catch (e) { status(txt, "ok"); }
    });
  }

  function snapBaseline() {
    var o;
    try { o = snapOptions(); } catch (e) { status(e.message, "err"); return; }
    run("Snapping", "st_snapBaseline(" + arg(o) + ")", function (r) {
      if (!r.moved) { status(r.skipped ? "Select text layers (other layer types are skipped)." : "Nothing to snap.", "err"); return; }
      status("Snapped " + r.moved + (r.moved === 1 ? " layer" : " layers") + ": " + r.details.join(", ") + (r.skipped ? " (" + r.skipped + " non-text skipped)" : ""), "ok");
    });
  }

  function opticalAlign(edge) {
    run("Aligning", "st_opticalAlign(" + arg({ edge: edge }) + ")", function (r) {
      if (!r.moved) { status("Select text layers first.", "err"); return; }
      status("Aligned " + edge + " edge: " + r.details.join(", "), "ok");
    });
  }

  /* ---------- scale ---------- */

  function scaleOptions() {
    var s = readSettings();
    var base = parseFloat(s.baseSize);
    var unit = T.toPt(s.leadUnit);
    if (!(base > 0)) throw new Error("Enter a body size in pt.");
    if (!(unit > 0)) throw new Error("Enter the baseline unit (body leading).");
    return { type: s.scaleType, base: base, unit: unit, minRatio: parseFloat(s.minRatio), tight: s.tightDisplay };
  }

  function renderScale() {
    var box = $("scaleList");
    box.innerHTML = "";
    var o;
    try { o = scaleOptions(); } catch (e) { box.appendChild(el("div", { cls: "empty", text: e.message })); return; }
    T.buildScale(o).forEach(function (row) {
      var preview = Math.min(row.size, 30);
      box.appendChild(el("div", { cls: "item" + (row.isBase ? " base" : "") }, [
        el("span", { cls: "aa", text: "Aa", style: "font-size:" + preview + "px" }),
        el("span", { cls: "size", text: String(row.size) }),
        el("span", { cls: "lead", text: "/ " + row.leading + " pt · " + row.units + (row.units === 1 ? " unit" : " units") }),
        el("button", { cls: "icon", text: "Apply", onclick: function () { applySize(row); } })
      ]));
    });
  }

  function applySize(row) {
    var s = readSettings(), snap = null;
    if (s.snapAfter) { try { snap = snapOptions(); } catch (e) { status(e.message, "err"); return; } }
    var payload = { size: row.size, leading: row.leading, tracking: null, snap: snap };
    run("Setting " + row.size + "/" + row.leading, "st_applySize(" + arg(payload) + ")", function (r) {
      if (!r.done) { status("Select text layers first.", "err"); return; }
      status("Set " + r.done + (r.done === 1 ? " layer" : " layers") + " to " + row.size + "/" + row.leading + " pt" + (snap ? " and snapped to the baseline." : "."), "ok");
    });
  }

  /* ---------- measure ---------- */

  function kv(k, v) { return el("div", { cls: "kv" }, [el("span", { text: k }), el("span", { text: v })]); }

  function measure() {
    run("Measuring", "st_measure()", function (m) {
      var out = $("measureOut");
      out.innerHTML = "";
      var a;
      try { a = T.analyzeMeasure(m, $("colMode").value); } catch (e) { status(e.message, "err"); return; }
      out.appendChild(el("div", { cls: "big", text: a.cpl + " characters" }));
      out.appendChild(el("div", { cls: "verdict " + a.cls, text: a.verdict + " (target " + a.range + ")" }));
      out.appendChild(kv("Words per line", "≈ " + a.words));
      out.appendChild(kv("Measure", a.measurePt + " pt · " + a.measureMm + " mm"));
      out.appendChild(kv("Measure ÷ type size", a.ratio + " × (book norm 20–40, about 30)"));
      out.appendChild(kv("Type", m.font + " · " + r1(m.size) + " pt · " + m.kind + " text"));
      if (a.idealMeasurePt) {
        out.appendChild(kv("For " + a.ideal + " characters", "measure " + a.idealMeasureMm + " mm, or size ≈ " + a.idealSize + " pt"));
      }
      if (a.lines) {
        var max = Math.max.apply(null, a.lines.map(function (l) { return l.n; })) || 1;
        var rag = el("div", { cls: "rag" }, [el("div", { cls: "section-title", text: "Rag (characters per line)" })]);
        a.lines.forEach(function (l) {
          rag.appendChild(el("div", { cls: "bar " + l.cls, title: l.n + " characters", style: "width:" + Math.max(2, l.n / max * 100) + "%" }));
        });
        out.appendChild(rag);
      } else {
        out.appendChild(el("div", { cls: "hint", text: "Paragraph text: characters per line estimated with Bringhurst's alphabet-length method. Point text with line breaks also shows a rag chart." }));
      }
      status("Measured " + m.name + ".", "ok");
    });
  }

  /* ---------- styles ---------- */

  function getStyles() { return load(K.styles, []); }
  function setStyles(list) { list.sort(function (a, b) { return a.name.localeCompare(b.name); }); save(K.styles, list); renderStyles(); }

  function parts() {
    var p = {};
    PARTS.forEach(function (x) { p[x[0]] = $("part-" + x[0]).checked; });
    return p;
  }

  function styleInfo(s) {
    return (s.font || "?") + " · " + r1(s.size) + "/" + (s.autoLeading ? "auto" : r1(s.leading)) + (s.tracking ? " · " + s.tracking : "");
  }

  function saveStyle(overwriteName) {
    var name = overwriteName || $("styleName").value.trim();
    if (!name) { status("Name the style first.", "err"); $("styleName").focus(); return; }
    run("Reading style", "st_readStyle()", function (r) {
      var list = getStyles();
      var i = list.findIndex(function (s) { return s.name.toLowerCase() === name.toLowerCase(); });
      var entry = { name: name, style: r.style };
      if (i >= 0) list[i] = entry; else list.push(entry);
      setStyles(list);
      $("styleName").value = "";
      status((i >= 0 ? "Updated" : "Saved") + " style “" + name + "” from " + r.layer + ".", "ok");
    });
  }

  function applyStyle(entry) {
    run("Applying " + entry.name, "st_applyStyle(" + arg({ style: entry.style, parts: parts() }) + ")", function (r) {
      if (!r.done) { status("Select text layers first.", "err"); return; }
      status("Applied “" + entry.name + "” to " + r.done + (r.done === 1 ? " layer." : " layers."), "ok");
    });
  }

  function renderStyles() {
    var box = $("styleList");
    box.innerHTML = "";
    var list = getStyles();
    if (!list.length) {
      box.appendChild(el("div", { cls: "empty", text: "No styles yet. Select a styled text layer, name it, then Save from selected." }));
      return;
    }
    list.forEach(function (s) {
      box.appendChild(el("div", { cls: "item" }, [
        el("span", { cls: "chip", style: "background:" + (s.style.color || "#000") }),
        el("span", { cls: "stack" }, [el("span", { cls: "name", text: s.name }), el("span", { cls: "info", text: styleInfo(s.style) })]),
        el("button", { cls: "icon", text: "Apply", onclick: function () { applyStyle(s); } }),
        el("button", { cls: "icon", text: "Update", title: "Replace with the selected layer's style", onclick: function () { saveStyle(s.name); } }),
        el("button", { cls: "icon", text: "✕", title: "Delete style", onclick: function () {
          setStyles(getStyles().filter(function (q) { return q.name !== s.name; }));
          status("Deleted style “" + s.name + "”.", "ok");
        } })
      ]));
    });
  }

  function exportStyles() {
    var json = JSON.stringify({ app: "SwissType", version: 1, styles: getStyles() }, null, 2);
    run("Exporting", "st_exportFile(" + JSON.stringify(json) + ")", function (r) {
      if (!r.cancelled) status("Exported styles to " + r.path, "ok"); else status("");
    });
  }

  function importStyles() {
    run("Importing", "st_importFile()", function (r) {
      if (r.cancelled) { status(""); return; }
      try {
        var d = JSON.parse(r.text), incoming = Array.isArray(d) ? d : d.styles, list = getStyles(), n = 0;
        if (!Array.isArray(incoming)) throw new Error("No styles found in that file.");
        incoming.forEach(function (s) {
          if (!s || !s.name || !s.style) return;
          var i = list.findIndex(function (q) { return q.name.toLowerCase() === s.name.toLowerCase(); });
          if (i >= 0) list[i] = s; else list.push(s);
          n++;
        });
        setStyles(list);
        status("Imported " + n + " styles.", "ok");
      } catch (e) { status("Import failed: " + e.message, "err"); }
    });
  }

  /* ---------- tabs ---------- */

  function showTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    Array.prototype.forEach.call(document.querySelectorAll(".pane"), function (p) { p.classList.toggle("hidden", p.id !== "pane-" + name); });
    save(K.tab, name);
  }

  function syncGridFields() {
    $("gridFields").style.display = $("snapTarget").value === "grid" ? "" : "none";
  }

  /* ---------- init ---------- */

  function init() {
    applyTheme();
    if (cep && cep.addEventListener) { try { cep.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyTheme); } catch (e) { /* optional */ } }

    var saved = load(K.settings, null);
    if (saved) writeSettings(saved);

    PARTS.forEach(function (p) {
      $("partToggles").appendChild(el("label", {}, [el("input", { type: "checkbox", id: "part-" + p[0], checked: "checked" }), document.createTextNode(p[1])]));
    });

    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.addEventListener("click", function () { showTab(t.getAttribute("data-tab")); });
    });
    showTab(load(K.tab, "align"));

    SETTING_IDS.forEach(function (id) {
      $(id).addEventListener("change", function () { remember(); renderScale(); syncGridFields(); });
      $(id).addEventListener("input", function () { renderScale(); });
    });
    $("gridPreset").addEventListener("change", function () {
      var v = $("gridPreset").value;
      if (v && v.indexOf("doc:") !== 0) { var p = v.split("|"); $("gridTop").value = p[0]; $("gridUnit").value = p[1]; }
      applyGridChoice(); remember();
    });
    ["gridTop", "gridUnit"].forEach(function (id) { $(id).addEventListener("input", function () { $("gridPreset").value = ""; }); });

    $("btnSnap").addEventListener("click", snapBaseline);
    $("btnDiag").addEventListener("click", copyDiagnostics);
    $("edgeLeft").addEventListener("click", function () { opticalAlign("left"); });
    $("edgeRight").addEventListener("click", function () { opticalAlign("right"); });
    $("edgeTop").addEventListener("click", function () { opticalAlign("top"); });
    $("edgeBottom").addEventListener("click", function () { opticalAlign("bottom"); });
    $("btnMeasure").addEventListener("click", measure);
    $("btnSaveStyle").addEventListener("click", function () { saveStyle(null); });
    $("btnExportStyles").addEventListener("click", exportStyles);
    $("btnImportStyles").addEventListener("click", importStyles);

    syncGridFields();
    renderScale();
    renderStyles();
    refresh();
    setInterval(refresh, 2000);
  }

  init();
})();
