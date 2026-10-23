/*
 * Swiss tools licensing (shared by SwissGrid and SwissType).
 *
 * Each panel accepts a key for its own Gumroad product or for the Bundle product.
 * Keys are checked with Gumroad's public license API:
 *   POST https://api.gumroad.com/v2/licenses/verify  (product_id, license_key, increment_uses_count)
 * Activations are stored in one shared file per computer, so a Bundle key entered in one
 * panel unlocks the other without using another activation:
 *   Windows: %APPDATA%\SwissTools\licenses.json
 *   macOS:   ~/Library/Application Support/SwissTools/licenses.json
 *
 * Rules:
 *   - First activation on a computer counts one use; re-checks never do.
 *   - Re-checks every 30 days. Offline, the panel keeps working for 14 more days.
 *   - Refunded, charged-back or lost-dispute keys stop working at the next check.
 */
(function (root) {
  "use strict";

  var DAY = 24 * 60 * 60 * 1000;
  var RECHECK_DAYS = 30, GRACE_DAYS = 14;

  /* ---------- environment: Node (CEP with --enable-nodejs) or browser fallback ---------- */

  function nodeRequire() {
    try {
      if (typeof root.require === "function") return root.require;
      if (root.cep_node && typeof root.cep_node.require === "function") return root.cep_node.require;
    } catch (e) {}
    return null;
  }

  function storePath() {
    var req = nodeRequire();
    if (!req) return null;
    var path = req("path"), os = req("os");
    var proc = root.process || (root.cep_node && root.cep_node.process) || {};
    var env = proc.env || {};
    var base = env.APPDATA || path.join(os.homedir(), "Library", "Application Support");
    return { dir: path.join(base, "SwissTools"), file: path.join(base, "SwissTools", "licenses.json") };
  }

  function readStore() {
    var req = nodeRequire(), p = storePath();
    if (req && p) {
      try { return JSON.parse(req("fs").readFileSync(p.file, "utf8")) || {}; } catch (e) { return {}; }
    }
    try { return JSON.parse(root.localStorage.getItem("swisstools.licenses") || "{}"); } catch (e2) { return {}; }
  }

  function writeStore(data) {
    var req = nodeRequire(), p = storePath(), txt = JSON.stringify(data, null, 2);
    if (req && p) {
      var fs = req("fs");
      try { if (!fs.existsSync(p.dir)) fs.mkdirSync(p.dir, { recursive: true }); fs.writeFileSync(p.file, txt, "utf8"); return true; } catch (e) {}
    }
    try { root.localStorage.setItem("swisstools.licenses", txt); return true; } catch (e2) { return false; }
  }

  /* ---------- Gumroad ---------- */

  function form(obj) {
    return Object.keys(obj).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]); }).join("&");
  }

  // Resolves with Gumroad's JSON reply (success true or false). Rejects only on network failure.
  function gumroadVerify(productId, key, increment) {
    var body = form({ product_id: productId, license_key: key, increment_uses_count: increment ? "true" : "false" });
    var req = nodeRequire();
    if (req) {
      return new Promise(function (resolve, reject) {
        var https = req("https");
        var r = https.request({
          method: "POST", hostname: "api.gumroad.com", path: "/v2/licenses/verify",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": req("buffer").Buffer.byteLength(body) },
          timeout: 15000
        }, function (res) {
          var chunks = "";
          res.setEncoding("utf8");
          res.on("data", function (c) { chunks += c; });
          res.on("end", function () {
            try { resolve(JSON.parse(chunks)); } catch (e) { reject(new Error("Unexpected reply from Gumroad.")); }
          });
        });
        r.on("timeout", function () { r.destroy(new Error("Gumroad didn't answer in time.")); });
        r.on("error", function (e) { reject(e); });
        r.write(body);
        r.end();
      });
    }
    return fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body
    }).then(function (res) { return res.json(); });
  }

  // Is this purchase still good? Returns null if fine, or a reason.
  function purchaseProblem(reply) {
    if (!reply || !reply.success) return (reply && reply.message) || "That key isn't valid.";
    var p = reply.purchase || {};
    if (p.refunded) return "This purchase was refunded, so the key no longer works.";
    if (p.chargebacked) return "This purchase was charged back, so the key no longer works.";
    if (p.disputed && !p.dispute_won) return "This purchase is disputed, so the key is paused.";
    if (p.subscription_ended_at || p.subscription_cancelled_at || p.subscription_failed_at) return "This subscription has ended.";
    return null;
  }

  /* ---------- licensing logic ---------- */

  function Licensing(cfg) {
    this.cfg = cfg;
    this.ids = [cfg.productId, cfg.bundleProductId].filter(Boolean);
    this.maxActivations = cfg.maxActivations || 3;
  }

  // Saved activation that unlocks this panel (own product first, then bundle).
  Licensing.prototype.saved = function () {
    var store = readStore();
    for (var i = 0; i < this.ids.length; i++) {
      var e = store[this.ids[i]];
      if (e && e.key) { e.productId = this.ids[i]; return e; }
    }
    return null;
  };

  Licensing.prototype.save = function (productId, entry) {
    var store = readStore();
    store[productId] = entry;
    writeStore(store);
  };

  Licensing.prototype.forget = function (productId) {
    var store = readStore();
    delete store[productId];
    writeStore(store);
  };

  // Startup check. Resolves { ok, entry, note } or { ok:false, reason }.
  Licensing.prototype.check = function (now) {
    var self = this, e = this.saved();
    now = now || Date.now();
    if (!e) return Promise.resolve({ ok: false, reason: "" });
    if (now - (e.verifiedAt || 0) < RECHECK_DAYS * DAY) return Promise.resolve({ ok: true, entry: e });
    return gumroadVerify(e.productId, e.key, false).then(function (reply) {
      var problem = purchaseProblem(reply);
      if (problem) { self.forget(e.productId); return { ok: false, reason: problem }; }
      e.verifiedAt = now;
      self.save(e.productId, stripId(e));
      return { ok: true, entry: e };
    }, function () {
      var left = Math.ceil(((e.verifiedAt || 0) + (RECHECK_DAYS + GRACE_DAYS) * DAY - now) / DAY);
      if (left > 0) return { ok: true, entry: e, note: "Couldn't reach Gumroad to re-check your license. Works offline for " + left + " more day" + (left === 1 ? "" : "s") + "." };
      return { ok: false, reason: "Connect to the internet so your license can be re-checked." };
    });
  };

  // New activation from the lock screen.
  Licensing.prototype.activate = function (rawKey) {
    var self = this, key = String(rawKey || "").trim();
    if (!key) return Promise.reject(new Error("Paste the license key from your Gumroad receipt."));
    var ids = this.ids.slice();
    function tryNext(i, lastReply) {
      if (i >= ids.length) {
        var msg = purchaseProblem(lastReply);
        throw new Error(/does not exist/i.test(msg || "") ? "That key isn't for " + self.cfg.product + " or the Swiss Bundle. Check for typos or extra spaces." : msg);
      }
      return gumroadVerify(ids[i], key, true).then(function (reply) {
        if (!reply || !reply.success) return tryNext(i + 1, reply);
        var problem = purchaseProblem(reply);
        if (problem) throw new Error(problem);
        if (reply.uses > self.maxActivations) {
          throw new Error("This key is already active on " + self.maxActivations + " computers. Email " + (self.cfg.supportEmail || "support") + " to move it to this one.");
        }
        var p = reply.purchase || {};
        var entry = { key: key, email: p.email || "", product: ids[i] === self.cfg.bundleProductId ? "Swiss Bundle" : self.cfg.product,
                      activatedAt: Date.now(), verifiedAt: Date.now() };
        self.save(ids[i], entry);
        entry.productId = ids[i];
        return entry;
      }, function () { throw new Error("Couldn't reach Gumroad. Check your internet connection and try again."); });
    }
    return tryNext(0, null);
  };

  function stripId(e) {
    var o = {};
    Object.keys(e).forEach(function (k) { if (k !== "productId") o[k] = e[k]; });
    return o;
  }

  /* ---------- lock screen + footer ---------- */

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "cls") n.className = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function openUrl(url) {
    try { if (root.cep && root.cep.util && root.cep.util.openURLInDefaultBrowser) { root.cep.util.openURLInDefaultBrowser(url); return; } } catch (e) {}
    try { root.open(url, "_blank"); } catch (e2) {}
  }

  function mask(key) { return key.length > 8 ? key.slice(0, 4) + "…" + key.slice(-4) : key; }

  function showGate(lic, reason) {
    var cfg = lic.cfg, old = document.getElementById("licenseGate");
    if (old) old.parentNode.removeChild(old);
    var input = h("input", { type: "text", id: "licenseKey", placeholder: "XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX", spellcheck: "false", autocomplete: "off" });
    var msg = h("div", { cls: "lg-msg" + (reason ? " err" : ""), id: "licenseMsg", text: reason || "" });
    var btn = h("button", { cls: "primary", id: "licenseActivate", text: "Activate" });
    function go() {
      btn.disabled = true; btn.textContent = "Checking…"; msg.className = "lg-msg"; msg.textContent = "";
      lic.activate(input.value).then(function (entry) {
        hideGate();
        showFooter(lic, entry);
        if (cfg.onUnlock) cfg.onUnlock(entry);
      }, function (e) {
        btn.disabled = false; btn.textContent = "Activate";
        msg.className = "lg-msg err"; msg.textContent = e.message;
      });
    }
    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") go(); });
    var links = [];
    if (cfg.buyUrl) links.push(h("button", { cls: "lg-link", text: "Buy " + cfg.product, onclick: function () { openUrl(cfg.buyUrl); } }));
    if (cfg.bundleUrl) links.push(h("button", { cls: "lg-link", text: "Get the Swiss Bundle", onclick: function () { openUrl(cfg.bundleUrl); } }));
    var gate = h("div", { id: "licenseGate", cls: "license-gate" }, [
      h("div", { cls: "lg-card" }, [
        h("div", { cls: "lg-title", text: cfg.product }),
        h("div", { cls: "lg-sub", text: "Enter the license key from your Gumroad receipt. A " + cfg.product + " key or a Swiss Bundle key both work." }),
        input, btn, msg,
        h("div", { cls: "lg-links" }, links)
      ])
    ]);
    document.body.appendChild(gate);
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
  }

  function hideGate() {
    var g = document.getElementById("licenseGate");
    if (g) g.parentNode.removeChild(g);
  }

  function showFooter(lic, entry, note) {
    var old = document.getElementById("licenseFooter");
    if (old) old.parentNode.removeChild(old);
    var host = document.querySelector(".panel") || document.body;
    var foot = h("div", { id: "licenseFooter", cls: "license-footer" }, [
      h("span", { text: entry.product + " · " + (entry.email || mask(entry.key)) }),
      h("button", { cls: "lg-link", text: "Remove license", title: "Removes the key from this computer (for moving it to another one).",
        onclick: function () {
          lic.forget(entry.productId);
          foot.parentNode.removeChild(foot);
          showGate(lic, "License removed from this computer.");
        } })
    ]);
    if (note) foot.appendChild(h("div", { cls: "lg-note", text: note }));
    host.appendChild(foot);
  }

  /* ---------- public ---------- */

  root.SwissLicense = {
    _internals: { purchaseProblem: purchaseProblem, readStore: readStore, storePath: storePath, Licensing: Licensing },
    start: function (cfg) {
      var lic = new Licensing(cfg);
      if (lic.ids.some(function (id) { return /^PASTE_/.test(id); })) {
        showGate(lic, "Seller setup needed: add your Gumroad product IDs in js/license-config.js.");
        return Promise.resolve(lic);
      }
      // Block the panel until we know (fast when a recent activation exists).
      if (!lic.saved()) { showGate(lic, ""); return Promise.resolve(lic); }
      return lic.check().then(function (r) {
        if (r.ok) { hideGate(); showFooter(lic, r.entry, r.note); }
        else showGate(lic, r.reason);
        return lic;
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
