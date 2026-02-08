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
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase/client";
import { usePathname, useRouter } from "next/navigation";
import { UserProfile } from "@/types/user";
import { FirebaseError } from "firebase/app";

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
    if (forbiddenPrefixes.some(p => prefix.includes(p))) return false;
    return true;
  };

  useEffect(() => {
    const storedPrivacy = localStorage.getItem("weven_privacy_mode");
    if (storedPrivacy === "true") {
      setPrivacyMode(true);
    }
  }, []);

  // Monitora autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          try {
            await currentUser.reload();
          } catch (e) {
            console.warn("Falha ao recarregar token (possível bloqueio de rede):", e);
          }
          setUser(currentUser);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Erro crítico no AuthStateChanged:", error);
        setUser(null);
      } finally {
        if (!currentUser) setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Monitora perfil do usuário no Firestore
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;

        // Verifica status críticos (Lógica inicial de redirecionamento imediato)
        if (profile.status === "inactive" || profile.status === "blocked") {
          // Permite apenas a página blocked
          if (pathname !== "/blocked") router.push("/blocked");
        }

        if (profile.status === "deleted") {
          // Permite apenas a página goodbye
          if (pathname !== "/goodbye") {
            router.push("/goodbye");
            signOut(auth);
          }
        }

        if (profile.status === "active") {
          // Se usuário estiver verificado no perfil, mas não no Auth
          if (profile.verifiedEmail === true && user.emailVerified === false) {
            user.reload().catch(() => { }); // catch silencioso para evitar unhandled promise
          }
        }

        setUserProfile(profile);
      } else {
        // Caso raro: User Auth existe mas documento não (pode acontecer se deletado manualmente no banco)
        console.warn("Perfil de usuário não encontrado no Firestore");
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro na busca do perfil do usuário:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router, pathname]);

  useEffect(() => {
    // 1. Aguarda carregamento total (Auth + Perfil)
    if (loading) return;

    const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/not-found", "/goodbye"];
    const isPublicRoute = publicRoutes.includes(pathname);

    // 2. Cenário: Usuário NÃO logado
    if (!user) {
      if (!isPublicRoute) {
        router.replace("/login"); // Use replace para evitar histórico de loop
      }
      return;
    }

    // 3. Cenário: Usuário LOGADO (mas perfil ainda carregando ou inexistente)
    if (!userProfile) return;

    // --- A partir daqui, temos User + UserProfile ---

    // Prioridade 1: Status Bloqueado/Inativo/Deletado
    if (userProfile.status !== "active") {
      if (userProfile.status === "deleted") {
        if (pathname !== "/goodbye") router.replace("/goodbye");
      } else {
        // Bloqueado ou inativo
        if (pathname !== "/blocked") router.replace("/blocked");
      }
      return; // PARE AQUI. Não deixe executar o resto.
    }

    // Prioridade 2: Verificação de E-mail
    const isEmailVerified = userProfile.verifiedEmail;

    if (!isEmailVerified) {
      // Se NÃO verificado, o usuário SÓ pode estar em /verify-email
      if (pathname !== "/verify-email") {
        router.replace("/verify-email");
      }
      return; // PARE AQUI. Isso impede o redirecionamento para a Home.
    }

    // Prioridade 3: Se já está verificado (isEmailVerified === true)
    if (isEmailVerified) {
      // Não deve conseguir acessar a página de verificar
      if (pathname === "/verify-email") {
        router.replace("/");
        return;
      }

      // Não deve acessar login/register/goodbye se já está logado e ativo
      if (["/login", "/register", "/goodbye", "/blocked"].includes(pathname)) {
        router.replace("/");
        return;
      }
    }

    // Prioridade 4: Role Admin (Opcional, mantendo sua lógica)
    if (isEmailVerified && (pathname.startsWith("/admin"))) {
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

  // Registro com e-mail e senha
  const registerWithEmail = async (name: string, completeName: string, email: string, pass: string, phone: string) => {
    try {
      if (!isValidRealEmail(email)) throw "Por favor, utilize um e-mail válido para cadastro.";

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });

      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: email,
        displayName: name,
        completeName: completeName,
        phone: phone,
        role: "client",
        plan: "free",
        status: "active",
        createdAt: new Date().toISOString(),
        paymentStatus: "pending",
        transactionCount: 0,
        verifiedEmail: false,
      } as UserProfile;

      await setDoc(doc(db, "users", userCredential.user.uid), newProfile, { merge: true });
      await sendEmailVerification(userCredential.user);
      router.push("/verify-email");

    } catch (error) {
      let message = "Erro ao registrar usuário.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.EMAIL_EXISTS) message = "E-mail já em uso.";
        if (error.code === AuthErrorCodes.WEAK_PASSWORD) message = "Senha muito fraca.";
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw message;
    }
  };

  // Login com Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Força seleção de conta para evitar loop de login automático se houver erro
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Verifica e cria perfil no Firestore se necessário
      if (user) {
        if (user.email && !isValidRealEmail(user.email)) {
          await user.delete();
          throw new Error("E-mail não aceito.");
        }

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        // Se não existir, cria novo perfil
        if (!snap.exists()) {
          const newProfile: UserProfile = {
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
            transactionCount: 0,
            verifiedEmail: true,
          } as UserProfile;
          await setDoc(userRef, newProfile, { merge: true });

          if (user?.email) {
            await sendPasswordResetEmail(auth, user.email);
            alert("Conta criada! Enviamos um e-mail para definir sua senha.");
          }
        } // Se existir, verifica status e data de exclusão (vazia) 
        else {
          const data = snap.data() as UserProfile;
          if (data.status === 'active' && data.deletedAt) {
            await setDoc(userRef, { deletedAt: null }, { merge: true });
          }
        }
      }
      router.replace("/dashboard");
    } catch (error) {
      console.error("Erro no Google Login:", error);
      let message = "Erro ao entrar com Google.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.POPUP_CLOSED_BY_USER) message = "Login cancelado.";
        if (error.code === AuthErrorCodes.NETWORK_REQUEST_FAILED) message = "Erro de conexão. Verifique se há bloqueadores de anúncio ativos.";
      }
      throw message;
    }
  };

  // Login com e-mail e senha
  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.replace("/dashboard");
    } catch (error) {
      let message = "Erro ao entrar.";
      if (error instanceof FirebaseError) {
        if (error.code === AuthErrorCodes.INVALID_LOGIN_CREDENTIALS) message = "Credenciais inválidas.";
        if (error.code === AuthErrorCodes.USER_DELETED) message = "Usuário não encontrado.";
      }
      throw message;
    }
  };

  // Logout do usuário
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