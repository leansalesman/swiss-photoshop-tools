/*
 * Gumroad setup for SwissGrid.
 * Product IDs: on Gumroad, open the product > Content (or Product) settings > License key section,
 * turn on "Generate a unique license key per sale" and copy the product_id it shows.
 */
window.SWISS_LICENSE_CONFIG = {
  product: "SwissGrid",
  productId: "kqyu7hBACgRNcyNks3CzPA==",          // the SwissGrid product on Gumroad
  bundleProductId: "nfVe93Lt6itL4vL1wmalSQ==",   // the Swiss Bundle product (same in both panels)
  buyUrl: "https://jmartgraphics.gumroad.com/l/swissgrid",
  bundleUrl: "https://jmartgraphics.gumroad.com/l/swiss-bundle",
  supportEmail: "jmartgraphics via Gumroad",
  maxActivations: 3                              // computers per key (first activation on each computer counts once)
};
// Licensing switch. OFF = owner version: everything unlocked, no key, no expiry.
// Turn ON only when selling (the release builder does this for the Gumroad downloads).
var SWISS_LICENSING_ON = false;

if (SWISS_LICENSING_ON) {
  SwissLicense.start(window.SWISS_LICENSE_CONFIG);
} else {
  (function () {
    var v = "1.2.0";
    var n = document.createElement("div");
    n.textContent = "SwissGrid " + v + " \u00b7 owner version";
    n.style.cssText = "font-size:10px;color:#d4af37;margin-top:14px;opacity:0.8";
    (document.querySelector(".panel") || document.body).appendChild(n);
  })();
}
