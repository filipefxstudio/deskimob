/* Deskimob — service worker (Web Push + badge no ícone do app) */

function applyAppIconBadge(count) {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
    return Promise.resolve();
  }
  const capped = Math.min(Math.max(0, Number(count) || 0), 99);
  if (capped > 0) {
    return navigator.setAppBadge(capped);
  }
  return navigator.clearAppBadge();
}

function notifyClientsBadge(count) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      client.postMessage({ type: "deskimob-badge", count });
    }
  });
}

self.addEventListener("push", (event) => {
  let payload = { title: "Deskimob", body: "", url: "/dashboard", badgeCount: undefined };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }

  const badgeCount =
    typeof payload.badgeCount === "number" && !Number.isNaN(payload.badgeCount)
      ? payload.badgeCount
      : undefined;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/deskimob-favicon.png",
        badge: "/deskimob-favicon.png",
        data: { url: payload.url },
        tag: "deskimob-notification",
      }),
      badgeCount !== undefined ? applyAppIconBadge(badgeCount) : Promise.resolve(),
      badgeCount !== undefined ? notifyClientsBadge(badgeCount) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  const target = url.startsWith("http") ? url : new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    }),
  );
});
