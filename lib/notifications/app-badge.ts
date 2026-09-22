/** Atualiza o contador no ícone do PWA na tela inicial (Badging API — Chrome/Android). */
export function syncAppIconBadge(count: number): void {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
    return;
  }
  const nav = navigator as Navigator & {
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const capped = Math.min(Math.max(0, count), 99);
  if (capped > 0) {
    void nav.setAppBadge?.(capped);
  } else {
    void nav.clearAppBadge?.();
  }
}

export async function registerDeskimobServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.error("[app-badge] service worker", error);
    return null;
  }
}
