/**
 * @file service_worker.js
 * @brief Minimal service worker that makes the app installable (PWA).
 *
 * It does not cache anything: every request goes to the network as normal.
 * Offline support is out of scope for the MVP.
 */

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

/*
 * An empty fetch handler is enough for browsers to treat the site as an
 * installable app; requests are handled by the network as usual.
 */
self.addEventListener("fetch", () => {});
