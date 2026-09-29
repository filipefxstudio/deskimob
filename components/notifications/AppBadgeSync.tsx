"use client";

import { useEffect } from "react";

import { getUnreadNotificacoesCount } from "@/lib/actions/notificacoes";
import { registerDeskimobServiceWorker, syncAppIconBadge } from "@/lib/notifications/app-badge";
import { ensurePushSubscription } from "@/lib/notifications/push-client";

const POLL_MS = 60_000;

/** Mantém badge do ícone do PWA e assinatura push neste dispositivo. */
export function AppBadgeSync() {
  useEffect(() => {
    void (async () => {
      await registerDeskimobServiceWorker();
      await ensurePushSubscription({ requestPermission: false });
    })();

    const refresh = () => {
      void getUnreadNotificacoesCount().then(syncAppIconBadge);
    };

    refresh();
    const interval = window.setInterval(refresh, POLL_MS);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "deskimob-badge" && typeof event.data.count === "number") {
        syncAppIconBadge(event.data.count);
      }
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        void ensurePushSubscription({ requestPermission: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
