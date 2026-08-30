/* Service Worker — Universal Invoice Manager PWA
   Meng-cache "app shell" agar bisa diinstal & tampil offline.
   Data (invoice, klien, dsb.) tetap butuh koneksi ke server GAS. */
var CACHE = 'uim-shell-v23';
var SHELL = [
  './',
  './index.html',
  './config.js',
  './manifest.json',
  './icon.svg',
  './reset.html',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// Terima perintah dari halaman untuk langsung mengambil alih
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  // Jangan tangani POST/PUT (mis. panggilan ke server GAS) — biarkan langsung ke jaringan
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Navigasi halaman: network-first, fallback ke index.html dari cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(function () { return caches.match('./index.html'); }));
    return;
  }

  // Berkas aplikasi sendiri: SELALU coba jaringan dulu supaya pembaruan
  // langsung terpakai (penyebab umum "aplikasi tidak update").
  if (url.origin === location.origin && /\.(html|js|json)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // Aset pihak ketiga: cache-first, lalu simpan salinan
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        try {
          if (res && res.status === 200) {
            var host = url.host;
            var ok = url.origin === location.origin ||
              host.indexOf('cloudflare') >= 0 ||
              host.indexOf('gstatic') >= 0 ||
              host.indexOf('googleapis') >= 0;
            if (ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
          }
        } catch (err) {}
        return res;
      }).catch(function () { return cached; });
    })
  );
});
