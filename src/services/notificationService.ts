"use client";

import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

export type AppNotification = {
  id: string;
  uid: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  isRead: boolean;
  createdAt: string | null;
};

const POLLING_INTERVAL_MS = 15000;

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAccessTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function fetchNotifications() {
  const response = await apiFetch("/api/notifications?page=1&limit=20", { method: "GET" });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    items?: AppNotification[];
    unreadCount?: number;
    total?: number;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "erro_carregar_notificacoes");
  }
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    unreadCount: Number(payload.unreadCount || 0),
  };
}

export async function markNotificationAsRead(id: string) {
  if (!id.trim()) return;
  const response = await apiFetch("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ id }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "erro_marcar_notificacao");
  }
}

export async function markAllNotificationsAsRead() {
  const response = await apiFetch("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ markAllRead: true }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "erro_marcar_todas_notificacoes");
  }
}

export async function clearAllNotifications() {
  const response = await apiFetch("/api/notifications", {
    method: "DELETE",
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "erro_limpar_notificacoes");
  }
}

export function subscribeToNotifications(
  uid: string,
  onChange: (data: { items: AppNotification[]; unreadCount: number }) => void,
  onError?: (error: Error) => void
) {
  let cancelled = false;

  const run = async () => {
    try {
      const data = await fetchNotifications();
      if (!cancelled) onChange(data);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "notifications",
    filter: `uid=eq.${uid}`,
    onChange: () => void run(),
  });
  const onFocus = () => void run();
  window.addEventListener("focus", onFocus);

  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
    window.removeEventListener("focus", onFocus);
  };
}
