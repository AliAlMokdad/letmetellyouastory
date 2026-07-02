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

  /* the wax remembers your place: where you stopped in an unfinished letter */
  var PKEY = "ltys_place", lastP = 0;
  function loadPlaces() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
  function savePlace(p) {
    if (!slug) return;
    try {
      var m = loadPlaces();
      if (p === null) delete m[slug]; else m[slug] = Math.round(p * 100) / 100;
      localStorage.setItem(PKEY, JSON.stringify(m));
    } catch (e) {}
  }

  function markKept() {
    window.LTYS.markRead(slug); marked = true;
    savePlace(null);                       // the letter is kept; no place to hold any more
    root.classList.add("kept");            // the reading flame answers with one soft flare
  }

  function update() {
    ticking = false;
    var top = window.scrollY + article.getBoundingClientRect().top;
    var span = article.offsetHeight - window.innerHeight;
    var p = span > 0 ? (window.scrollY - top) / span : 1;   // wick shows full when the whole letter fits
    p = Math.min(1, Math.max(0, p));
    root.style.setProperty("--read", p.toFixed(3));
    lastP = p;
    // only mark read on a genuine scroll-to-end; short (non-scrollable) letters use the dwell timer below
    if (!marked && span > 0 && p > 0.9 && slug && window.LTYS) markKept();
  }
  function onScrollOrResize() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  update();

  // persist the place only when the reader leaves (never per-frame)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && !marked && lastP > 0.04 && lastP < 0.9) savePlace(lastP);
  });
  window.addEventListener("pagehide", function () {
    if (!marked && lastP > 0.04 && lastP < 0.9) savePlace(lastP);
  });

  // on return to an unfinished letter, offer the way back — one quiet chip, once
  if (slug && window.LTYS && !LTYS.isRead(slug)) {
    var held = loadPlaces()[slug];
    var spanNow = article.offsetHeight - window.innerHeight;
    if (held && held > 0.12 && held < 0.9 && spanNow > 400 && window.scrollY < 80) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "resume-chip";
      chip.innerHTML = 'The wax remembers your place <span aria-hidden="true">&darr;</span>';
      document.body.appendChild(chip);
      requestAnimationFrame(function () { chip.classList.add("in"); });
      var gone = false;
      var dismiss = function () {
        if (gone) return; gone = true;
        chip.classList.add("gone");
        setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 700);
      };
      chip.addEventListener("click", function () {
        var top = window.scrollY + article.getBoundingClientRect().top;
        var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: top + (article.offsetHeight - window.innerHeight) * held, behavior: reduced ? "auto" : "smooth" });
        dismiss();
      });
      setTimeout(dismiss, 12000);                                     // it never nags
      var startY = window.scrollY;
      window.addEventListener("scroll", function onFirstScroll() {
        if (Math.abs(window.scrollY - startY) > 320) { dismiss(); window.removeEventListener("scroll", onFirstScroll); }
      }, { passive: true });
    }
  }
  // a letter that fits entirely on screen can't be scrolled — mark it read after a short
  // dwell of genuine presence. The timer only runs while the tab is visible: a letter
  // opened in a background tab must not burn the candle for a reading that never happened.
  if (slug && window.LTYS && (article.offsetHeight - window.innerHeight) <= 0) {
    var dwell = null;
    var arm = function () {
      if (marked || dwell !== null || document.hidden) return;
      dwell = setTimeout(function () { dwell = null; if (!marked) markKept(); }, 7000);
    };
    var disarm = function () { if (dwell !== null) { clearTimeout(dwell); dwell = null; } };
    document.addEventListener("visibilitychange", function () { if (document.hidden) disarm(); else arm(); });
    arm();
  }
})();
