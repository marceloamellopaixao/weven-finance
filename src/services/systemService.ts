import {
  AccessControlConfig,
  AccessPermissionLevel,
  AccessResourceKey,
  DEFAULT_ACCESS_CONTROL_CONFIG,
  DEFAULT_FEATURE_ACCESS_CONFIG,
  DEFAULT_PLANS_CONFIG,
  FeatureAccessConfig,
  PlansConfig,
} from "@/types/system";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

const POLLING_INTERVAL_MS = 60000;
const LOCAL_CACHE_TTL_MS = 120000;
let lastPlansCache: { at: number; value: PlansConfig } | null = null;
let lastAccessControlCache: { at: number; value: AccessControlConfig } | null = null;
let lastMyAccessControlCache: {
  at: number;
  value: {
    access: Partial<Record<AccessResourceKey, AccessPermissionLevel>>;
    featureAccess: FeatureAccessConfig;
  };
} | null = null;

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
}

export const getPlansConfig = async (): Promise<PlansConfig> => {
  if (lastPlansCache && Date.now() - lastPlansCache.at < LOCAL_CACHE_TTL_MS) {
    return lastPlansCache.value;
  }

  try {
    const response = await fetch("/api/system/plans", { method: "GET" });
    const payload = (await response.json()) as { ok: boolean; error?: string; plans?: PlansConfig };
    if (!response.ok || !payload.ok || !payload.plans) {
      throw new Error(payload.error || "Não foi possível buscar planos");
    }
    lastPlansCache = { at: Date.now(), value: payload.plans };
    return payload.plans;
  } catch {
    return DEFAULT_PLANS_CONFIG;
  }
};

export const updatePlansConfig = async (config: PlansConfig) => {
  const idToken = await getIdTokenOrThrow();
  const response = await fetch("/api/system/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ plans: config }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar planos");
  }
};

export const getAccessControlConfig = async (): Promise<AccessControlConfig> => {
  if (lastAccessControlCache && Date.now() - lastAccessControlCache.at < LOCAL_CACHE_TTL_MS) {
    return lastAccessControlCache.value;
  }

  try {
    const idToken = await getIdTokenOrThrow();
    const response = await fetch("/api/system/access-control", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      accessControl?: AccessControlConfig;
    };
    if (!response.ok || !payload.ok || !payload.accessControl) {
      throw new Error(payload.error || "Não foi possível buscar permissões");
    }
    lastAccessControlCache = { at: Date.now(), value: payload.accessControl };
    return payload.accessControl;
  } catch {
    return DEFAULT_ACCESS_CONTROL_CONFIG;
  }
};

export const updateAccessControlConfig = async (config: AccessControlConfig) => {
  const idToken = await getIdTokenOrThrow();
  const response = await fetch("/api/system/access-control", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ accessControl: config }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar permissões");
  }
  lastAccessControlCache = { at: Date.now(), value: config };
  lastMyAccessControlCache = null;
};

export const getMyAccessControl = async (): Promise<{
  access: Partial<Record<AccessResourceKey, AccessPermissionLevel>>;
  featureAccess: FeatureAccessConfig;
}> => {
  if (lastMyAccessControlCache && Date.now() - lastMyAccessControlCache.at < LOCAL_CACHE_TTL_MS) {
    return lastMyAccessControlCache.value;
  }

  try {
    const idToken = await getIdTokenOrThrow();
    const response = await fetch("/api/system/access-control/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      access?: Partial<Record<AccessResourceKey, AccessPermissionLevel>>;
      featureAccess?: FeatureAccessConfig;
    };
    if (!response.ok || !payload.ok || !payload.featureAccess) {
      throw new Error(payload.error || "Não foi possível buscar permissões do usuário");
    }
    const value = { access: payload.access ?? {}, featureAccess: payload.featureAccess };
    lastMyAccessControlCache = { at: Date.now(), value };
    return value;
  } catch {
    return { access: {}, featureAccess: DEFAULT_FEATURE_ACCESS_CONFIG };
  }
};

export const subscribeToPlansConfig = (
  onChange: (data: PlansConfig) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const data = await getPlansConfig();
      if (!cancelled) onChange(data);
    } catch (error) {
      if (!cancelled) {
        onError?.(error as Error);
      }
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "system_configs",
    onChange: () => void run(),
  });
  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
  };
};
