/* ============================================================================
   constellation.js — the Index as a living night sky (Canvas2D + DOM stars).
   The 36 letters are scattered points of light joined by the faint path the
   light travels through them in reading order. ONE warm light journeys slowly
   along that path — starting from the last letter you read — blooming each
   star as it passes. Ambient stars drift in two depth layers with a gentle
   pointer parallax; a rare meteor crosses; hovering a letter warms the path
   around it. Read letters stay lit gold (ltys.js applyStates).
   On phones, touch devices and reduced-motion it falls back to the readable
   labelled list / one static frame (the light resting where you stopped).
   ========================================================================== */
(function () {
  "use strict";
  var wrap = document.querySelector(".sky-wrap");
  var canvas = document.querySelector(".sky-canvas");
  var list = document.querySelector(".sky-list");
  if (!wrap || !canvas || !list) return;

  /* personal count line — "the ones you have read stay lit" made concrete */
  var countEl = document.querySelector(".sky-count");
  if (countEl && window.LTYS) {
    var n = LTYS.count();
    countEl.textContent = n >= LTYS.total
      ? "All " + LTYS.total + " lights are lit. Thank you for staying."
      : (n > 0
        ? "You have lit " + n + " of " + LTYS.total + " lights."
        : "No lights lit yet. Begin anywhere.");
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // scatter the sky only where the user can actually hover (mouse/trackpad);
  // pure-touch devices (pointer: coarse) keep the readable labelled-pill list.
  var desktop = window.matchMedia("(min-width: 721px) and (pointer: fine)");
  var stars = [].slice.call(list.querySelectorAll(".star"));
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, rafId = null, prev = null, onScreen = true;

  var pos = [];                       // letter-star centers, reading order
  var cum = [], totalLen = 0;         // cumulative path length per star
  var bloom = [];                     // per-star bloom 0..1 (traveler passing)
  var phase = [];                     // per-star twinkle phase
  var isRead = [];
  var hoverIdx = -1;
  var ambFar = [], ambNear = [];
  var px = 0, py = 0, pxT = 0, pyT = 0;   // pointer parallax (eased)
  var d = 0, dFrac = 0, nextStar = 0, travelFade = 1;
  var SPEED = 1 / 115;                // full journey in ~115s — contemplative
  var meteor = null, meteorAt = 12;   // first meteor ~12s in

  function pathPoint(dist) {
    if (!pos.length) return { x: 0, y: 0 };
    if (dist <= 0) return pos[0];
    for (var i = 1; i < pos.length; i++) {
      if (dist <= cum[i]) {
        var f = (dist - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 0.0001);
        return { x: pos[i - 1].x + (pos[i].x - pos[i - 1].x) * f,
                 y: pos[i - 1].y + (pos[i].y - pos[i - 1].y) * f };
      }
    }
    return pos[pos.length - 1];
  }

  function place() {
    if (!desktop.matches) { wrap.classList.remove("sky-active"); pos = []; return; }
    wrap.classList.add("sky-active");
    var w = wrap.clientWidth, h = wrap.clientHeight, count = stars.length;
    var cols = Math.max(4, Math.round(Math.sqrt(count * (w / h))));
    var rows = Math.ceil(count / cols);
    pos = []; cum = []; isRead = [];
    stars.forEach(function (s, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var jx = (((i * 73) % 100) / 100 - 0.5) * 0.72;   // deterministic jitter -> scattered, not a grid
      var jy = (((i * 137) % 100) / 100 - 0.5) * 0.72;
      var x = Math.max(0.045, Math.min(0.955, (col + 0.5 + jx) / cols));
      var y = Math.max(0.06, Math.min(0.94, (row + 0.5 + jy) / rows));
      s.style.left = (x * 100).toFixed(2) + "%";
      s.style.top = (y * 100).toFixed(2) + "%";
      pos.push({ x: x * w, y: y * h });
      isRead.push(s.classList.contains("read"));
      if (bloom.length <= i) { bloom.push(0); phase.push((i * 2.399) % 6.283); }
    });
    totalLen = 0; cum[0] = 0;
    for (var i = 1; i < pos.length; i++) {
      totalLen += Math.hypot(pos[i].x - pos[i - 1].x, pos[i].y - pos[i - 1].y);
      cum[i] = totalLen;
    }
    d = dFrac * totalLen;             // keep the traveler's place across resizes
    for (nextStar = 0; nextStar < pos.length && cum[nextStar] < d - 1; nextStar++);
  }

  function restingIndex() {
    // the light rests where you stopped: the furthest-along read letter (else the start)
    var idx = 0;
    for (var i = 0; i < isRead.length; i++) if (isRead[i]) idx = i;
    return idx;
  }

  function seedAmbient() {
    function layer(count, rMin, rMax, vx) {
      var a = [];
      for (var i = 0; i < count; i++) a.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rMin + Math.random() * (rMax - rMin),
        p: Math.random() * 6.283, s: 0.35 + Math.random() * 0.9, vx: vx * (0.5 + Math.random())
      });
      return a;
    }
    var base = Math.min(120, Math.max(46, Math.round((W * H) / 11000)));
    ambFar = layer(Math.round(base * 0.62), 0.25, 0.85, 0.55);   // deep field: smaller, slower
    ambNear = layer(Math.round(base * 0.38), 0.7, 1.35, 1.25);   // near field: a touch larger, drifts more
  }

  function resize() {
    if (!desktop.matches) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      canvas.style.display = "none"; place(); return;
    }
    canvas.style.display = "";
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = wrap.clientWidth; H = wrap.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    place(); seedAmbient();
    if (reduced) drawStatic();
  }

  function drawAmbient(layer, t, par) {
    for (var i = 0; i < layer.length; i++) {
      var a = layer[i];
      var x = (a.x + t * a.vx + px * par + W) % W;
      var al = 0.26 + 0.30 * Math.sin(t * a.s + a.p);
      ctx.beginPath(); ctx.arc(x, a.y + py * par * 0.6, a.r, 0, 6.2832);
      ctx.fillStyle = "rgba(255,221,160," + Math.max(al, 0.04).toFixed(3) + ")";
      ctx.fill();
    }
  }

  // halos are pre-rendered sprites: one gradient each at startup instead of
  // ~37 createRadialGradient allocations per frame
  function makeHaloSprite(warm) {
    var S = 64, c = document.createElement("canvas"); c.width = c.height = S;
    var g2 = c.getContext("2d");
    var g = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, warm ? "rgba(255,205,130,1)" : "rgba(210,140,80,1)");
    g.addColorStop(1, "rgba(255,180,100,0)");
    g2.fillStyle = g; g2.fillRect(0, 0, S, S);
    return c;
  }
  var haloWarm = makeHaloSprite(true), haloCool = makeHaloSprite(false);
  function drawHalo(x, y, r, alpha, warm) {
    if (alpha <= 0 || r <= 0) return;
    ctx.globalAlpha = Math.min(alpha, 1);
    ctx.drawImage(warm ? haloWarm : haloCool, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function drawPath(alpha) {
    if (pos.length < 2) return;
    ctx.strokeStyle = "rgba(216,176,114," + alpha + ")"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pos[0].x, pos[0].y);
    for (var i = 1; i < pos.length; i++) ctx.lineTo(pos[i].x, pos[i].y);
    ctx.stroke();
  }

  function drawWarmTrail() {
    // the path remembers: a warmed trail cools behind the traveling light
    var span = Math.min(totalLen * 0.16, 320), steps = 13;
    ctx.lineWidth = 1.35; ctx.lineCap = "round";
    for (var s = 0; s < steps; s++) {
      var a0 = d - span * (s + 1) / steps, a1 = d - span * s / steps;
      if (a1 <= 0) break;
      var p0 = pathPoint(Math.max(a0, 0)), p1 = pathPoint(a1);
      var al = 0.30 * (1 - s / steps) * travelFade;
      ctx.strokeStyle = "rgba(255,196,120," + al.toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }

  function drawTraveler(t) {
    var p = pathPoint(d);
    var pulse = 1 + 0.12 * Math.sin(t * 2.1);
    drawHalo(p.x, p.y, 16 * pulse, 0.34 * travelFade, true);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, 6.2832);
    ctx.fillStyle = "rgba(255,238,205," + (0.92 * travelFade).toFixed(3) + ")";
    ctx.fill();
  }

  function drawStars(t) {
    for (var i = 0; i < pos.length; i++) {
      var tw = reduced ? 0 : 0.30 * Math.sin(t * 0.45 + phase[i]);
      var base = isRead[i] ? 0.20 : 0.085;
      var a = base * (1 + tw) + bloom[i] * 0.32 + (hoverIdx === i ? 0.18 : 0);
      drawHalo(pos[i].x, pos[i].y, isRead[i] ? 15 : 11, Math.min(a, 0.55), isRead[i]);
    }
  }

  function drawHoverPath() {
    if (hoverIdx < 0 || pos.length < 2) return;
    ctx.strokeStyle = "rgba(243,217,166,0.20)"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    var a = Math.max(hoverIdx - 1, 0), b = Math.min(hoverIdx + 1, pos.length - 1);
    ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y);
    for (var i = a + 1; i <= b; i++) ctx.lineTo(pos[i].x, pos[i].y);
    ctx.stroke();
  }

  function drawMeteor(t) {
    if (!meteor) {
      if (t > meteorAt) {
        var fromTop = Math.random() < 0.7;
        meteor = { x: W * (0.15 + Math.random() * 0.7), y: fromTop ? H * 0.06 : H * 0.2,
                   vx: 220 + Math.random() * 120, vy: 90 + Math.random() * 70,
                   born: t, life: 0.7 };
      }
      return;
    }
    var age = t - meteor.born, k = age / meteor.life;
    if (k >= 1) { meteor = null; meteorAt = t + 18 + Math.random() * 26; return; }
    var al = 0.34 * Math.sin(Math.PI * k);   // ease in and out
    var mx = meteor.x + meteor.vx * age, my = meteor.y + meteor.vy * age;
    var g = ctx.createLinearGradient(mx - meteor.vx * 0.32, my - meteor.vy * 0.32, mx, my);
    g.addColorStop(0, "rgba(255,221,160,0)");
    g.addColorStop(1, "rgba(255,231,190," + al.toFixed(3) + ")");
    ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mx - meteor.vx * 0.32, my - meteor.vy * 0.32);
    ctx.lineTo(mx, my); ctx.stroke();
  }

  function draw(ts) {
    rafId = null;
    if (prev == null) prev = ts;
    var dt = Math.min((ts - prev) / 1000, 0.1); prev = ts;
    var t = ts / 1000;

    px += (pxT - px) * 0.04; py += (pyT - py) * 0.04;   // eased parallax

    // advance the traveling light; fade out at the journey's end and begin again
    d += totalLen * SPEED * dt;
    if (d > totalLen + 1) { d = 0; nextStar = 0; travelFade = 0; }
    if (travelFade < 1) travelFade = Math.min(1, travelFade + dt * 0.7);
    if (d > totalLen - totalLen * 0.02) travelFade = Math.max(0.25, 1 - (d - (totalLen * 0.98)) / (totalLen * 0.02) * 0.75);
    dFrac = totalLen ? d / totalLen : 0;
    while (nextStar < pos.length && cum[nextStar] <= d) { bloom[nextStar] = 1; nextStar++; }
    for (var i = 0; i < bloom.length; i++) if (bloom[i] > 0) bloom[i] = Math.max(0, bloom[i] - dt * 0.4);

    ctx.clearRect(0, 0, W, H);
    drawAmbient(ambFar, t, 3);
    drawAmbient(ambNear, t, 7);
    drawPath(0.06);
    drawWarmTrail();
    drawHoverPath();
    drawStars(t);
    drawTraveler(t);
    drawMeteor(t);

    if (!reduced && onScreen) rafId = requestAnimationFrame(draw);
  }

  function drawStatic() {
    // reduced motion: one quiet frame, the light resting where you stopped
    d = cum[restingIndex()] || 0; travelFade = 1;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < ambFar.length; i++) { var a = ambFar[i];
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fillStyle = "rgba(255,221,160,0.34)"; ctx.fill(); }
    for (var j = 0; j < ambNear.length; j++) { var b = ambNear[j];
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fillStyle = "rgba(255,221,160,0.4)"; ctx.fill(); }
    drawPath(0.08);
    for (var k = 0; k < pos.length; k++) drawHalo(pos[k].x, pos[k].y, isRead[k] ? 15 : 11, isRead[k] ? 0.22 : 0.09, isRead[k]);
    drawTraveler(0);
  }

  function kick() { if (!reduced && desktop.matches && onScreen && rafId == null) { prev = null; rafId = requestAnimationFrame(draw); } }

  /* hover + keyboard focus: the sky acknowledges which letter you are with */
  stars.forEach(function (s, i) {
    s.addEventListener("mouseenter", function () { hoverIdx = i; });
    s.addEventListener("mouseleave", function () { if (hoverIdx === i) hoverIdx = -1; });
    s.addEventListener("focusin", function () { hoverIdx = i; });
    s.addEventListener("focusout", function () { if (hoverIdx === i) hoverIdx = -1; });
  });
  wrap.addEventListener("pointermove", function (e) {
    var r = wrap.getBoundingClientRect();
    pxT = ((e.clientX - r.left) / Math.max(r.width, 1) - 0.5) * 2;
    pyT = ((e.clientY - r.top) / Math.max(r.height, 1) - 0.5) * 2;
  }, { passive: true });
  wrap.addEventListener("pointerleave", function () { pxT = 0; pyT = 0; }, { passive: true });

  window.addEventListener("resize", resize);
  (desktop.addEventListener ? desktop.addEventListener("change", resize) : desktop.addListener(resize));
  resize();
  // the journey begins where you left off
  d = cum[restingIndex()] || 0; dFrac = totalLen ? d / totalLen : 0;
  for (nextStar = 0; nextStar < pos.length && cum[nextStar] <= d; nextStar++);
  if (reduced) { if (desktop.matches) drawStatic(); return; }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; kick(); }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { onScreen = !document.hidden; kick(); });
  kick();
})();
