/* SwissType panel (UXP). */
(function () {
  "use strict";

  var G = window.GridMath, T = window.TypeMath, H = window.STHost;
  var K = { settings: "swisstype.settings.v1", styles: "swisstype.styles.v1", tab: "swisstype.tab.v1" };
  var SETTING_IDS = ["snapTarget", "gridPreset", "gridTop", "gridUnit", "snapDir", "baseSize", "leadUnit", "scaleType", "minRatio", "tightDisplay", "snapAfter", "colMode"];
  var PARTS = [["font", "Font"], ["size", "Size"], ["leading", "Leading"], ["tracking", "Tracking"], ["color", "Color"], ["case", "Case"], ["align", "Align"]];
  var DOC_GRID_PREFIX = "SwissGrid · ";

  var info = { doc: null, first: null, selected: 0 };
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  function status(msg, kind) { var s = $("status"); s.textContent = msg || ""; s.className = "status" + (kind ? " " + kind : ""); }

  // classList.toggle(name, force) isn't available in every UXP version.
  function setClass(n, cls, on) { if (on) n.classList.add(cls); else n.classList.remove(cls); }

  // css: { backgroundColor, fontSize, width, ... } set directly on element.style.
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "cls") n.className = props[k];
      else if (k === "css") Object.keys(props[k]).forEach(function (c) { n.style[c] = props[k][c]; });
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- host bridge ---------- */

  function host(name, payload) {
    if (!H) return Promise.reject(new Error("Not running inside Photoshop."));
    return H[name](payload).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || "Unknown error");
      return d;
    });
  }

  function run(label, name, payload, onDone) {
    if (busy) return;
    busy = true;
    status(label + "…");
    document.body.classList.add("busy");
    host(name, payload).then(function (r) {
      busy = false; document.body.classList.remove("busy");
      onDone(r);
      refresh();
    }).catch(function (e) {
      busy = false; document.body.classList.remove("busy");
      status(e.message, "err");
    });
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
    return host("info").then(function (d) {
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
      syncDocGrids(d.grids || [], prevDoc !== JSON.stringify(d.doc));
    }).catch(function (e) { $("docInfo").textContent = e.message; });
  }

  function r1(v) { return Math.round(v * 100) / 100; }

  /* ---------- grids saved by SwissGrid in this document ---------- */

  var docGrids = [], docGridSig = "";

  function selectedDocGrid() { return selectedDocGridFor($("gridPreset").value); }

  function gridLabel(g) {
    if (g.step) return DOC_GRID_PREFIX + g.name + " (top " + r1(g.top) + ", line " + r1(g.step) + " px)";
    return DOC_GRID_PREFIX + g.name + " (" + (g.lines ? g.lines.length : 0) + " lines, uneven)";
  }

  // A grid counts as a baseline grid when its lines are evenly spaced at 40 pt or less.
  function isBaseline(g) {
    return g.step && info.doc && g.step * 72 / info.doc.ppi <= 40 && g.lines && g.lines.length > 3;
  }

  // The document's SwissGrid grids are listed right after "Custom" in the Grid menu
  // (as plain options: UXP menus don't show <optgroup>).
  function syncDocGrids(grids, docChanged) {
    var sig = JSON.stringify(grids.map(function (g) { return [g.uid, g.top, g.step]; })) + (info.doc ? info.doc.name : "");
    if (sig === docGridSig) return;
    var wasNew = docGridSig !== "" || docChanged;
    docGridSig = sig;
    docGrids = grids.filter(function (g) { return g.lines && g.lines.length; });

    var sel = $("gridPreset"), current = sel.value;
    Array.prototype.slice.call(sel.querySelectorAll("option.doc-grid")).forEach(function (o) { sel.removeChild(o); });
    var after = sel.querySelector("option") ? sel.querySelector("option").nextSibling : null;
    docGrids.forEach(function (g) { sel.insertBefore(el("option", { cls: "doc-grid", value: "doc:" + g.uid, text: gridLabel(g) }), after); });

    var keep = current.indexOf("doc:") === 0 && selectedDocGridFor(current);
    if (keep) sel.value = current;
    else {
      var best = docGrids.filter(isBaseline).sort(function (a, b) { return a.step - b.step; })[0];
      if (best && (current === "" || current.indexOf("doc:") === 0 || wasNew)) {
        sel.value = "doc:" + best.uid;
        status("Using " + best.name + " from SwissGrid for baseline snapping.", "ok");
      } else if (current.indexOf("doc:") === 0) sel.value = "";
      else sel.value = current;
    }
    applyGridChoice();
  }

  function selectedDocGridFor(v) {
    if (!v || v.indexOf("doc:") !== 0) return null;
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
    ["gridTop", "gridUnit"].forEach(function (id) { $(id).readOnly = lock; setClass($(id), "locked", lock); });
    $("gridHint").textContent = g ? "Snaps to the " + g.lines.length + " lines of “" + g.name + "” exactly as SwissGrid drew them." : "";
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

  function snapBaseline() {
    var o;
    try { o = snapOptions(); } catch (e) { status(e.message, "err"); return; }
    run("Snapping", "snapBaseline", o, function (r) {
      if (!r.moved) { status(r.skipped ? "Select text layers (other layer types are skipped)." : "Nothing to snap.", "err"); return; }
      status("Snapped " + r.moved + (r.moved === 1 ? " layer" : " layers") + ": " + r.details.join(", ") + (r.skipped ? " (" + r.skipped + " non-text skipped)" : ""), "ok");
    });
  }

  function opticalAlign(edge) {
    run("Aligning", "opticalAlign", { edge: edge }, function (r) {
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
        el("span", { cls: "aa", text: "Aa", css: { fontSize: preview + "px" } }),
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
    run("Setting " + row.size + "/" + row.leading, "applySize", payload, function (r) {
      if (!r.done) { status("Select text layers first.", "err"); return; }
      status("Set " + r.done + (r.done === 1 ? " layer" : " layers") + " to " + row.size + "/" + row.leading + " pt" + (snap ? " and snapped to the baseline." : "."), "ok");
    });
  }

  /* ---------- measure ---------- */

  function kv(k, v) { return el("div", { cls: "kv" }, [el("span", { text: k }), el("span", { text: v })]); }

  function measure() {
    run("Measuring", "measure", null, function (m) {
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
          rag.appendChild(el("div", { cls: "bar " + l.cls, title: l.n + " characters", css: { width: Math.max(2, l.n / max * 100) + "%" } }));
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
    run("Reading style", "readStyle", null, function (r) {
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
    run("Applying " + entry.name, "applyStyle", { style: entry.style, parts: parts() }, function (r) {
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
        el("span", { cls: "chip", css: { backgroundColor: s.style.color || "#000000" } }),
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
    run("Exporting", "exportFile", json, function (r) {
      if (!r.cancelled) status("Exported styles to " + r.path, "ok"); else status("");
    });
  }

  function importStyles() {
    run("Importing", "importFile", null, function (r) {
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
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { setClass(t, "active", t.getAttribute("data-tab") === name); });
    Array.prototype.forEach.call(document.querySelectorAll(".pane"), function (p) { setClass(p, "hidden", p.id !== "pane-" + name); });
    save(K.tab, name);
  }

  function syncGridFields() {
    $("gridFields").style.display = $("snapTarget").value === "grid" ? "block" : "none";
  }

  /* ---------- init ---------- */

  function init() {
    var saved = load(K.settings, null);
    if (saved) writeSettings(saved);

    PARTS.forEach(function (p) {
      var box = el("input", { type: "checkbox", id: "part-" + p[0] });
      box.checked = true;
      $("partToggles").appendChild(el("label", {}, [box, document.createTextNode(p[1])]));
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
