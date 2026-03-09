"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/services/supabase/client";

type SubscribeOptions = {
  table: string;
  onChange: () => void;
  filter?: string;
  schema?: string;
};

const REALTIME_COOLDOWN_KEY = "wevenfinance:realtime:cooldown_until";
const REALTIME_COOLDOWN_MS = 2 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function getCooldownUntil() {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(REALTIME_COOLDOWN_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function setCooldown(ms: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REALTIME_COOLDOWN_KEY, String(ms));
}

export function subscribeToTableChanges(options: SubscribeOptions) {
  if (typeof window !== "undefined" && getCooldownUntil() > nowMs()) {
    return () => {};
  }

  const schema = options.schema || "public";
  const supabase = getSupabaseClient();
  const channelName = `rt:${schema}:${options.table}:${options.filter || "all"}:${crypto.randomUUID()}`;

  let channel: RealtimeChannel | null = null;

  try {
    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema,
          table: options.table,
          ...(options.filter ? { filter: options.filter } : {}),
        },
        () => {
          options.onChange();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setCooldown(nowMs() + REALTIME_COOLDOWN_MS);
        }
      });
  } catch {
    setCooldown(nowMs() + REALTIME_COOLDOWN_MS);
    return () => {};
  }

  return () => {
    if (!channel) return;
    void supabase.removeChannel(channel);
  };
}
