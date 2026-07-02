/* ============================================================================
   app.js — shared behavior (classic script, defer)
   Header scroll state, accessible mobile nav (focus trap + Esc + inert),
   scroll-reveal, footer year.
   ========================================================================== */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.documentElement.classList.add("reduced");
  /* entrance animations are opt-in via a class so no-JS keeps text fully visible */
  if (!reduced) document.documentElement.classList.add("anim");

  /* header background after scroll */
  var head = document.querySelector(".site-head");
  if (head) {
    var onScroll = function () { head.classList.toggle("scrolled", window.scrollY > 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- accessible mobile nav drawer ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    if (!nav.id) nav.id = "primary-nav";
    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-expanded", "false");

    var mq = window.matchMedia("(max-width: 720px)");
    var links = nav.querySelectorAll("a");

    function syncInert() {
      // the drawer only exists on mobile; when closed there, hide it from AT + tab order
      if (mq.matches && !nav.classList.contains("open")) nav.setAttribute("inert", "");
      else nav.removeAttribute("inert");
    }
    function openNav() {
      nav.classList.add("open"); toggle.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      nav.removeAttribute("inert");
      document.documentElement.classList.add("nav-locked");
      if (links[0]) links[0].focus();
      document.addEventListener("keydown", onKey);
    }
    function closeNav(returnFocus) {
      nav.classList.remove("open"); toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      document.documentElement.classList.remove("nav-locked");
      document.removeEventListener("keydown", onKey);
      syncInert();
      if (returnFocus !== false) toggle.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") { closeNav(); return; }
      if (e.key !== "Tab" || !links.length) return;
      // the trap cycles the toggle (the visible close button) together with the links,
      // so a keyboard user can always reach it
      var first = toggle, last = links[links.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    toggle.addEventListener("click", function () {
      if (nav.classList.contains("open")) closeNav(); else openNav();
    });
    window.addEventListener("pageshow", function (ev) {   // a bfcache restore must never resurrect a stuck scroll lock
      if (ev.persisted) document.documentElement.classList.remove("nav-locked");
    });
    links.forEach(function (a) { a.addEventListener("click", function () { closeNav(false); }); });
    mq.addEventListener ? mq.addEventListener("change", syncInert) : mq.addListener(syncInert);
    syncInert();
  }

  /* the candle remembers: a returning reader's flame continues where it stopped.
     Enhancement only — no-JS and first-visit keep the static "Light the first letter".
     Runs on DOMContentLoaded: app.js executes before ltys.js in defer order, so
     window.LTYS does not exist yet at parse time. */
  document.addEventListener("DOMContentLoaded", function () {
  var chainEl = document.getElementById("ltys-chain");
  if (chainEl && window.LTYS && LTYS.count() > 0) {
    try {
      var chain = JSON.parse(chainEl.textContent || "[]");
      var escText = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      var next = null;
      if (LTYS.count() < LTYS.total) {
        var last = LTYS.lastRead(), start = 0;
        for (var ci = 0; ci < chain.length; ci++) { if (chain[ci].s === last) { start = ci + 1; break; } }
        for (var cj = 0; cj < chain.length; cj++) {
          var cand = chain[(start + cj) % chain.length];
          if (!LTYS.isRead(cand.s)) { next = cand; break; }
        }
      }
      var heroCta = document.querySelector(".hero .hero-cta .btn");
      if (heroCta) {
        var line = "";
        if (!next) {
          heroCta.innerHTML = 'Return to the letters <span class="arrow">&rarr;</span>';
          line = "All " + LTYS.total + " lights are lit. Stay as long as you need.";
        } else {
          heroCta.setAttribute("href", next.u);
          heroCta.innerHTML = 'Continue: <em>' + escText(next.t) + '</em> <span class="arrow">&rarr;</span>';
          line = LTYS.count() + " of " + LTYS.total + " letters lit. The candle remembers.";
        }
        if (line) {
          var ret = document.createElement("p");
          ret.className = "hero-return";
          ret.textContent = line;
          heroCta.parentNode.insertAdjacentElement("afterend", ret);
        }
      }
      // the letters page carries the same thread: phone readers never see the
      // desktop constellation, so the timeline welcomes them back here
      var ltHead = document.querySelector(".lt-head");
      if (ltHead && next) {
        var cont = document.createElement("p");
        cont.className = "lt-note lt-continue";
        cont.innerHTML = 'Continue with <a href="' + next.u + '"><em>' + escText(next.t) + '</em></a> <span aria-hidden="true">&rarr;</span>';
        ltHead.appendChild(cont);
      }
    } catch (e) {}
  }
  });

  /* scroll reveal */
  var items = document.querySelectorAll("[data-reveal]");
  if (items.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      items.forEach(function (el) { io.observe(el); });
    }
  }

  /* progressive web app — read offline + installable */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  /* one-time note (letters page): the "short version" notice — show once, remember dismissal */
  var note = document.querySelector(".note-toast");
  if (note) {
    var NKEY = "ltys_note_short_v1", noteSeen = null;
    try { noteSeen = localStorage.getItem(NKEY); } catch (e) {}
    if (!noteSeen) {
      var noteEsc = function (e) { if (e.key === "Escape") hideNote(); };
      var hideNote = function () {
        note.classList.remove("in");
        try { localStorage.setItem(NKEY, "1"); } catch (e) {}
        document.removeEventListener("keydown", noteEsc);
        setTimeout(function () { note.setAttribute("hidden", ""); }, 700);
      };
      note.removeAttribute("hidden");
      setTimeout(function () { note.classList.add("in"); }, 1400);
      var nx = note.querySelector(".note-x");
      if (nx) nx.addEventListener("click", hideNote);
      document.addEventListener("keydown", noteEsc);
    }
  }

  /* lumen: a travelling light carries you between pages (outgoing warm wipe).
     Fail-safe by design — the overlay is always pointer-events:none, navigation
     has a timeout fallback, and reduced-motion / no-JS fall back to a plain link. */
  var lumen = document.querySelector(".lumen");
  if (lumen) {
    var resetLumen = function () { lumen.className = "lumen"; };
    window.addEventListener("pageshow", function (ev) { if (ev.persisted) resetLumen(); }); // clear any stuck overlay on bfcache restore
    // arrival: the carried light settles onto the new page (home has its own hero-veil)
    if (!reduced && !document.body.classList.contains("home")) {
      lumen.classList.add("in");
      lumen.addEventListener("animationend", function (ev) { if (ev.animationName === "lumen-in") lumen.classList.remove("in"); });
    }
    if (!reduced) {
      document.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest("a[href]") : null;
        if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var url; try { url = new URL(a.getAttribute("href"), location.href); } catch (_) { return; }
        if (url.origin !== location.origin) return;     // external link: let it open normally
        if (url.pathname === location.pathname) return;  // same page / hash anchor: no transition
        e.preventDefault();
        var done = false, go = function () { if (done) return; done = true; location.href = a.href; };
        lumen.classList.remove("in");
        lumen.classList.add("out");
        lumen.addEventListener("animationend", go, { once: true });
        setTimeout(go, 720);  // fail-safe: navigate even if animationend never fires
      });
    }
  }
})();
