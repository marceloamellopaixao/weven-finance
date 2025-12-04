"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import Link from "next/link";

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const { signInWithGoogle, loginWithEmail, user } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      console.error(err);
      setError("E-mail ou senha incorretos.");
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login Google falhou", err);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden font-sans px-4">
      
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 md:p-8">
          
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Weven<span className="text-violet-600">Finance</span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Bem-vindo de volta!
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Login com Email */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="bg-white/50 dark:bg-zinc-800/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Senha</Label>
                  <a href="#" className="text-xs text-violet-600 hover:underline">Esqueceu?</a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="******" 
                  className="bg-white/50 dark:bg-zinc-800/50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                  {error}
                </div>
              )}

              <Button 
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium shadow-lg shadow-violet-500/20 transition-all active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-zinc-400 font-medium">Ou continue com</span>
              </div>
            </div>

            <Button 
              onClick={handleGoogleLogin} 
              disabled={isLoading || isGoogleLoading}
              className="w-full h-11 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 font-medium shadow-sm transition-all active:scale-[0.98] rounded-xl"
            >
              {isGoogleLoading ? (
                <span className="flex items-center gap-2">Conectando...</span>
              ) : (
                <span className="flex items-center justify-center w-full">
                  <GoogleIcon />
                  Google
                </span>
              )}
            </Button>

            <div className="text-center pt-2">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Não tem uma conta? <Link href="/register" className="text-violet-600 font-semibold hover:underline">Cadastre-se</Link>
              </p>
            </div>

          </div>
        </div>
        
        <p className="text-center text-[10px] text-zinc-400 mt-6 opacity-60">
          © {new Date().getFullYear()} Weven Finance.
        </p>
      </div>
    </div>
  );
}