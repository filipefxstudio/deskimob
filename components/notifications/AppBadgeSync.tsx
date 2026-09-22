"use client";

import { useEffect } from "react";

import { getUnreadNotificacoesCount } from "@/lib/actions/notificacoes";
import { registerDeskimobServiceWorker, syncAppIconBadge } from "@/lib/notifications/app-badge";

const POLL_MS = 60_000;

/** Mantém o badge do ícone do app (tela inicial) alinhado às notificações não lidas. */
export function AppBadgeSync() {
  useEffect(() => {
    void registerDeskimobServiceWorker();

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
