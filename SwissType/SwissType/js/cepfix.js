/*
 * Scrolling that works in every CEP version.
 * CEP 11+ (Photoshop 2022 and later, especially on macOS) can deliver wheel events
 * without scrolling the page. The panel content lives in .panel, which is the scroll
 * container; if a wheel event doesn't move it natively, it is scrolled by hand.
 */
(function () {
  "use strict";
  function scroller() { return document.querySelector(".panel"); }
  function canScroll(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.classList && n.classList.contains("panel")) return null;
      var s = window.getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  }
  document.addEventListener("wheel", function (ev) {
    var p = scroller();
    if (!p || ev.ctrlKey) return;
    if (ev.target && ev.target.tagName === "SELECT") return;
    if (canScroll(ev.target)) return;          // an inner scrolling list handles itself
    var before = p.scrollTop;
    var dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * p.clientHeight : ev.deltaY;
    requestAnimationFrame(function () {
      if (p.scrollTop === before) p.scrollTop = before + dy;   // native scroll didn't happen
    });
  }, { passive: true });
  // Keyboard: Page Up/Down, Home/End when not typing in a field.
  document.addEventListener("keydown", function (ev) {
    var t = ev.target && ev.target.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
    var p = scroller(); if (!p) return;
    var h = p.clientHeight * 0.9;
    if (ev.key === "PageDown") p.scrollTop += h;
    else if (ev.key === "PageUp") p.scrollTop -= h;
    else if (ev.key === "Home") p.scrollTop = 0;
    else if (ev.key === "End") p.scrollTop = p.scrollHeight;
  });
})();
