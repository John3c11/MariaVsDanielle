// Service worker for Maria vs Danielle
// - Opens fast and works with bad signal: the page and the Google Sheets data are
//   fetched fresh when possible, and fall back to the last saved copy when not.
// - Live game data (ESPN) and pick submission are never cached.

const CACHE = 'mvd-v2'; // renaming this wipes every phone's saved copy once (v85 cleanup)
const NET_TIMEOUT = 4000; // ms to wait for the network before using the saved copy

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.json']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSheets(url) { return url.hostname === 'sheets.googleapis.com'; }
function isStatic(url) {
  return url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache: live scores, pick submission, anything else off-site
  if (url.origin !== self.location.origin && !isSheets(url) && !isStatic(url)) return;

  // Fonts / libraries: cache first (they never change)
  if (isStatic(url)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Page, images and sheet data: network first, saved copy if the network is slow or down
  // Versioned site files (style.css?v=68, js/*.js?v=68) only ever fall back to the same version,
  // so a slow connection can't mix old and new files.
  e.respondWith(networkFirst(req, isSheets(url) || /[?&]v=/.test(url.search)));
});

// Saving style.css?v=86 deletes the saved style.css?v=85, so phones only ever keep one version
async function dropOldVersions(cache, url) {
  if (url.origin !== self.location.origin || !url.searchParams.has('v')) return;
  const keys = await cache.keys();
  await Promise.all(keys.map((k) => {
    const u = new URL(k.url);
    return u.pathname === url.pathname && u.search !== url.search ? cache.delete(k) : null;
  }));
}

async function networkFirst(req, exact) {
  const cache = await caches.open(CACHE);
  const url = new URL(req.url);
  const network = fetch(req).then(async (res) => {
    // One-off checks (the Status screen adds &_=time) are never saved
    if (res.ok && !url.searchParams.has('_')) {
      cache.put(req, res.clone()).then(() => dropOldVersions(cache, url)).catch(() => {});
    }
    return res;
  });

  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NET_TIMEOUT)),
    ]);
  } catch (err) {
    const saved = await cache.match(req, { ignoreSearch: !exact });
    if (saved) return saved;
    return network; // nothing saved yet: keep waiting on the network
  }
}
