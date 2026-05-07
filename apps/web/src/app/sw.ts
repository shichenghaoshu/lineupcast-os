/// <reference lib="webworker" />
/**
 * Service Worker source for LineupCast OS.
 *
 * The compiled output lives at /public/sw.js which is served from the origin
 * root so it can control all pages. Edit this file to keep the logic in
 * TypeScript, then copy or build the result into public/sw.js.
 */

const CACHE_NAME = "lineupcast-v1";

const STATIC_ASSETS: string[] = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable-512.svg",
];

// Install: pre-cache static assets
(self as unknown as ServiceWorkerGlobalScope).addEventListener(
  "install",
  (event: ExtendableEvent) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache: Cache) => cache.addAll(STATIC_ASSETS))
    );
    (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  }
);

// Activate: clean up old caches
(self as unknown as ServiceWorkerGlobalScope).addEventListener(
  "activate",
  (event: ExtendableEvent) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys: string[]) =>
          Promise.all(
            keys
              .filter((key: string) => key !== CACHE_NAME)
              .map((key: string) => caches.delete(key))
          )
        )
    );
    (self as unknown as ServiceWorkerGlobalScope).clients.claim();
  }
);

// Fetch: network-first for navigation/API, cache-first for static assets
(self as unknown as ServiceWorkerGlobalScope).addEventListener(
  "fetch",
  (event: FetchEvent) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    // Skip non-GET requests
    if (request.method !== "GET") return;

    // API routes and navigation: network-first
    if (url.pathname.startsWith("/api/") || request.mode === "navigate") {
      event.respondWith(
        fetch(request)
          .then((response: Response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache: Cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            caches
              .match(request)
              .then(
                (cached: Response | undefined) => cached || caches.match("/")
              )
          )
      );
      return;
    }

    // Static assets (JS, CSS, images, fonts): cache-first
    event.respondWith(
      caches
        .match(request)
        .then((cached: Response | undefined) => {
          if (cached) return cached;
          return fetch(request).then((response: Response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache: Cache) => cache.put(request, clone));
            }
            return response;
          });
        })
    );
  }
);
