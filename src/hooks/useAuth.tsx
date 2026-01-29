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
  const pathname = usePathname(); // Hook para pegar a rota atual

  const DISPOSABLE_DOMAINS = [
    "teste.com", "test.com", "example.com", "mail.com", "1.com",
    "tempmail.com", "yopmail.com", "mailinator.com", "10minutemail.com",
    "guerrillamail.com", "sharklasers.com", "dispostable.com", "mailinator.com",
    "getnada.com", "temp-mail.org"
  ];

  const isValidRealEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase().trim();

    // 1. Regex de formato básico
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailLower)) return false;

    const [prefix, domain] = emailLower.split("@");

    // 2. Bloqueia prefixos muito curtos ou genéricos (como 1@...)
    if (prefix.length < 10 || /^(.)\1+$/.test(prefix)) return false;

    // 3. Bloqueia domínios de e-mail temporário e fictícios óbvios
    if (DISPOSABLE_DOMAINS.includes(domain)) return false;

    // 4. Bloqueia palavras-chave de teste no prefixo
    const forbiddenPrefixes = ["teste", "test", "asdf", "12345", "admin"];
    if (forbiddenPrefixes.some(p => prefix.includes(p))) return false;

    return true;
  };

  // Preferência de modo privacidade
  useEffect(() => {
    const storedPrivacy = localStorage.getItem("weven_privacy_mode");
    if (storedPrivacy === "true") {
      setPrivacyMode(true);
    }
  }, []);

  // Monitora autenticação (somente controla o User do Firebase)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // Tenta atualizar o token, mas não bloqueia o login se falhar
          try {
            await currentUser.reload();
          } catch (e) {
            console.warn("Não foi possível recarregar os dados do usuário, usando cache local.", e);
          }
          setUser(currentUser);
        } else {
          setUser(null);
          setUserProfile(null);
          setLoading(false); // Garante que o loading pare se não houver usuário
        }
      } catch (error) {
        console.error("Erro crítico no AuthStateChanged:", error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Monitora perfil do usuário no Firestore em tempo real
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
        } else if (profile.status === "deleted") {
           // Permite apenas a página goodbye
           if (pathname !== "/goodbye") {
             router.push("/goodbye");
             signOut(auth);
           }
        } else {
          // Apenas redireciona verificações se o status estiver OK (ativo)
          
          // Redireciona para verificação de e-mail se necessário
          if (profile.verifiedEmail === false || user.emailVerified === false) {
             if (pathname !== "/verify-email") router.push("/verify-email");
          }

          // Se usuário estiver verificado no perfil, mas não no Auth
          if (profile.verifiedEmail === true && user.emailVerified === false) {
            user.reload().catch(() => {}); // catch silencioso para evitar unhandled promise
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
  }, [user, router, pathname]); // Adicionado pathname para reagir a mudanças de rota

  // --- Lógica Centralizada de Proteção de Rotas ---
  useEffect(() => {
    if (loading) return; // Não faz nada enquanto carrega

    const publicRoutes = ["/login", "/register", "/_not-found", "/goodbye"];
    const isPublicRoute = publicRoutes.includes(pathname);

    // 1. Usuário NÃO logado
    if (!user) {
      // Se tentar acessar rota protegida, manda pro login
      if (!isPublicRoute) {
        router.push("/login");
      }
      return;
    }

    // 2. Usuário LOGADO
    if (userProfile) {
      
      // Bloqueio de rotas públicas para quem já está logado (ex: login/register)
      // Exceção: goodbye é pública mas pode ser acessada logado antes do signOut
      if ((pathname === "/login" || pathname === "/register") && userProfile.status === 'active') {
        router.push("/");
        return;
      }

      // Validação de Status Bloqueado/Inativo
      if (userProfile.status === "blocked" || userProfile.status === "inactive") {
        if (pathname !== "/blocked") {
          router.push("/blocked");
        }
        return;
      }

      // Validação de Status Ativo
      if (userProfile.status === "active") {
        // Se estiver em blocked ou goodbye, redireciona para home
        if (pathname === "/blocked" || pathname === "/goodbye") {
          router.push("/");
        }
      }

      // Validação de Status Deletado
      if (userProfile.status === "deleted") {
        if (pathname !== "/goodbye") {
          router.push("/goodbye");
        }
        return;
      }

      // Validação de Email Não Verificado
      const isEmailVerified = user.emailVerified || userProfile.verifiedEmail;
      if (!isEmailVerified) {
        if (pathname !== "/verify-email") {
          router.push("/verify-email");
        }
        return;
      } 
      // Se já verificou, não deixa acessar a tela de verificar
      else if (pathname === "/verify-email") {
        router.push("/");
        return;
      }

      // Validação de Admin
      if (pathname.startsWith("/admin")) {
        if (userProfile.role !== "admin" && userProfile.role !== "moderator") {
          router.push("/");
        }
        return;
      }
    }

  }, [user, userProfile, loading, pathname, router]);


  // Alterna o modo privacidade e salva na storage
  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("weven_privacy_mode", String(newValue));
      return newValue;
    });
  };

  // Registra um novo usuário com e-mail/senha e cria o perfil no Firestore
  const registerWithEmail = async (
    name: string,
    completeName: string,
    email: string,
    pass: string,
    phone: string,
  ) => {
    try {
      // Validação de e-mail real
      if (!isValidRealEmail(email)) {
        throw "Por favor, utilize um e-mail válido para cadastro.";
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });

      // Cria o perfil do usuário no Firestore
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

      // Envia e-mail de verificação
      await sendEmailVerification(userCredential.user);
      router.push("/verify-email");

    } catch (error) {
      let message = "Erro ao registrar usuário. Tente novamente mais tarde.";

      if (typeof error === "string") {
        message = error;
      }

      if (error instanceof FirebaseError) {
        switch (error.code) {
          case AuthErrorCodes.EMAIL_EXISTS:
            message = "O email fornecido já está em uso. Utilize outro email.";
            break;
          case AuthErrorCodes.WEAK_PASSWORD:
            message = "A senha fornecida é muito fraca. Utilize uma senha mais forte.";
            break;
          case AuthErrorCodes.NETWORK_REQUEST_FAILED:
            message = "Falha na conexão de rede. Verifique sua internet e tente novamente.";
            break;
          default:
            message = "Erro ao registrar usuário. Tente novamente mais tarde.";
            break;
        }
      }

      else if (error instanceof Error) {
        message = error.message;
      }

      throw message;
    }
  };

  // Cria um Login com o Google e registra o usuário no Firestore se for novo usuário
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Verifica se o perfil do usuário já existe no Firestore
      if (user) {
        // Validação preventiva
        if (user.email && !isValidRealEmail(user.email)) {
          await user.delete(); // Opcional: deleta o auth se for indevido
          throw new Error("E-mail vinculado ao Google não é aceito por ser temporário.");
        }

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        // Se não existir, cria o perfil padrão + registro via email para realização de login futuro
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

          // Envia e-mail de "Esqueci a Senha" para criar o acesso via e-mail/senha
          if (user?.email) {
            await sendPasswordResetEmail(auth, user.email);
            alert("Conta criada! \nEnviamos um e-mail para você definir uma senha para acessos futuros via e-mail.");
          }
        }
      }
      router.push("/");
    } catch (error) {
      let message = "Erro ao efetuar login com Google. Tente novamente mais tarde.";

      if (error instanceof FirebaseError) {
        switch (error.code) {
          case AuthErrorCodes.POPUP_CLOSED_BY_USER:
            message = "Login cancelado pelo usuário.";
            break;
          case AuthErrorCodes.NETWORK_REQUEST_FAILED:
            message = "Falha na conexão de rede. Verifique sua internet e tente novamente.";
            break;
          default:
            message = "Erro ao efetuar login com Google. Tente novamente mais tarde.";
            break;
        }
      }
      throw message;
    }
  };

  // Login com e-mail e senha
  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      router.push("/");
    } catch (error) {
      let message = "Erro ao efetuar login. Tente novamente mais tarde.";

      if (error instanceof FirebaseError) {
        switch (error.code) {
          case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
            message = "E-mail ou Senha inválidas. Verifique e tente novamente.";
            break;
          case AuthErrorCodes.INVALID_PASSWORD:
            message = "Senha incorreta. Tente novamente.";
            break;
          case AuthErrorCodes.INVALID_EMAIL:
            message = "Formato de email inválido. Verifique o email digitado.";
            break;
          case AuthErrorCodes.USER_DELETED:
            message = "Usuário não encontrado. Verifique o email digitado.";
            break;
          case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
            message = "Muitas tentativas falhas. Tente novamente mais tarde.";
            break;
          case AuthErrorCodes.NETWORK_REQUEST_FAILED:
            message = "Falha na conexão de rede. Verifique sua internet e tente novamente.";
            break;
          default:
            message = "Erro ao efetuar login. Tente novamente mais tarde.";
            break;
        }
      }

      throw message;
    }
  };

  // Logout do usuário
  const logout = async () => {
    await signOut(auth);
    router.push("/");
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