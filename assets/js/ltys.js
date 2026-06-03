/* ============================================================================
   ltys.js — the shared light. (classic script, defer)
   ONE candle you burn down with a stranger: read-state persists in localStorage
   and is shared by the home candle, the timeline nodes, and the constellation.
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

/* apply read-state once the DOM is ready */
document.addEventListener("DOMContentLoaded", function () {
  if (window.LTYS) window.LTYS.applyStates();
});
