/* Shows Arkyc push notifications while the dashboard is in the background. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

firebase.initializeApp(JSON.parse(new URL(self.location).searchParams.get('firebaseConfig')))

firebase.messaging().onBackgroundMessage(({ data }) => {
  const notification = JSON.parse(data.payload)
  if (notification.retracted) return

  self.registration.showNotification(notification.title, {
    body: notification.description,
    icon: '/arkyc-icon.png',
    tag: notification.tag ?? undefined,
    data: { link: notification.actionLink },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data?.link) event.waitUntil(clients.openWindow(event.notification.data.link))
})
