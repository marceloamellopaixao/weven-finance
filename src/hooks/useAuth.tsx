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
  sendEmailVerification
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
  registerWithEmail: (name: string, email: string, pass: string, phone: string, completeName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  
  const router = useRouter();

  // Efeito para carregar a preferência de modo privacidade
  useEffect(() => {
    const storedPrivacy = localStorage.getItem("weven_privacy_mode");
    if (storedPrivacy === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrivacyMode(true);
    }
  }, []);

  // Efeito para monitorar a autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Recarrega o usuário para garantir status atualizado
        await currentUser.reload();
        
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;

          // Verifica se o usuário está inativo
          if (profile.status === 'inactive') {
            setUserProfile(profile);
            router.push("/blocked");
            setLoading(false);
            return;
          }
          setUserProfile(profile);
        } else {
          // Cria perfil padrão se não existir
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "Usuário",
            completeName: currentUser.displayName || "",
            phone: "",
            photoURL: currentUser.photoURL || "",
            role: 'client',
            plan: 'free',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

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

  const registerWithEmail = async (name: string, email: string, pass: string, phone: string, completeName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });

    // Cria o perfil do usuário no Firestore
    const newProfile: UserProfile = {
      uid: userCredential.user.uid,
      email: email,
      displayName: name,
      completeName: completeName,
      phone: phone,
      role: 'client',
      plan: 'free',
      status: 'active',
      createdAt: new Date().toISOString()
    }

    await setDoc(doc(db, "users", userCredential.user.uid), newProfile);

    await sendEmailVerification(userCredential.user);
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      privacyMode, 
      togglePrivacyMode, 
      signInWithGoogle, 
      loginWithEmail, 
      registerWithEmail, 
      logout 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);