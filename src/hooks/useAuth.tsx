"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserProfile } from "@/types/user";
import {
  getImpersonationHeader,
  getImpersonationTargetUid,
  subscribeToImpersonationChange,
} from "@/lib/impersonation/client";
import { isAuthErrorMessage } from "@/lib/api/error";
import { extractAuthProviders, hasEmailPasswordProvider, shouldRequirePasswordSetup } from "@/lib/auth/providers";
import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";
import { getSupabaseClient } from "@/services/supabase/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { buildBrowserRedirectUrl, clearPostAuthRedirect, readPostAuthRedirect, rememberPostAuthRedirect } from "@/services/auth/postAuthRedirect";
import { buildEmailVerificationRedirectUrl, rememberPendingVerificationEmail } from "@/services/auth/emailVerification";
import { buildUpgradeCheckoutPath, readPendingUpgradePlan } from "@/services/billing/checkoutIntent";
import { canAccessAdminArea, isCreatorSupremeUid } from "@/lib/access-control/roles";
import { canAccessLevel } from "@/lib/access-control/config";
import { getMyAccessControl } from "@/services/systemService";
import { useGetWorkspacesQuery } from "@/store/api/workspacesApi";
import { AppBootLoading } from "@/components/loading/AppBootLoading";

const BLOCKED_STATUSES = new Set(["inactive", "blocked"]);
const PROFILE_BACKGROUND_REFRESH_MS = 5 * 60 * 1000;
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/first-access",
  "/verify-email",
  "/billing/checkout",
  "/billing/activating",
  "/not-found",
  "/blocked",
  "/goodbye",
  "/contact",
  "/security",
  "/terms",
  "/privacy",
  "/quanto-posso-gastar-hoje",
  "/calculadora/quanto-posso-gastar-hoje",
  "/controle-financeiro",
  "/organizar-cartao-de-credito",
  "/app-para-sair-das-dividas",
];

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  providers: string[];
  hasPasswordProvider: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  reload: () => Promise<AuthUser>;
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  privacyMode: boolean;
  canPreviewRestrictedPages: boolean;
  togglePrivacyMode: () => void;
  refreshProfile: () => Promise<void>;
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
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string | null }> | null;
  email_confirmed_at?: string | null;
}) {
  const supabase = getSupabaseClient();
  const meta = input.user_metadata || {};
  const providers = extractAuthProviders({
    app_metadata: input.app_metadata,
    identities: input.identities,
  });
  const displayName =
    (typeof meta.displayName === "string" && meta.displayName.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof input.email === "string" ? input.email.split("@")[0] : "Usuário");
  const uid = resolveUserUidFromMetadata(meta, input.id);

  const build = (): AuthUser => ({
    uid,
    email: String(input.email || ""),
    displayName: String(displayName),
    photoURL: typeof meta.avatar_url === "string" ? meta.avatar_url : undefined,
    emailVerified: Boolean(input.email_confirmed_at),
    providers,
    hasPasswordProvider: hasEmailPasswordProvider(providers),
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
  const [pagePreviewAccess, setPagePreviewAccess] = useState(false);
  const [pagePreviewAccessUid, setPagePreviewAccessUid] = useState<string | null>(null);
  const [impersonationTargetUid, setImpersonationTargetUid] = useState<string | null>(() =>
    getImpersonationTargetUid()
  );
  const authUserFingerprintRef = useRef<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const resolvePostAuthPath = useCallback(() => {
    const pendingUpgradePlan = readPendingUpgradePlan();
    return pendingUpgradePlan ? buildUpgradeCheckoutPath(pendingUpgradePlan) : "/dashboard";
  }, []);

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

  const refreshProfile = async () => {
    if (!user) return;
    const response = await apiFetchWithToken("/api/profile/me", { method: "GET" });
    const payload = (await response.json()) as { ok: boolean; error?: string; profile?: UserProfile | null };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Erro ao atualizar perfil");
    }
    setUserProfile(payload.profile ?? null);
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
    const applySessionUser = (sessionUser: Parameters<typeof mapSupabaseUserToAuthUser>[0] | null) => {
      if (!mounted) return;
      if (!sessionUser) {
        authUserFingerprintRef.current = null;
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const mappedUser = mapSupabaseUserToAuthUser(sessionUser);
      const fingerprint = JSON.stringify({
        uid: mappedUser.uid,
        email: mappedUser.email,
        displayName: mappedUser.displayName,
        photoURL: mappedUser.photoURL || "",
        emailVerified: mappedUser.emailVerified,
        providers: mappedUser.providers,
        hasPasswordProvider: mappedUser.hasPasswordProvider,
      });
      if (authUserFingerprintRef.current === fingerprint) return;
      authUserFingerprintRef.current = fingerprint;
      setLoading(true);
      setUser(mappedUser);
    };

    supabase.auth.getSession().then(({ data }) => {
      applySessionUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySessionUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user || !userProfile) {
      setPagePreviewAccess(false);
      setPagePreviewAccessUid(null);
      return;
    }

    if (isCreatorSupremeUid(userProfile.uid)) {
      setPagePreviewAccess(true);
      setPagePreviewAccessUid(userProfile.uid);
      return;
    }

    if (userProfile.role === "client") {
      setPagePreviewAccess(false);
      setPagePreviewAccessUid(userProfile.uid);
      return;
    }

    let cancelled = false;
    getMyAccessControl()
      .then((data) => {
        if (cancelled) return;
        setPagePreviewAccess(canAccessLevel(data.access["admin.pages.preview"] ?? "none", "read"));
        setPagePreviewAccessUid(userProfile.uid);
      })
      .catch(() => {
        if (!cancelled) {
          setPagePreviewAccess(false);
          setPagePreviewAccessUid(userProfile.uid);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, userProfile]);

  const authReady = !loading && (!user || !userProfile || pagePreviewAccessUid === userProfile.uid);
  const isWorkspaceGuardRoute = pathname === "/account-profile" || !PUBLIC_ROUTES.includes(pathname);
  const shouldPrefetchWorkspaces = Boolean(
    user &&
    !pathname.startsWith("/billing") &&
    isWorkspaceGuardRoute
  );
  const canApplyWorkspaceGuard = Boolean(
    authReady &&
    user &&
    userProfile &&
    !pagePreviewAccess &&
    userProfile.status !== "deleted" &&
    !BLOCKED_STATUSES.has(userProfile.status) &&
    !userProfile.needsPasswordSetup &&
    userProfile.verifiedEmail &&
    !pathname.startsWith("/billing") &&
    isWorkspaceGuardRoute
  );
  const workspaceGuardUserId = userProfile?.uid || user?.uid || "";
  const { data: guardedWorkspaces = [], isLoading: isLoadingWorkspaceGuard } = useGetWorkspacesQuery(
    { userId: workspaceGuardUserId },
    { skip: !shouldPrefetchWorkspaces || !workspaceGuardUserId },
  );
  const isCreatingAdditionalWorkspace =
    pathname === "/account-profile" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("create") === "1";
  const activeGuardedWorkspace = guardedWorkspaces.find((workspace) => workspace.status !== "archived") || null;
  const workspaceRedirectPending = Boolean(
    canApplyWorkspaceGuard &&
    !isLoadingWorkspaceGuard &&
    ((!activeGuardedWorkspace && pathname !== "/account-profile") ||
      (activeGuardedWorkspace && pathname === "/account-profile" && !isCreatingAdditionalWorkspace))
  );
  const applicationReady = Boolean(
    authReady &&
    (!canApplyWorkspaceGuard || (!isLoadingWorkspaceGuard && !workspaceRedirectPending))
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const syncProfile = async (showLoadingState: boolean) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (showLoadingState) setLoading(true);
      try {
        const token = await getAccessTokenOrThrow();
        const bootstrapProfile: Partial<UserProfile> = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0] || "Usuário",
          completeName: user.displayName || user.email.split("@")[0] || "",
          phone: "",
          photoURL: user.photoURL || "",
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
          verifiedEmail: user.emailVerified,
          authProviders: user.providers,
          needsPasswordSetup: shouldRequirePasswordSetup(user.providers),
        };

        const fetchProfile = async () => {
          const response = await apiFetchWithToken("/api/profile/me", { method: "GET" });
          const payload = (await response.json()) as { ok: boolean; error?: string; profile?: UserProfile | null };
          if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar perfil");
          return payload.profile ?? null;
        };

        let profile = await fetchProfile();
        const mergedProviders = Array.from(
          new Set([...(profile?.authProviders || []), ...(bootstrapProfile.authProviders || [])])
        ).sort((a, b) => a.localeCompare(b));
        const effectiveNeedsPasswordSetup = profile
          ? Boolean(profile.needsPasswordSetup) && shouldRequirePasswordSetup(mergedProviders)
          : shouldRequirePasswordSetup(mergedProviders);

        const shouldSyncBootstrap =
          !profile ||
          (profile.email || "") !== bootstrapProfile.email ||
          (Boolean(user.emailVerified) && !Boolean(profile.verifiedEmail)) ||
          JSON.stringify(profile.authProviders || []) !== JSON.stringify(mergedProviders) ||
          Boolean(profile?.needsPasswordSetup) !== effectiveNeedsPasswordSetup ||
          ((profile.photoURL || "") !== (bootstrapProfile.photoURL || "") && Boolean(bootstrapProfile.photoURL));

        if (shouldSyncBootstrap) {
          const syncPayload: Partial<UserProfile> = !profile
            ? bootstrapProfile
            : {
                email: bootstrapProfile.email,
                photoURL: bootstrapProfile.photoURL || profile.photoURL || "",
                verifiedEmail: profile.verifiedEmail || bootstrapProfile.verifiedEmail,
                authProviders: mergedProviders,
                needsPasswordSetup: effectiveNeedsPasswordSetup,
              };

          await fetch("/api/profile/bootstrap", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ profile: syncPayload }),
          });
          profile = await fetchProfile();
        }

        if (!cancelled) setUserProfile(profile ?? null);
      } catch (error) {
        console.error("Erro na busca do perfil:", error);
        const message = error instanceof Error ? error.message : "unknown_error";
        if (isAuthErrorMessage(message) || message === "missing_auth_user") {
          await supabase.auth.signOut();
          if (!cancelled) {
            setUser(null);
            setUserProfile(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void syncProfile(true);
    const interval = setInterval(() => void syncProfile(false), PROFILE_BACKGROUND_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [impersonationTargetUid, supabase, user]);

  useEffect(() => {
    if (!authReady) return;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!user) {
      if (!isPublicRoute) router.replace("/login");
      return;
    }

    if (!userProfile) return;
    const hasPrivilegedAccess = pagePreviewAccess;

    if (userProfile.status === "deleted" && !hasPrivilegedAccess) {
      if (pathname !== "/goodbye") router.replace("/goodbye");
      return;
    }

    if (BLOCKED_STATUSES.has(userProfile.status) && !hasPrivilegedAccess) {
      if (pathname !== "/blocked") router.replace("/blocked");
      return;
    }

    if (userProfile.needsPasswordSetup && !hasPrivilegedAccess) {
      if (pathname !== "/first-access") router.replace("/first-access?intent=first-access");
      return;
    }

    if (!userProfile.verifiedEmail && !hasPrivilegedAccess) {
      if (pathname !== "/verify-email" && pathname !== "/first-access") router.replace("/verify-email");
      return;
    }

    if (pathname === "/verify-email" && !hasPrivilegedAccess) {
      router.replace(resolvePostAuthPath());
      return;
    }

    const postAuthRedirect = readPostAuthRedirect();
    if (postAuthRedirect && !hasPrivilegedAccess) {
      const postAuthPathname = postAuthRedirect.split("?")[0] || postAuthRedirect;
      clearPostAuthRedirect();
      if (pathname !== postAuthPathname) {
        router.replace(postAuthRedirect);
        return;
      }
    }

    if (["/login", "/register", "/goodbye", "/blocked"].includes(pathname) && !hasPrivilegedAccess) {
      router.replace(resolvePostAuthPath());
      return;
    }

    if (pathname.startsWith("/admin")) {
      if (!canAccessAdminArea(userProfile)) {
        router.replace("/dashboard");
      }
    }
  }, [authReady, pagePreviewAccess, pathname, resolvePostAuthPath, router, supabase.auth, user, userProfile]);

  useEffect(() => {
    if (!canApplyWorkspaceGuard || isLoadingWorkspaceGuard) return;
    if (!activeGuardedWorkspace && pathname !== "/account-profile") {
      router.replace("/account-profile");
      return;
    }
    if (activeGuardedWorkspace && pathname === "/account-profile" && !isCreatingAdditionalWorkspace) {
      router.replace(resolvePostAuthPath());
    }
  }, [activeGuardedWorkspace, canApplyWorkspaceGuard, isCreatingAdditionalWorkspace, isLoadingWorkspaceGuard, pathname, resolvePostAuthPath, router]);

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
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidRealEmail(normalizedEmail)) throw "Por favor, utilize um e-mail válido para cadastro.";

    if (phone) {
      const phoneCheckResponse = await fetch("/api/auth/phone-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const phoneCheckPayload = (await phoneCheckResponse.json()) as { ok?: boolean; error?: string };
      if (!phoneCheckResponse.ok || !phoneCheckPayload.ok) {
        if (phoneCheckPayload.error === "phone_already_in_use") throw "Este número já está vinculado a outra conta.";
        throw "Não foi possível validar seu número agora.";
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        emailRedirectTo: buildEmailVerificationRedirectUrl(),
        data: { displayName: name, completeName, phone },
      },
    });
    if (error) throw error.message || "Erro ao registrar usuário.";
    rememberPendingVerificationEmail(normalizedEmail);

    const token = data.session?.access_token;
    if (token) {
      const bootstrapProfile: Partial<UserProfile> = {
        uid: data.user?.id || "",
        email: normalizedEmail,
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
        authProviders: ["email"],
        needsPasswordSetup: false,
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
    const pendingUpgradePlan = readPendingUpgradePlan();
    const postAuthPath = pendingUpgradePlan ? buildUpgradeCheckoutPath(pendingUpgradePlan) : "/dashboard";
    rememberPostAuthRedirect(postAuthPath);
    const redirectTo = buildBrowserRedirectUrl("/dashboard");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error.message || "Erro ao entrar com Google.";
    if (data.url) {
      const authUrl = new URL(data.url);
      authUrl.searchParams.set("redirect_to", redirectTo);
      window.location.assign(authUrl.toString());
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error.message || "Erro ao entrar.";
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
        loading: !applicationReady,
        privacyMode,
        canPreviewRestrictedPages: pagePreviewAccess,
        togglePrivacyMode,
        refreshProfile,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
      }}
    >
      {applicationReady ? children : <AppBootLoading />}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
