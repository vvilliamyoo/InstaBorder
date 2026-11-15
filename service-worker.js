const CACHE_NAME = 'instaborder-v1';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith('instaborder-') && cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith((async () => {
        let response;
        try {
            response = await fetch(request);
        } catch (error) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
            if (request.mode === 'navigate') {
                const fallback = await caches.match('./index.html');
                if (fallback) {
                    return fallback;
                }
            }
            throw error;
        }

        if (response.ok) {
            try {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            } catch (error) {
                console.error('Failed to cache app response:', error);
            }
        }
        return response;
    })());
});
