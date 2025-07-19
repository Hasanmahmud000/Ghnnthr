const CACHE_NAME = 'cricstreamzone-v3.0';
const urlsToCache = [
  '/',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.7.4/lottie.min.js',
  'https://i.postimg.cc/3rPWWckN/icon-192.png'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== 'notification-cache') {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
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

// ✅ Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  
  event.notification.close();

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no existing window/tab, open a new one
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ✅ Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag);
});

// ✅ Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-notifications') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(
      // Perform background notification check
      checkMatchUpdates()
    );
  }
});

// ✅ Periodic Background Sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-match-updates') {
    console.log('⏰ Periodic sync triggered');
    event.waitUntil(
      checkMatchUpdates()
    );
  }
});

// ✅ Check Match Updates Function
async function checkMatchUpdates() {
  try {
    console.log('🔍 Checking for match updates...');
    const response = await fetch('https://script.google.com/macros/s/AKfycbxZfHUGsH19x3hZp5eeo3tEMJuQxvOPHpyS_LAqow4rlBciyrhP0NdaI2NzeZiyA5SF9A/exec');
    const data = await response.json();
    
    if (data.matches) {
      console.log('📊 Found', data.matches.length, 'matches');
      
      // Send message to main thread with updated matches
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'MATCHES_UPDATED',
          matches: data.matches
        });
      });
      
      // Check for notifications
      await checkAndSendBackgroundNotifications(data.matches);
    }
  } catch (error) {
    console.error('❌ Error checking match updates:', error);
  }
}

// ✅ Background Notification Checker
async function checkAndSendBackgroundNotifications(matches) {
  if (!matches || !Array.isArray(matches)) return;
  
  const now = new Date();
  console.log('🔔 Checking background notifications at:', now.toLocaleTimeString());
  
  for (const match of matches) {
    const matchTime = new Date(match.MatchTime);
    const timeDiff = matchTime - now;
    const duration = parseInt(match.MatchDuration) || 360;
    const endTime = new Date(matchTime.getTime() + (duration * 60 * 1000));
    
    const matchId = `${match.Team1}-${match.Team2}-${match.MatchTime}`;
    
    // 15 minutes before
    if (timeDiff > 14 * 60 * 1000 && timeDiff <= 15 * 60 * 1000) {
      await sendBackgroundNotification(
        '⏰ Match Starting Soon!',
        `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
        `15min-${matchId}`
      );
    }
    
    // 5 minutes before
    else if (timeDiff > 4 * 60 * 1000 && timeDiff <= 5 * 60 * 1000) {
      await sendBackgroundNotification(
        '🚨 Match Starting Very Soon!',
        `${match.Team1} vs ${match.Team2} starts in 5 minutes`,
        `5min-${matchId}`
      );
    }
    
    // Match started
    else if (timeDiff > -60 * 1000 && timeDiff <= 60 * 1000) {
      await sendBackgroundNotification(
        '🔴 LIVE NOW!',
        `${match.Team1} vs ${match.Team2} is now LIVE!`,
        `live-${matchId}`
      );
    }
    
    // Match ended
    else if (now >= endTime && (now - endTime) <= 60 * 1000) {
      await sendBackgroundNotification(
        '🏁 Match Ended',
        `${match.Team1} vs ${match.Team2} has ended`,
        `end-${matchId}`
      );
    }
  }
}

// ✅ Send Background Notification
async function sendBackgroundNotification(title, body, tag) {
  try {
    // Check if this notification was already sent
    const cache = await caches.open('notification-cache');
    const response = await cache.match(tag);
    
    if (response) {
      console.log('📤 Notification already sent:', tag);
      return;
    }
    
    console.log('📤 Sending background notification:', title);
    
    // Send notification
    await self.registration.showNotification(title, {
      body: body,
      icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
      badge: 'https://i.postimg.cc/3rPWWckN/icon-192.png',
      tag: tag,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        url: '/',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: 'View Match',
          icon: 'https://i.postimg.cc/3rPWWckN/icon-192.png'
        }
      ]
    });
    
    // Mark as sent
    await cache.put(tag, new Response('sent'));
    
  } catch (error) {
    console.error('❌ Error sending background notification:', error);
  }
}

// ✅ Clean old notification cache
setInterval(async () => {
  try {
    const cache = await caches.open('notification-cache');
    const keys = await cache.keys();
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const timestamp = response.headers.get('timestamp');
        if (timestamp && parseInt(timestamp) < oneDayAgo) {
          await cache.delete(request);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error cleaning notification cache:', error);
  }
}, 60 * 60 * 1000); // Clean every hour
