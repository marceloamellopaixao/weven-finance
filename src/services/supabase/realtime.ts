"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/services/supabase/client";

type SubscribeOptions = {
  table: string;
  onChange: () => void;
  filter?: string;
  schema?: string;
};

export function subscribeToTableChanges(options: SubscribeOptions) {
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
      .subscribe();
  } catch {
    return () => {};
  }

  return () => {
    if (!channel) return;
    void supabase.removeChannel(channel);
  };
}

