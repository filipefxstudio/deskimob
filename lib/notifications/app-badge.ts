/** Atualiza o contador no ícone do PWA na tela inicial (Badging API — Chrome/Android). */
export function syncAppIconBadge(count: number): void {
  if (typeof navigator === "undefined") {
    return;
  }

  const capped = Math.min(Math.max(0, count), 99);

  const apply = (target: Navigator | ServiceWorkerRegistration) => {
    const badge = target as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!("setAppBadge" in badge)) return false;
    if (capped > 0) {
      void badge.setAppBadge?.(capped);
    } else {
      void badge.clearAppBadge?.();
    }
    return true;
  };

  if (apply(navigator)) {
    return;
  }

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready.then((registration) => {
      apply(registration as unknown as Navigator);
    });
  }
}

export async function registerDeskimobServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    void registration.update();
    return registration;
  } catch (error) {
    console.error("[app-badge] service worker", error);
    return null;
  }
}
