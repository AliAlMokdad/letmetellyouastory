/* ============================================================================
   timeline.js — the bead of light travels down the spine as you scroll.
   Read letters are lit by ltys.js (applyStates on [data-slug]).
   ========================================================================== */
(function () {
  "use strict";
  var spine = document.querySelector(".spine");
  var bead = document.querySelector(".spine-bead");
  if (!spine || !bead) return;
  var ticking = false;

  function update() {
    ticking = false;
    var rect = spine.getBoundingClientRect();
    if (rect.height <= 0) return;
    var p = (window.innerHeight * 0.5 - rect.top) / rect.height;
    p = Math.min(1, Math.max(0, p));
    bead.style.top = (p * 100).toFixed(2) + "%";
  }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  window.addEventListener("scroll", tick, { passive: true });
  window.addEventListener("resize", tick, { passive: true });
  update();
})();
