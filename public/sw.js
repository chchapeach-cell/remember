self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || '/icon.png',
        badge: data.icon || '/icon.png',
        vibrate: [200, 100, 200, 100, 200],
        sound: '/notification.wav',
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '2'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Notification', options)
      );
    } catch (e) {
      console.error('Error parsing push data', e);
      event.waitUntil(
        self.registration.showNotification('New Notification', { body: event.data.text() })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
