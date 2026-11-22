// Service Worker: speichert die App-Dateien auf dem Gerät, damit sie auch
// ohne Internet startet. Deine Daten liegen NICHT hier, sondern in der
// Datenbank (IndexedDB).
//
// Bei jeder Änderung an der App: VERSION erhöhen (und in js/config.js),
// damit Handys die neuen Dateien laden.

const VERSION = '1.0.0';
// Eigener Präfix: Alle Apps unter schule11.github.io teilen sich dieselben Caches.
// Gleiche Namen würden sich gegenseitig überschreiben oder löschen.
const PREFIX = 'haushaltsbuch-';
const CACHE = `${PREFIX}${VERSION}`;
// Präfix der App, aus der diese entstanden ist (siehe activate)
const OLD_PREFIX = 'hundeschule-';

const FILES = [
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'assets/logo.png',
  'js/app.js',
  'js/backup.js',
  'js/badge.js',
  'js/config.js',
  'js/courses.js',
  'js/closing.js',
  'js/tripPdf.js',
  'js/data.js',
  'js/db.js',
  'js/defaults.js',
  'js/exports.js',
  'js/files.js',
  'js/format.js',
  'js/image.js',
  'js/invoicePdf.js',
  'js/invoices.js',
  'js/logo.js',
  'js/notices.js',
  'js/pdf.js',
  'js/ui.js',
  'js/voucherPdf.js',
  'js/vouchers.js',
  'js/yearReport.js',
  'js/views/bookings.js',
  'js/views/cards.js',
  'js/views/categories.js',
  'js/views/components.js',
  'js/views/contacts.js',
  'js/views/courses.js',
  'js/views/charts.js',
  'js/views/closing.js',
  'js/views/form.js',
  'js/views/invoices.js',
  'js/views/overview.js',
  'js/views/personPicker.js',
  'js/views/picker.js',
  'js/views/prices.js',
  'js/views/report.js',
  'js/views/routes.js',
  'js/views/settings.js',
  'js/views/vouchers.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache: 'reload' = frisch vom Server holen, nicht aus dem Browser-Zwischenspeicher
      cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

// Die App sagt Bescheid, wann die neue Version übernommen werden darf
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // Nur eigene, alte Versionen löschen – nie die Caches anderer Apps
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      // Die erste Kopie dieser App lief noch unter dem Namen der Hundeschule-App und
      // hat ihre Dateien in deren Cache gelegt. Nur diese eigenen Einträge entfernen
      // (alles unter der eigenen Adresse); die Dateien der Hundeschule-App bleiben.
      if (key.startsWith(OLD_PREFIX)) {
        const cache = await caches.open(key);
        for (const req of await cache.keys()) {
          if (req.url.startsWith(self.registration.scope)) await cache.delete(req);
        }
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      return (await cache.match('index.html')) || fetch(req);
    }
    return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
