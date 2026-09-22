"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUnreadNotificacoesCount,
  listNotificacoes,
  markAllNotificacoesLidas,
  markNotificacaoLida,
} from "@/lib/actions/notificacoes";
import { registerDeskimobServiceWorker, syncAppIconBadge } from "@/lib/notifications/app-badge";
import type { NotificacaoRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificacaoRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushState, setPushState] = useState<"idle" | "loading" | "enabled" | "denied" | "unsupported">(
    "idle",
  );

  const refreshCount = useCallback(async () => {
    const count = await getUnreadNotificacoesCount();
    setUnread(count);
    syncAppIconBadge(count);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listNotificacoes({ syncDerived: true });
      setItems(rows);
      const naoLidas = rows.filter((r) => !r.lida_em).length;
      setUnread(naoLidas);
      syncAppIconBadge(naoLidas);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const interval = window.setInterval(() => {
      void refreshCount();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (open) {
      void loadList();
    }
  }, [open, loadList]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setPushState("enabled");
      void registerDeskimobServiceWorker();
    } else if (Notification.permission === "denied") {
      setPushState("denied");
    }
  }, []);

  async function handleEnablePush() {
    if (!("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    setPushState("loading");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushState(permission === "denied" ? "denied" : "idle");
      return;
    }

    const registration = await registerDeskimobServiceWorker();
    if (!registration) {
      setPushState("idle");
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidKey || !("PushManager" in window)) {
      setPushState("enabled");
      return;
    }

    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      setPushState("enabled");
    } catch (error) {
      console.error("[NotificationBell] push subscribe", error);
      setPushState("enabled");
    }
  }

  async function handleItemClick(item: NotificacaoRow) {
    if (!item.lida_em) {
      await markNotificacaoLida(item.id);
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, lida_em: new Date().toISOString() } : row,
        ),
      );
      setUnread((c) => Math.max(0, c - 1));
      syncAppIconBadge(Math.max(0, unread - 1));
    }
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificacoesLidas();
    setItems((prev) => prev.map((row) => ({ ...row, lida_em: row.lida_em ?? new Date().toISOString() })));
    setUnread(0);
    syncAppIconBadge(0);
  }

  const showPushCta =
    pushState !== "enabled" && pushState !== "denied" && pushState !== "unsupported";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notificações" className="relative shrink-0">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span
              className={cn(
                "pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none !text-white",
              )}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notificações</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => void handleMarkAllRead()}
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>

        {showPushCta ? (
          <div className="border-b bg-muted/40 px-3 py-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void handleEnablePush()}
              disabled={pushState === "loading"}
            >
              {pushState === "loading" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <BellRing className="size-3.5 shrink-0 text-primary" />
              )}
              <span>Ativar alertas no celular (push)</span>
            </button>
          </div>
        ) : null}

        <div className="max-h-[min(60vh,320px)] overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando…
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : null}

          {items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={cn(
                "cursor-pointer flex-col items-start gap-0.5 rounded-none border-b px-3 py-2.5 last:border-b-0",
                !item.lida_em && "bg-primary/5",
              )}
              onSelect={(e) => {
                e.preventDefault();
                void handleItemClick(item);
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className={cn("text-sm", !item.lida_em && "font-medium")}>{item.titulo}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatRelativeTime(item.criado_em)}
                </span>
              </div>
              {item.mensagem ? (
                <span className="text-xs text-muted-foreground line-clamp-2">{item.mensagem}</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center text-xs text-muted-foreground">
          <Link href="/dashboard">Ver dashboard</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
