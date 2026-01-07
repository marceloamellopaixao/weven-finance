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
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Recarrega o usuário para garantir que o status de emailVerified esteja atualizado
        await currentUser.reload();
        
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;
          if (profile.status === 'inactive') {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
            alert("Seu acesso foi suspenso.");
            router.push("/login");
            setLoading(false);
            return;
          }
          setUserProfile(profile);
        } else {
          // Perfil padrão
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "Usuário",
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

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push("/"); 
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
    // O redirecionamento e verificação ocorrem no useEffect ou na página de destino
    router.push("/");
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    
    // ENVIAR E-MAIL DE VERIFICAÇÃO
    await sendEmailVerification(userCredential.user);
    
    // Não redireciona para a home logada imediatamente, deixa a página de registro cuidar do fluxo
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, loginWithEmail, registerWithEmail, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);