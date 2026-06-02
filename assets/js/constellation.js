/* ============================================================================
   constellation.js — the Index as an actual night sky (Canvas2D + DOM stars).
   The 36 letters become scattered points of light, joined by the faint path
   the light travels through them in order. Labels appear on hover/focus.
   Read letters are lit gold (ltys.js applyStates). On phones / reduced-motion
   it falls back to the accessible, crawlable list of links (no positioning).
   ========================================================================== */
(function () {
  "use strict";
  var wrap = document.querySelector(".sky-wrap");
  var canvas = document.querySelector(".sky-canvas");
  var list = document.querySelector(".sky-list");
  if (!wrap || !canvas || !list) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 721px)");
  var stars = [].slice.call(list.querySelectorAll(".star"));
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, pos = [], amb = [], rafId = null, t0 = null, onScreen = true;

  function place() {
    if (!desktop.matches) { wrap.classList.remove("sky-active"); pos = []; return; }
    wrap.classList.add("sky-active");
    var w = wrap.clientWidth, h = wrap.clientHeight, n = stars.length;
    var cols = Math.max(4, Math.round(Math.sqrt(n * (w / h))));
    var rows = Math.ceil(n / cols);
    pos = [];
    stars.forEach(function (s, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var jx = (((i * 73) % 100) / 100 - 0.5) * 0.72;   // deterministic jitter -> scattered, not a grid
      var jy = (((i * 137) % 100) / 100 - 0.5) * 0.72;
      var x = Math.max(0.045, Math.min(0.955, (col + 0.5 + jx) / cols));
      var y = Math.max(0.05, Math.min(0.95, (row + 0.5 + jy) / rows));
      s.style.left = (x * 100).toFixed(2) + "%";
      s.style.top = (y * 100).toFixed(2) + "%";
      pos.push({ x: x * w, y: y * h });
    });
  }
  function seedAmbient() {
    amb = [];
    var n = Math.min(110, Math.max(40, Math.round((W * H) / 11000)));
    for (var i = 0; i < n; i++) amb.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + 0.25, p: Math.random() * 6.28, s: 0.4 + Math.random() });
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = wrap.clientWidth; H = wrap.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    place(); seedAmbient(); if (reduced) draw(0);
  }
  function draw(t) {
    rafId = null;
    if (t0 == null) t0 = t;
    var tt = (t - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    // the light that travels: a faint path through the letter-stars in reading order
    if (desktop.matches && pos.length > 1) {
      ctx.strokeStyle = "rgba(216,176,114,0.11)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pos[0].x, pos[0].y);
      for (var i = 1; i < pos.length; i++) ctx.lineTo(pos[i].x, pos[i].y);
      ctx.stroke();
    }
    // ambient twinkle (behind the letter-stars)
    for (var j = 0; j < amb.length; j++) {
      var a = amb[j], al = reduced ? 0.4 : (0.28 + 0.3 * Math.sin(tt * a.s + a.p));
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832);
      ctx.fillStyle = "rgba(255,221,160," + al.toFixed(3) + ")"; ctx.fill();
    }
    if (!reduced && onScreen) rafId = requestAnimationFrame(draw);
  }
  function kick() { if (!reduced && onScreen && rafId == null) { t0 = null; rafId = requestAnimationFrame(draw); } }

  window.addEventListener("resize", resize);
  (desktop.addEventListener ? desktop.addEventListener("change", resize) : desktop.addListener(resize));
  resize();
  if (reduced) { draw(0); return; }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { onScreen = !document.hidden; kick(); });
  kick();
})();
