"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";
import {
  buildUpgradeCheckoutPath,
  parseUpgradePlan,
  readPendingUpgradePlan,
  rememberPendingUpgradePlan,
} from "@/services/billing/checkoutIntent";

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const { signInWithGoogle, loginWithEmail, user, userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const pendingUpgradePlan = parseUpgradePlan(searchParams.get("upgrade_plan")) || readPendingUpgradePlan();

  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  useEffect(() => {
    if (pendingUpgradePlan) {
      rememberPendingUpgradePlan(pendingUpgradePlan);
    }
  }, [pendingUpgradePlan]);

  useEffect(() => {
    if (user && userProfile && userProfile.status !== "deleted") {
      router.replace(pendingUpgradePlan ? buildUpgradeCheckoutPath(pendingUpgradePlan) : "/dashboard");
    }
  }, [pendingUpgradePlan, router, user, userProfile]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      if (email.trim() === "" || password.trim() === "") {
        setError("Por favor, preencha todos os campos.");
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("A senha deve ter no minimo 6 caracteres.");
        setIsLoading(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Por favor, insira um e-mail valido.");
        setIsLoading(false);
        return;
      }

      await loginWithEmail(email, password);
    } catch (err) {
      setError(err as string);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err as string);
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthPageShell maxWidthClassName="max-w-[400px]">
        <div className={`${zoomIn} ${authPanelClassName}`}>
          <div className="text-center mb-6 space-y-2">
            <div className={`${zoomIn} ${authIconClassName} mb-4`}>
              <Wallet className="h-8 w-8" />
            </div>
            <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-foreground`}>
              Weven<span className="text-primary">Finance</span>
            </h1>
            <p className={`${fadeInUp} delay-200 text-sm text-muted-foreground`}>
              Bem-vindo de volta!
            </p>
            {pendingUpgradePlan && (
              <p className="text-xs font-medium text-primary">
                Depois do login, vamos continuar na contratacao do plano {pendingUpgradePlan === "premium" ? "Premium" : "Pro"}.
              </p>
            )}
          </div>

          <div className={`${fadeInUp} delay-300 space-y-6`}>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  spellCheck={false}
                  className="app-field-surface h-11 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href={pendingUpgradePlan ? `/forgot-password?upgrade_plan=${pendingUpgradePlan}` : "/forgot-password"}
                    className="text-xs text-primary hover:underline hover:cursor-pointer transition-all duration-200"
                  >
                    Esqueceu?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="******"
                  className="app-field-surface h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-center text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="app-panel-soft rounded px-2 font-medium text-muted-foreground backdrop-blur-sm">
                  Ou continue com
                </span>
              </div>
            </div>

            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              variant="outline"
              className="h-11 w-full rounded-xl border-[color:var(--app-panel-border)] bg-background/70 font-medium shadow-sm active:scale-[0.98]"
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
              <p className="text-sm text-muted-foreground">
                Nao tem uma conta?{" "}
                <Link
                  href={pendingUpgradePlan ? `/register?upgrade_plan=${pendingUpgradePlan}` : "/register"}
                  className="text-primary font-semibold hover:underline hover:cursor-pointer transition-all duration-200"
                >
                  Cadastre-se
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className={`${fadeInUp} delay-500 mt-6 text-center text-[10px] text-muted-foreground/70`}>
          © 2026 WevenFinance.
        </p>
    </AuthPageShell>
  );
}
