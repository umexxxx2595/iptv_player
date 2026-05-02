/**
 * Basic Service Worker for Caching
 */
const CACHE_NAME = 'iptv-premium-v1';
const ASSETS = [
    './index.html',
    '../styles/base.css',
    '../styles/fonex-theme.css',
    '../src/bootstrap.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
