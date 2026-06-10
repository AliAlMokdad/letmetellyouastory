/* ============================================================================
   reader.js — the wick burns down as you read (classic script, defer)
   Drives --read (0..1) from scroll position through the letter, cheaply
   (rAF-throttled, compositor-only via a CSS custom property). Marks the letter
   read in the shared store when you reach the sign-off, and breathes the page
   dimmer for a beat at the end.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var article = document.querySelector(".letter");
  if (!article) return;
  var slug = document.body.getAttribute("data-slug");
  var ticking = false, marked = false;

  function update() {
    ticking = false;
    var top = window.scrollY + article.getBoundingClientRect().top;
    var span = article.offsetHeight - window.innerHeight;
    var p = span > 0 ? (window.scrollY - top) / span : 1;   // wick shows full when the whole letter fits
    p = Math.min(1, Math.max(0, p));
    root.style.setProperty("--read", p.toFixed(3));
    // only mark read on a genuine scroll-to-end; short (non-scrollable) letters use the dwell timer below
    if (!marked && span > 0 && p > 0.9 && slug && window.LTYS) { window.LTYS.markRead(slug); marked = true; }
  }
  function onScrollOrResize() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  update();
  // a letter that fits entirely on screen can't be scrolled — mark it read after a short
  // dwell of genuine presence. The timer only runs while the tab is visible: a letter
  // opened in a background tab must not burn the candle for a reading that never happened.
  if (slug && window.LTYS && (article.offsetHeight - window.innerHeight) <= 0) {
    var dwell = null;
    var arm = function () {
      if (marked || dwell !== null || document.hidden) return;
      dwell = setTimeout(function () { dwell = null; if (!marked) { window.LTYS.markRead(slug); marked = true; } }, 7000);
    };
    var disarm = function () { if (dwell !== null) { clearTimeout(dwell); dwell = null; } };
    document.addEventListener("visibilitychange", function () { if (document.hidden) disarm(); else arm(); });
    arm();
  }
})();
