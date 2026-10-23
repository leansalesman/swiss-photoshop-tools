/*
 * Shared grid records between SwissGrid and SwissType, stored on this computer:
 *   Windows: %APPDATA%\SwissTools\grids.json     macOS: ~/Library/Application Support/SwissTools/grids.json
 * Keyed by document (name, pixel size, resolution). This works even when Photoshop
 * won't let a script write metadata into the document.
 */
(function (root) {
  "use strict";
  function nreq() {
    try {
      if (typeof root.require === "function") return root.require;
      if (root.cep_node && typeof root.cep_node.require === "function") return root.cep_node.require;
    } catch (e) {}
    return null;
  }
  function file() {
    var req = nreq(); if (!req) return null;
    var path = req("path"), os = req("os");
    var proc = root.process || (root.cep_node && root.cep_node.process) || {};
    var base = (proc.env && proc.env.APPDATA) || path.join(os.homedir(), "Library", "Application Support");
    return { dir: path.join(base, "SwissTools"), file: path.join(base, "SwissTools", "grids.json") };
  }
  function readAll() {
    var req = nreq(), f = file(); if (!req || !f) return {};
    try { return JSON.parse(req("fs").readFileSync(f.file, "utf8")) || {}; } catch (e) { return {}; }
  }
  function writeAll(data) {
    var req = nreq(), f = file(); if (!req || !f) return false;
    try {
      var fs = req("fs");
      if (!fs.existsSync(f.dir)) fs.mkdirSync(f.dir, { recursive: true });
      fs.writeFileSync(f.file, JSON.stringify(data), "utf8");
      return true;
    } catch (e) { return false; }
  }
  function key(doc) {
    if (!doc) return null;
    return [doc.name, Math.round(doc.width), Math.round(doc.height), Math.round(doc.ppi)].join("|");
  }
  root.SwissGridStore = {
    available: function () { return !!nreq(); },
    key: key,
    read: function (doc) { var k = key(doc); return k ? (readAll()[k] || []) : []; },
    add: function (doc, rec) {
      var k = key(doc); if (!k) return false;
      var all = readAll(); all[k] = (all[k] || []).filter(function (r) { return r.uid !== rec.uid; }).concat([rec]);
      return writeAll(all);
    },
    remove: function (doc, uid) {
      var k = key(doc); if (!k) return false;
      var all = readAll(); all[k] = (all[k] || []).filter(function (r) { return r.uid !== uid; });
      if (!all[k].length) delete all[k];
      return writeAll(all);
    },
    clear: function (doc) {
      var k = key(doc); if (!k) return false;
      var all = readAll(); delete all[k]; return writeAll(all);
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
