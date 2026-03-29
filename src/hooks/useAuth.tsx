"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserProfile } from "@/types/user";
import {
  getImpersonationHeader,
  getImpersonationTargetUid,
  subscribeToImpersonationChange,
} from "@/lib/impersonation/client";
import { getSupabaseClient } from "@/services/supabase/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";

const BLOCKED_STATUSES = new Set(["inactive", "blocked"]);
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/not-found", "/blocked", "/goodbye"];

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  reload: () => Promise<AuthUser>;
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (
    name: string,
    completeName: string,
    email: string,
    pass: string,
    phone: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function mapSupabaseUserToAuthUser(input: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string | null;
}) {
  const supabase = getSupabaseClient();
  const meta = input.user_metadata || {};
  const displayName =
    (typeof meta.displayName === "string" && meta.displayName.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof input.email === "string" ? input.email.split("@")[0] : "Usuário");
  const uid =
    typeof meta.firebaseUid === "string" && meta.firebaseUid.trim()
      ? meta.firebaseUid
      : input.id;

  const build = (): AuthUser => ({
    uid,
    email: String(input.email || ""),
    displayName: String(displayName),
    photoURL: typeof meta.avatar_url === "string" ? meta.avatar_url : undefined,
    emailVerified: Boolean(input.email_confirmed_at),
    getIdToken: async (forceRefresh?: boolean) => {
      if (forceRefresh) {
        await supabase.auth.refreshSession();
      }
      const token = await getAccessTokenOrThrow();
      return token;
    },
    reload: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("missing_auth_user");
      return mapSupabaseUserToAuthUser(data.user);
    },
  });

  return build();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [impersonationTargetUid, setImpersonationTargetUid] = useState<string | null>(() =>
    getImpersonationTargetUid()
  );

  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const DISPOSABLE_DOMAINS = [
    "teste.com",
    "test.com",
    "example.com",
    "mail.com",
    "1.com",
    "tempmail.com",
    "yopmail.com",
    "mailinator.com",
    "10minutemail.com",
    "guerrillamail.com",
    "sharklasers.com",
    "dispostable.com",
    "getnada.com",
    "temp-mail.org",
  ];

  const isValidRealEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailLower)) return false;
    const [prefix, domain] = emailLower.split("@");
    if (prefix.length < 3 || /^(.)\1+$/.test(prefix)) return false;
    if (DISPOSABLE_DOMAINS.includes(domain)) return false;
    return true;
  };

  const apiFetchWithToken = async (path: string, init?: RequestInit) => {
    const token = await getAccessTokenOrThrow();
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...getImpersonationHeader(),
        ...(init?.headers || {}),
      },
    });
  };

  useEffect(() => {
    const storedPrivacy = localStorage.getItem("weven_privacy_mode");
    if (storedPrivacy === "true") setPrivacyMode(true);
  }, []);

  useEffect(() => {
    return subscribeToImpersonationChange((nextTargetUid) => {
      setImpersonationTargetUid(nextTargetUid);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setUser(mapSupabaseUserToAuthUser(data.session.user));
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapSupabaseUserToAuthUser(session.user));
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    let cancelled = false;

    const syncProfile = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const response = await apiFetchWithToken("/api/profile/me", { method: "GET" });
        const payload = (await response.json()) as { ok: boolean; error?: string; profile?: UserProfile | null };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar perfil");
        if (!cancelled) setUserProfile(payload.profile ?? null);
      } catch (error) {
        console.error("Erro na busca do perfil:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void syncProfile();
    const interval = setInterval(() => void syncProfile(), 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, impersonationTargetUid]);

  useEffect(() => {
    if (loading) return;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!user) {
      if (!isPublicRoute) router.replace("/login");
      return;
    }

    if (!userProfile) return;

    if (userProfile.status === "deleted") {
      if (pathname !== "/goodbye") router.replace("/goodbye");
      void supabase.auth.signOut();
      return;
    }

    if (BLOCKED_STATUSES.has(userProfile.status)) {
      if (pathname !== "/blocked") router.replace("/blocked");
      return;
    }

    if (!userProfile.verifiedEmail) {
      if (pathname !== "/verify-email") router.replace("/verify-email");
      return;
    }

    if (pathname === "/verify-email") {
      router.replace("/dashboard");
      return;
    }

    if (["/login", "/register", "/goodbye", "/blocked"].includes(pathname)) {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/admin")) {
      if (userProfile.role !== "admin" && userProfile.role !== "moderator" && userProfile.role !== "support") {
        router.replace("/dashboard");
      }
    }
  }, [loading, pathname, router, supabase.auth, user, userProfile]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem("weven_privacy_mode", String(next));
      return next;
    });
  };

  const registerWithEmail = async (
    name: string,
    completeName: string,
    email: string,
    pass: string,
    phone: string
  ) => {
    if (!isValidRealEmail(email)) throw "Por favor, utilize um e-mail valido para cadastro.";

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { displayName: name, completeName, phone },
      },
    });
    if (error) throw error.message || "Erro ao registrar usuario.";

    const token = data.session?.access_token;
    if (token) {
      const bootstrapProfile: Partial<UserProfile> = {
        uid: data.user?.id || "",
        email,
        displayName: name,
        completeName,
        phone,
        role: "client",
        plan: "free",
        status: "active",
        createdAt: new Date().toISOString(),
        paymentStatus: "pending",
        billing: {
          source: "system",
          lastSyncAt: new Date().toISOString(),
        },
        transactionCount: 0,
        verifiedEmail: false,
      };
      await fetch("/api/profile/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profile: bootstrapProfile }),
      });
    }

    router.push("/verify-email");
  };

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error.message || "Erro ao entrar com Google.";
    if (data.url) window.location.assign(data.url);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error.message || "Erro ao entrar.";
    router.replace("/dashboard");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        privacyMode,
        togglePrivacyMode,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

