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
} from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/services/firebase/client";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types/user";

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
          // garante dados atualizados do Auth
          await currentUser.reload();
          setUser(currentUser);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } finally {
        // loading final será controlado também pelo efeito do perfil
        if (!currentUser) setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Monitora perfil do usuário no Firestore em tempo real
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const userRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      async (snap) => {
        try {
          if (snap.exists()) {
            const profile = snap.data() as UserProfile;

            // Verifica se o usuário está inativo (bloqueio em tempo real)
            if (profile.status === "inactive") {
              setUserProfile(profile);
              router.push("/blocked");
              setLoading(false);
              return;
            }

            setUserProfile(profile);
            setLoading(false);
            return;
          }

          // Se não existir, cria perfil padrão
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "Usuário",
            completeName: user.displayName || "",
            phone: "",
            photoURL: user.photoURL || "",
            role: "client",
            plan: "free",
            status: "active",
            createdAt: new Date().toISOString(),
            // se seu type tiver isso, mantém consistente com o admin
            paymentStatus: "pending",
          } as UserProfile;

          await setDoc(userRef, newProfile, { merge: true });
          setUserProfile(newProfile);
          setLoading(false);
        } catch (error) {
          console.error("Erro ao processar userProfile realtime:", error);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Erro no realtime do userProfile:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, router]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("weven_privacy_mode", String(newValue));
      return newValue;
    });
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push("/");
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
    router.push("/");
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    pass: string,
    phone: string,
    completeName: string
  ) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });

    // Cria o perfil do usuário no Firestore (o realtime vai captar e espalhar)
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
    } as UserProfile;

    await setDoc(doc(db, "users", userCredential.user.uid), newProfile, { merge: true });

    await sendEmailVerification(userCredential.user);
  };

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
