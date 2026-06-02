/* ============================================================================
   ltys.js — the shared light. (classic script, defer)
   ONE candle you burn down with a stranger: read-state persists in localStorage
   and is shared by the home candle, the timeline nodes, and the constellation.
   Also: the "carry the candle over" page-transition bloom.
   ========================================================================== */
window.LTYS = (function () {
  "use strict";
  var KEY = "ltys_progress";
  var TOTAL = 36; // prologue + 32 letters + final + epilogue + acknowledgements

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { read: {} }; }
    catch (e) { return { read: {} }; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var state = load();
  if (!state.read) state.read = {};

  function isRead(slug) { return !!state.read[slug]; }
  function markRead(slug) {
    if (slug && !state.read[slug]) { state.read[slug] = Date.now(); save(state); }
  }
  function count() { return Object.keys(state.read).length; }
  function progress() { return Math.min(1, count() / TOTAL); }

  /* light up any element that carries data-slug for an already-read letter */
  function applyStates(root) {
    (root || document).querySelectorAll("[data-slug]").forEach(function (el) {
      if (isRead(el.getAttribute("data-slug"))) el.classList.add("read");
    });
  }

  return { isRead: isRead, markRead: markRead, count: count, progress: progress, total: TOTAL, applyStates: applyStates };
})();

/* page-transition bloom — the flame swells and carries you to the next page */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var bloom = document.querySelector(".bloom");
  if (!bloom) return;
  var navigating = false;
  document.addEventListener("click", function (e) {
    if (navigating) { e.preventDefault(); return; }   // debounce: one navigation at a time
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("data-no-bloom") || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    var url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return; // same-page anchor
    e.preventDefault();
    navigating = true;
    bloom.classList.add("on");
    setTimeout(function () { location.href = a.href; }, 380);
  });
  // clear bloom + re-arm when arriving via back/forward cache
  window.addEventListener("pageshow", function () { navigating = false; bloom.classList.remove("on"); });
})();

/* apply read-state once the DOM is ready */
document.addEventListener("DOMContentLoaded", function () {
  if (window.LTYS) window.LTYS.applyStates();
});
