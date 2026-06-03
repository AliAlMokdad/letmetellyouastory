/* ============================================================================
   app.js — shared behavior (classic script, defer)
   Header scroll state, accessible mobile nav (focus trap + Esc + inert),
   scroll-reveal, footer year.
   ========================================================================== */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.documentElement.classList.add("reduced");

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
      if (links[0]) links[0].focus();
      document.addEventListener("keydown", onKey);
    }
    function closeNav(returnFocus) {
      nav.classList.remove("open"); toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      document.removeEventListener("keydown", onKey);
      syncInert();
      if (returnFocus !== false) toggle.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") { closeNav(); return; }
      if (e.key !== "Tab" || !links.length) return;
      var first = links[0], last = links[links.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    toggle.addEventListener("click", function () {
      if (nav.classList.contains("open")) closeNav(); else openNav();
    });
    links.forEach(function (a) { a.addEventListener("click", function () { closeNav(false); }); });
    mq.addEventListener ? mq.addEventListener("change", syncInert) : mq.addListener(syncInert);
    syncInert();
  }

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

  /* footer year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* progressive web app — read offline + installable */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
