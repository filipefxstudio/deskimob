"use client";

import { registerDeskimobServiceWorker } from "@/lib/notifications/app-badge";

export type PushClientStatus =
  | "unsupported"
  | "denied"
  | "needs_permission"
  | "no_vapid"
  | "subscribed"
  | "error";

export type EnsurePushSubscriptionResult = {
  status: PushClientStatus;
  message?: string;
};

export function isPushConfiguredOnServer(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function persistSubscriptionOnServer(subscription: PushSubscription): Promise<string | null> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return "Assinatura push inválida no navegador.";
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  if (!response.ok) {
    let detail = "Não foi possível registrar o dispositivo para push.";
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      if (body.error) detail = body.error;
      if (body.code && !body.error?.includes(body.code)) {
        detail = `${detail} (${body.code})`;
      }
    } catch {
      /* ignore */
    }
    return detail;
  }

  return null;
}

/**
 * Garante service worker + assinatura Web Push neste dispositivo (celular ou desktop).
 * Deve rodar no PWA instalado, com o usuário responsável logado.
 */
export async function ensurePushSubscription(options?: {
  requestPermission?: boolean;
}): Promise<EnsurePushSubscriptionResult> {
  if (typeof window === "undefined") {
    return { status: "unsupported" };
  }

  if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
    return { status: "unsupported", message: "Este navegador não suporta notificações push." };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidKey) {
    return {
      status: "no_vapid",
      message: "Push não está configurado no servidor (chaves VAPID).",
    };
  }

  let permission = Notification.permission;
  if (permission === "default" && options?.requestPermission) {
    permission = await Notification.requestPermission();
  }

  if (permission === "denied") {
    return {
      status: "denied",
      message: "Permissão de notificação negada. Ative nas configurações do Chrome.",
    };
  }

  if (permission !== "granted") {
    return { status: "needs_permission" };
  }

  const registration = await registerDeskimobServiceWorker();
  if (!registration) {
    return { status: "error", message: "Não foi possível registrar o service worker." };
  }

  try {
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const persistError = await persistSubscriptionOnServer(subscription);
    if (persistError) {
      return { status: "error", message: persistError };
    }

    return { status: "subscribed" };
  } catch (error) {
    console.error("[ensurePushSubscription]", error);
    const message =
      error instanceof Error ? error.message : "Falha ao ativar notificações push neste aparelho.";
    return { status: "error", message };
  }
}
