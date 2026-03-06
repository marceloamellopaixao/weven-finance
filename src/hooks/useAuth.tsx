"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  AuthErrorCodes,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/services/firebase/client";
import { usePathname, useRouter } from "next/navigation";
import { UserProfile } from "@/types/user";
import { FirebaseError } from "firebase/app";
import {
  getImpersonationHeader,
  getImpersonationTargetUid,
  subscribeToImpersonationChange,
} from "@/lib/impersonation/client";

const BLOCKED_STATUSES = new Set(["inactive", "blocked"]);
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/not-found", "/blocked", "/goodbye"];

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (
    name: string,
    email: string,
    pass: string,
    phone: string,
    completeName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [impersonationTargetUid, setImpersonationTargetUid] = useState<string | null>(() =>
    getImpersonationTargetUid()
  );

  const router = useRouter();
  const pathname = usePathname();

  const DISPOSABLE_DOMAINS = [
    "teste.com", "test.com", "example.com", "mail.com", "1.com",
    "tempmail.com", "yopmail.com", "mailinator.com", "10minutemail.com",
    "guerrillamail.com", "sharklasers.com", "dispostable.com", "mailinator.com",
    "getnada.com", "temp-mail.org"
  ];

  const isValidRealEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailLower)) return false;
    const [prefix, domain] = emailLower.split("@");
    if (prefix.length < 10 || /^(.)\1+$/.test(prefix)) return false;
    if (DISPOSABLE_DOMAINS.includes(domain)) return false;
    const forbiddenPrefixes = ["teste", "test", "asdf", "12345", "admin"];
    if (forbiddenPrefixes.some((p) => prefix.includes(p))) return false;
    return true;
  };

  const apiFetchWithToken = async (path: string, init?: RequestInit) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("missing_auth_token");
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
    if (storedPrivacy === "true") {
      setPrivacyMode(true);
    }
  }, []);

  useEffect(() => {
    return subscribeToImpersonationChange((nextTargetUid) => {
      setImpersonationTargetUid(nextTargetUid);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          try {
            await currentUser.reload();
          } catch (e) {
            console.warn("Falha ao recarregar token:", e);
          }
          setUser(currentUser);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Erro critico no AuthStateChanged:", error);
        setUser(null);
      } finally {
        if (!currentUser) setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    let cancelled = false;
    const syncProfile = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await apiFetchWithToken("/api/profile/me", { method: "GET" });
        const payload = (await response.json()) as { ok: boolean; error?: string; profile?: UserProfile | null };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar perfil");

        const profile = payload.profile;
        if (profile) {
          if (profile.status === "active") {
            if (profile.verifiedEmail === true && user.emailVerified === false) {
              user.reload().catch(() => {});
            }
          }

          if (!cancelled) setUserProfile(profile);
        } else if (!cancelled) {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Erro na busca do perfil do usuário:", error);
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
      if (!isPublicRoute) {
        router.replace("/login");
      }
      return;
    }

    if (!userProfile) return;

    if (userProfile.status === "deleted") {
      if (pathname !== "/goodbye") {
        router.replace("/goodbye");
      }
      signOut(auth).catch(() => {});
      return;
    }

    if (BLOCKED_STATUSES.has(userProfile.status)) {
      if (pathname !== "/blocked") {
        router.replace("/blocked");
      }
      return;
    }

    const isEmailVerified = userProfile.verifiedEmail;

    if (!isEmailVerified) {
      if (pathname !== "/verify-email") {
        router.replace("/verify-email");
      }
      return;
    }

    if (isEmailVerified) {
      if (pathname === "/verify-email") {
        router.replace("/");
        return;
      }

      if (["/login", "/register", "/goodbye", "/blocked"].includes(pathname)) {
        router.replace("/");
        return;
      }
    }

    if (isEmailVerified && pathname.startsWith("/admin")) {
      if (userProfile.role !== "admin" && userProfile.role !== "moderator") {
        router.replace("/");
      }
    }
  }, [user, userProfile, loading, pathname, router]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("weven_privacy_mode", String(newValue));
      return newValue;
    });
  };

  const registerWithEmail = async (name: string, completeName: string, email: string, pass: string, phone: string) => {
    try {
      if (!isValidRealEmail(email)) throw "Por favor, utilize um e-mail valido para cadastro.";

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });

      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
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
      } as UserProfile;

      const bootstrapResponse = await apiFetchWithToken("/api/profile/bootstrap", {
        method: "POST",
        body: JSON.stringify({ profile: newProfile }),
      });
      const bootstrapPayload = (await bootstrapResponse.json()) as { ok: boolean };
      if (!bootstrapResponse.ok || !bootstrapPayload.ok) {
        throw new Error("Falha ao inicializar perfil do usuário.");
      }

      await sendEmailVerification(userCredential.user);
      router.push("/verify-email");
    } catch (error) {
      let message = "Erro ao registrar usuário.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.EMAIL_EXISTS) message = "E-mail ja em uso.";
        if (error.code === AuthErrorCodes.WEAK_PASSWORD) message = "Senha muito fraca.";
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw message;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        if (user.email && !isValidRealEmail(user.email)) {
          await user.delete();
          throw new Error("E-mail não aceito.");
        }

        const bootstrapProfile: Partial<UserProfile> = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Usuário",
          completeName: user.displayName || "",
          phone: "",
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
          verifiedEmail: true,
        };

        const bootstrapResponse = await apiFetchWithToken("/api/profile/bootstrap", {
          method: "POST",
          body: JSON.stringify({ profile: bootstrapProfile }),
        });
        const bootstrapPayload = (await bootstrapResponse.json()) as { ok: boolean; created?: boolean };
        if (!bootstrapResponse.ok || !bootstrapPayload.ok) {
          throw new Error("Falha ao sincronizar perfil com o backend.");
        }

        if (bootstrapPayload.created && user.email) {
          await sendPasswordResetEmail(auth, user.email);
          alert("Conta criada! Enviamos um e-mail para definir sua senha.");
        }
      }

      router.replace("/dashboard");
    } catch (error) {
      console.error("Erro no Google Login:", error);
      let message = "Erro ao entrar com Google.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.POPUP_CLOSED_BY_USER) message = "Login cancelado.";
        if (error.code === AuthErrorCodes.NETWORK_REQUEST_FAILED) {
          message = "Erro de conexao. Verifique se ha bloqueadores de anuncio ativos.";
        }
      }
      throw message;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.replace("/dashboard");
    } catch (error) {
      let message = "Erro ao entrar.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.INVALID_LOGIN_CREDENTIALS) message = "Credenciais invalidas.";
        if (error.code === AuthErrorCodes.USER_DELETED) message = "Usuário não encontrado.";
      }
      throw message;
    }
  };

  const logout = async () => {
    await signOut(auth);
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
