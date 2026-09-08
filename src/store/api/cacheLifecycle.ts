"use client";

import { subscribeToTableChanges } from "@/services/supabase/realtime";

type RealtimeSource = {
  table: string;
  filter?: string;
};

export async function keepQueryFreshFromRealtime(input: {
  cacheDataLoaded: Promise<unknown>;
  cacheEntryRemoved: Promise<unknown>;
  sources: RealtimeSource[];
  browserEvents?: string[];
  onChange: () => void;
}) {
  try {
    await input.cacheDataLoaded;
  } catch {
    return;
  }

  const unsubscribers = input.sources.map((source) =>
    subscribeToTableChanges({ ...source, onChange: input.onChange }),
  );
  const browserEvents = input.browserEvents ?? [];
  browserEvents.forEach((eventName) => window.addEventListener(eventName, input.onChange));

  try {
    await input.cacheEntryRemoved;
  } finally {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    browserEvents.forEach((eventName) => window.removeEventListener(eventName, input.onChange));
  }
}
