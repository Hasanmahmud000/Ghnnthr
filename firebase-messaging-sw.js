// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCzWmJUAceuYGjzbVv0ceu7RU78fVs0OM4",
  authDomain: "criczone-b1c64.firebaseapp.com",
  projectId: "criczone-b1c64",
  storageBucket: "criczone-b1c64.firebasestorage.app",
  messagingSenderId: "508655160995",
  appId: "1:508655160995:web:813362e519ed6f79b07916"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification.title || 'CricStreamZone';
  const notificationOptions = {
    body: payload.notification.body || 'New match update available!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'default',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      clickAction: payload.data?.clickAction || '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View Match',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window/tab open with the target URL
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          
          // If no existing window/tab, open a new one
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Custom notification scheduler
let notificationScheduler = null;

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_NOTIFICATION_SCHEDULER') {
    startNotificationScheduler(event.data.matches);
  } else if (event.data && event.data.type === 'STOP_NOTIFICATION_SCHEDULER') {
    stopNotificationScheduler();
  }
});

function startNotificationScheduler(matches) {
  stopNotificationScheduler(); // Clear existing scheduler
  
  notificationScheduler = setInterval(() => {
    checkAndSendNotifications(matches);
  }, 60000); // Check every minute
}

function stopNotificationScheduler() {
  if (notificationScheduler) {
    clearInterval(notificationScheduler);
    notificationScheduler = null;
  }
}

function checkAndSendNotifications(matches) {
  if (!matches || !Array.isArray(matches)) return;
  
  const now = new Date();
  
  matches.forEach(match => {
    const matchTime = new Date(match.MatchTime);
    const timeDiff = matchTime - now;
    const duration = parseInt(match.MatchDuration) || 360;
    const endTime = new Date(matchTime.getTime() + (duration * 60 * 1000));
    
    // 15 minutes before match
    if (timeDiff > 14 * 60 * 1000 && timeDiff <= 15 * 60 * 1000) {
      sendBackgroundNotification(
        '⏰ Match Starting Soon!',
        `${match.Team1} vs ${match.Team2} starts in 15 minutes`,
        'match-15min-' + match.MatchTime
      );
    }
    
    // 5 minutes before match
    else if (timeDiff > 4 * 60 * 1000 && timeDiff <= 5 * 60 * 1000) {
      sendBackgroundNotification(
        '🚨 Match Starting Very Soon!',
        `${match.Team1} vs ${match.Team2} starts in 5 minutes`,
        'match-5min-' + match.MatchTime
      );
    }
    
    // Match started
    else if (timeDiff > -60 * 1000 && timeDiff <= 0) {
      sendBackgroundNotification(
        '🔴 LIVE NOW!',
        `${match.Team1} vs ${match.Team2} is now LIVE!`,
        'match-live-' + match.MatchTime
      );
    }
    
    // Match ended
    else if (now >= endTime && (now - endTime) <= 60 * 1000) {
      sendBackgroundNotification(
        '🏁 Match Ended',
        `${match.Team1} vs ${match.Team2} has ended`,
        'match-end-' + match.MatchTime
      );
    }
  });
}

function sendBackgroundNotification(title, body, tag) {
  // Check if this notification was already sent
  return caches.open('notification-cache').then(cache => {
    return cache.match(tag).then(response => {
      if (response) return; // Already sent
      
      // Mark as sent
      cache.put(tag, new Response('sent'));
      
      // Send notification
      return self.registration.showNotification(title, {
        body: body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag,
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data: {
          url: '/'
        }
      });
    });
  });
}
