'use strict';

const scope = self.registration.scope;
const cachePrefix = 'wayline:' + scope + ':';
const build = '4';
const cacheName = cachePrefix + build;
const appFiles = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './booking-form.png',
  './booking-details.png',
  './journeys-header.png',
  './journeys-empty.png',
  './journeys-previous.png',
  './profile-reference.png',
  './dock-booking.png',
  './dock-journeys.png',
  './dock-profile.png',
  './icon-192.png',
  './icon-512.png',
].map((file) => new URL(file, scope).href);
const appShell = appFiles[0];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await Promise.all(appFiles.map(async (url) => {
      const versionedUrl = new URL(url);
      versionedUrl.searchParams.set('v', build);
      const response = await fetch(versionedUrl, {cache: 'reload'});
      if (!response.ok) throw new Error('Could not download ' + versionedUrl.pathname);
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;

  const url = new URL(request.url);
  const scopedPath = new URL(scope).pathname;
  if (request.mode === 'navigate' && [scopedPath, scopedPath + 'index.html'].includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(appShell))
      .then((response) => response || fetch(request)));
    return;
  }

  if (appFiles.includes(request.url)) {
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(request))
      .then((response) => response || fetch(request)));
  }
});
