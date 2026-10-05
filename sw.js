/* GDO & Mio Capitale - funzionamento senza internet (generato da costruisci_telefono.py). */
const CACHE = 'gdo-mio-capitale-ee7ee89f69';
const FILE = ['./', './index.html', './app.js', './telefono.css', './manifest.webmanifest', './stile.css', './cifratura.js', './motore_simulazioni.js', './icone/icona-192.png', './icone/icona-512.png', './icone/icona-maskable-512.png', './icone/apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
