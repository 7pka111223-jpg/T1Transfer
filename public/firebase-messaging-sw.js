// Offline functionality
const CACHE_NAME = 't1-app-cache-v1';
const OFFLINE_URL = '/offline.html';

// Cache essential files during installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
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

// Firebase messaging (only if available)
try {
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

  // Only initialize Firebase if environment variables are available
  if (self.VITE_FIREBASE_API_KEY) {
    firebase.initializeApp({
      apiKey: self.VITE_FIREBASE_API_KEY,
      authDomain: self.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: self.VITE_FIREBASE_PROJECT_ID,
      storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: self.VITE_FIREBASE_APP_ID,
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('Received background message:', payload);

      const notificationTitle = payload.notification?.title || 'Triple One Alert';
      const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: payload.data,
        actions: [
          { action: 'open', title: 'Open App' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } else {
    console.log('Firebase environment variables not available, skipping Firebase initialization');
  }
} catch (error) {
  console.log('Firebase not available or failed to load:', error);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) {
              return client.focus();
            }
          }
          return clients.openWindow('/');
        })
    );
  }
});
