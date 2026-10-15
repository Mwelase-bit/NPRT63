// src/utils/pushClient.js - turns browser push notifications on and off.
//
// Flow: ask the student's permission (only ever from a button tap) -> register the service
// worker (/sw.js) -> subscribe with the server's public key -> send the subscription to the
// server. Every step that can fail throws an Error with a message a student can act on.
// Exposes window.PushClient.
(function () {
    // The subscription key arrives as URL-safe base64; the browser wants raw bytes
    function keyToBytes(base64) {
        const pad = '='.repeat((4 - (base64.length % 4)) % 4);
        const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from(raw, (c) => c.charCodeAt(0));
    }

    const supported = () =>
        typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    async function currentSubscription() {
        const reg = await navigator.serviceWorker.getRegistration('/');
        return reg ? reg.pushManager.getSubscription() : null;
    }

    /**
     * 'unsupported' - this browser cannot do push (or the page is not on HTTPS / localhost)
     * 'unavailable' - the server has no push keys configured
     * 'blocked'     - the student said no in the browser
     * 'off'         - allowed or not yet asked, but this device is not subscribed
     * 'on'          - this device will receive push
     */
    async function status() {
        if (!supported() || !window.isSecureContext) return 'unsupported';
        if (Notification.permission === 'denied') return 'blocked';
        try {
            const info = await window.api.notifications.pushKey();
            if (!info.enabled) return 'unavailable';
            return (await currentSubscription()) ? 'on' : 'off';
        } catch (err) {
            return 'off';                  // offline or the server is waking up: do not claim it is unavailable
        }
    }

    async function enable() {
        if (!supported() || !window.isSecureContext) {
            throw new Error('This browser or connection cannot receive push notifications. Open BUILDHAUS over HTTPS (or on localhost) in a current browser.');
        }
        const info = await window.api.notifications.pushKey();
        if (!info.enabled || !info.publicKey) throw new Error('Push notifications are not set up on the server yet.');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Notifications are blocked. Allow them for this site in your browser settings, then try again.');
        }
        let reg;
        try {
            reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;
        } catch (err) {
            throw new Error('Could not start the notification service. Please reload the page and try again.');
        }
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            try {
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(info.publicKey) });
            } catch (err) {
                throw new Error('Your browser refused the push subscription. Check that notifications are allowed for this site.');
            }
        }
        await window.api.notifications.subscribe(sub.toJSON());
        return true;
    }

    async function disable() {
        const sub = await currentSubscription();
        if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe().catch(() => { });
            await window.api.notifications.unsubscribe(endpoint).catch(() => { });
        }
        return true;
    }

    // After sign-in on a device that already allowed notifications: make sure the server has this
    // device's subscription (it may belong to a different account, or have expired). Never prompts.
    async function sync() {
        try {
            if (!supported() || !window.isSecureContext || Notification.permission !== 'granted') return;
            const info = await window.api.notifications.pushKey();
            if (!info.enabled) return;
            const sub = await currentSubscription();
            if (sub) await window.api.notifications.subscribe(sub.toJSON());
        } catch (err) {
            console.warn('Push sync skipped:', err && err.message ? err.message : err);
        }
    }

    window.PushClient = { supported, status, enable, disable, sync };
})();
