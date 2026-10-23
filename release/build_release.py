"""
Builds the three Gumroad downloads with your real product IDs.

1. Fill in release_config.json (product IDs, links, support email).
2. Run:  python build_release.py
3. Upload dist/SwissGrid-<ver>.zip, dist/SwissType-<ver>.zip and
   dist/Swiss-Bundle-<ver>.zip to the matching Gumroad products.
"""
import json, os, re, shutil, stat, sys, zipfile

GOLD = "--gold" in sys.argv   # owner build: no license key, everything unlocked

HERE = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HERE, "release_config.json"), encoding="utf-8"))
for k in ("swissgrid_product_id", "swisstype_product_id", "bundle_product_id", "support_email"):
    if GOLD: break
    if not cfg.get(k) or cfg[k].startswith("PASTE"):
        raise SystemExit("Fill in '%s' in release_config.json first." % k)

VER = cfg.get("version", "1.1.0")
DIST = os.path.join(HERE, "dist")
STAGE = os.path.join(DIST, "_stage")
shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(STAGE)

PANELS = {
    "SwissGrid": ("swissgrid_product_id", "swissgrid_url"),
    "SwissType": ("swisstype_product_id", "swisstype_url"),
}

def stage_panel(name):
    src = os.path.join(HERE, "source", name) if os.path.isdir(os.path.join(HERE, "source")) else os.path.join(HERE, "..", name)
    dst = os.path.join(STAGE, name)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("*.zip", ".DS_Store"))
    conf = os.path.join(dst, name, "js", "license-config.js")
    t = open(conf, encoding="utf-8").read()
    pid_key, url_key = PANELS[name]
    t = re.sub(r'productId: "[^"]*"', 'productId: "%s"' % cfg[pid_key], t)
    t = re.sub(r'bundleProductId: "[^"]*"', 'bundleProductId: "%s"' % cfg["bundle_product_id"], t)
    t = re.sub(r'buyUrl: "[^"]*"', 'buyUrl: "%s"' % cfg.get(url_key, ""), t)
    t = re.sub(r'bundleUrl: "[^"]*"', 'bundleUrl: "%s"' % cfg.get("bundle_url", ""), t)
    t = re.sub(r'supportEmail: "[^"]*"', 'supportEmail: "%s"' % cfg["support_email"], t)
    t = re.sub(r'maxActivations: \d+', 'maxActivations: %d' % int(cfg.get("max_activations", 3)), t)
    if GOLD:
        t = t.replace("SwissLicense.start(window.SWISS_LICENSE_CONFIG);", """// GOLD OWNER BUILD: licensing is switched off. Everything is unlocked, no key, no expiry.
(function () {
  var n = document.createElement("div");
  n.textContent = "%s %s Gold \\u00b7 owner build";
  n.style.cssText = "font-size:10px;color:#d4af37;margin-top:14px;opacity:0.8";
  (document.querySelector(".panel") || document.body).appendChild(n);
})();""" % (name, VER))
        assert "GOLD OWNER BUILD" in t
    open(conf, "w", encoding="utf-8", newline="\n").write(t)
    return dst

def zip_dirs(zip_name, top, folders, flatten=False):
    path = os.path.join(DIST, zip_name)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for folder in folders:
            base = folder if flatten else os.path.dirname(folder)
            for root, _, files in os.walk(folder):
                for f in files:
                    full = os.path.join(root, f)
                    arc = os.path.join(top, os.path.relpath(full, base)).replace(os.sep, "/")
                    info = zipfile.ZipInfo(arc)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    mode = 0o755 if f.endswith(".command") else 0o644
                    info.external_attr = (stat.S_IFREG | mode) << 16
                    z.writestr(info, open(full, "rb").read())
        qs = os.path.join(HERE, "docs", "QUICK-START.txt")
        if not os.path.exists(qs): qs = os.path.join(HERE, "QUICK-START.txt")
        z.write(qs, top + "/QUICK-START.txt")
    print("Built", path)

grid = stage_panel("SwissGrid")
typ = stage_panel("SwissType")
if GOLD:
    zip_dirs("Swiss-Tools-GOLD-%s.zip" % VER, "Swiss Tools GOLD %s" % VER, [grid, typ])
else:
    zip_dirs("SwissGrid-%s.zip" % VER, "SwissGrid", [grid], flatten=True)
    zip_dirs("SwissType-%s.zip" % VER, "SwissType", [typ], flatten=True)
    zip_dirs("Swiss-Bundle-%s.zip" % VER, "Swiss Bundle", [grid, typ])
shutil.rmtree(STAGE)
