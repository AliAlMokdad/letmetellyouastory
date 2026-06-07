/* Let Me Tell You a Story — service worker: read offline, installable.
   Pages: network-first (fresh online, cached when offline). Assets: cache-first
   (they are content-hash busted, so safe to keep immutably). */
const CACHE = 'ltys-c0ef63ffc2';
const PRECACHE = ["/", "/letters/", "/index/", "/about/", "/404.html", "/letters/the-light-that-travels/", "/letters/on-friendship/", "/letters/on-tired-hearts/", "/letters/on-the-north-star/", "/letters/on-discipline/", "/letters/on-reflection/", "/letters/on-worth/", "/letters/on-resilience/", "/letters/on-daily-habits/", "/letters/on-listening/", "/letters/on-responsibility/", "/letters/on-patience/", "/letters/on-imposter-syndrome/", "/letters/on-optimism/", "/letters/on-strategy-and-passion/", "/letters/on-insults/", "/letters/on-belonging/", "/letters/on-home/", "/letters/on-people-and-the-system/", "/letters/on-trust/", "/letters/on-the-formula-for-success/", "/letters/on-excellence/", "/letters/on-joy/", "/letters/on-failing/", "/letters/on-being-lonely/", "/letters/on-grief-and-loss/", "/letters/on-greed/", "/letters/on-work-life-harmony/", "/letters/on-time/", "/letters/on-working-together/", "/letters/on-accountability/", "/letters/from-0-to-2/", "/letters/on-being-an-everyday-humanitarian/", "/letters/on-dreams-and-peace/", "/letters/the-candle-has-gone-out/", "/letters/acknowledgements/", "/assets/css/style.css?v=802227f9", "/assets/css/fonts.css?v=5d873a6a", "/assets/js/app.js?v=cc4305be", "/assets/js/ltys.js?v=a24247e0", "/assets/js/reader.js?v=e09bf7cd", "/assets/js/timeline.js?v=7d86efea", "/assets/js/candle.js?v=40ac0007", "/assets/js/constellation.js?v=a58eb245", "/assets/js/three.module.js?v=160m", "/assets/fonts/cormorant-garamond-500-latin.woff2", "/assets/fonts/cormorant-garamond-500-italic-latin.woff2", "/assets/fonts/eb-garamond-400-latin.woff2", "/assets/fonts/eb-garamond-400-italic-latin.woff2", "/favicon.svg", "/assets/img/og.png", "/assets/img/ali-al-mokdad.jpg", "/assets/icons/icon-192.png", "/assets/icons/icon-512.png"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/downloads/') === 0) return;   // the book download: always fresh from network
  if (req.mode === 'navigate') {           // pages: network-first
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match('/'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {   // assets: cache-first
    return hit || fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return new Response('', { status: 504 }); });
  }));
});
