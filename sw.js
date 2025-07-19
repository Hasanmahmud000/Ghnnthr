const CACHE_NAME = 'cricstreamzone-v2.1';
const urlsToCache = [
  '/',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== 'notification-cache') {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync for notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-notifications') {
    event.waitUntil(
      // Perform background notification check
      fetch('/api/check-notifications')
        .then(response => response.json())
        .then(data => {
          if (data.notifications) {
            data.notifications.forEach(notification => {
              self.registration.showNotification(notification.title, {
                body: notification.body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: notification.tag,
                data: notification.data
              });
            });
          }
        })
        .catch(err => console.log('Background sync failed:', err))
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-match-updates') {
    event.waitUntil(
      // Check for match updates periodically
      checkMatchUpdates()
    );
  }
});

async function checkMatchUpdates() {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec');
    const data = await response.json();
    
    if (data.matches) {
      // Send message to main thread with updated matches
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'MATCHES_UPDATED',
          matches: data.matches
        });
      });
    }
  } catch (error) {
    console.error('Error checking match updates:', error);
  }
}
