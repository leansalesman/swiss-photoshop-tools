/*
 * Gumroad setup for SwissGrid.
 * Product IDs: on Gumroad, open the product > Content (or Product) settings > License key section,
 * turn on "Generate a unique license key per sale" and copy the product_id it shows.
 */
window.SWISS_LICENSE_CONFIG = {
  product: "SwissGrid",
  productId: "PASTE_SWISSGRID_PRODUCT_ID",          // the SwissGrid product on Gumroad
  bundleProductId: "PASTE_BUNDLE_PRODUCT_ID",   // the Swiss Bundle product (same in both panels)
  buyUrl: "https://YOUR-NAME.gumroad.com/l/swissgrid",
  bundleUrl: "https://YOUR-NAME.gumroad.com/l/swiss-bundle",
  supportEmail: "your support email",
  maxActivations: 3                              // computers per key (first activation on each computer counts once)
};
SwissLicense.start(window.SWISS_LICENSE_CONFIG);
