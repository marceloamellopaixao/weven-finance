import { getAuth } from "firebase/auth";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";

const POLLING_INTERVAL_MS = 300000;
const LOCAL_CACHE_TTL_MS = 120000;
let lastPlansCache: { at: number; value: PlansConfig } | null = null;

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

async function getIdTokenOrThrow() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("missing_auth_user");
  return currentUser.getIdToken();
}

export const getPlansConfig = async (): Promise<PlansConfig> => {
  if (lastPlansCache && Date.now() - lastPlansCache.at < LOCAL_CACHE_TTL_MS) {
    return lastPlansCache.value;
  }

  try {
    const response = await fetch("/api/system/plans", { method: "GET" });
    const payload = (await response.json()) as { ok: boolean; error?: string; plans?: PlansConfig };
    if (!response.ok || !payload.ok || !payload.plans) {
      throw new Error(payload.error || "Nao foi possivel buscar planos");
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
    throw new Error(payload.error || "Nao foi possivel atualizar planos");
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
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};
