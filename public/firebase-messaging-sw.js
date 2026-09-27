// Offline functionality
const CACHE_NAME = 't1-app-cache-v1';
const OFFLINE_URL = '/offline.html'; // not shipped; the inline page below is the fallback

// Cache essential files during installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/t1 logo/T1 LOGO DARK.png',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/logo.png'
      ]).then(() => {
        console.log('Service Worker: Essential files cached');
      }).catch((error) => {
        console.error('Service Worker: Cache addAll failed:', error);
      });
    })
  );
  self.skipWaiting();
});

// Serve offline page when network requests fail
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests for our origin
  if (url.origin !== location.origin) {
    return;
  }

  console.log('Service Worker: Fetch event for', event.request.url, 'mode:', event.request.mode);

  // Handle navigation requests (page loads) and document requests
  if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
    console.log('Service Worker: Handling navigation/document request');
    event.respondWith(
      fetch(event.request).catch((error) => {
        console.log('Service Worker: Network request failed, serving offline page', error);
        return caches.match(OFFLINE_URL).then((response) => {
          if (response) {
            console.log('Service Worker: Serving cached offline page');
            return response;
          } else {
            console.error('Service Worker: Offline page not found in cache');
            // Return a basic offline response
            return new Response(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Offline - Triple One</title>
                  <style>
                    body { font-family: Arial; text-align: center; padding: 2rem; background: #000; color: #fff; }
                    h1 { color: #ba181c; }
                  </style>
                </head>
                <body>
                  <h1>You're Offline</h1>
                  <p>Please check your internet connection and try again.</p>
                  <button onclick="window.location.reload()">Try Again</button>
                </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html' }
            });
          }
        });
      })
    );
  } else {
    // For other requests, try network first, then cache
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});

// Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});
