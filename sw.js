// sw.js - BUILDHAUS service worker. Its only job is Web Push:
//   * a push arrives while no BUILDHAUS window is on screen  -> show an OS notification
//   * a push arrives while the app is open and visible        -> pass it to the page, which
//     shows a quiet in-app toast instead of a second popup
//   * the student taps a notification                         -> focus the app and open the right screen
// It does not cache anything, so it can never serve stale app files.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    // The payload is JSON from the server; fall back to plain text so a malformed push still shows something
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (err) {
        data = { title: 'BUILDHAUS', body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'BUILDHAUS';

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.some((c) => c.visibilityState === 'visible')) {
            windows.forEach((c) => c.postMessage({ type: 'buildhaus-push', payload: data }));
            return;
        }
        await self.registration.showNotification(title, {
            body: data.body || '',
            icon: '/vendor/icon.svg',
            badge: '/vendor/icon.svg',
            tag: data.tag || 'buildhaus',          // same-kind notices replace each other instead of piling up
            data: { link: data.link || '' }
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = (event.notification.data && event.notification.data.link) || '';
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const open = windows.find((c) => 'focus' in c);
        if (open) {
            await open.focus();
            open.postMessage({ type: 'buildhaus-open', link });
            return;
        }
        // The app is closed: start it and tell it where to go (read by App.jsx from ?open=)
        await self.clients.openWindow('/?open=' + encodeURIComponent(link));
    })());
});
