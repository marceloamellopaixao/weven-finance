"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { parseUpgradePlan, readPendingUpgradePlan, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";

export default function RegisterPage() {
  const { registerWithEmail } = useAuth();
  const searchParams = useSearchParams();

  const [displayName, setDisplayName] = useState("");
  const [completeName, setCompleteName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const pendingUpgradePlan = parseUpgradePlan(searchParams.get("upgrade_plan")) || readPendingUpgradePlan();

  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  useEffect(() => {
    if (pendingUpgradePlan) {
      rememberPendingUpgradePlan(pendingUpgradePlan);
    }
  }, [pendingUpgradePlan]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName) return setError("Por favor, insira um apelido para o dashboard.");
    if (!phone) return setError("Por favor, insira seu número de celular/telefone.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Por favor, insira um número de celular/telefone válido.");
    if (!completeName) return setError("Por favor, insira seu nome completo.");
    if (!email) return setError("Por favor, insira seu e-mail.");
    if (!password) return setError("Por favor, insira sua senha.");
    if (!confirmPassword) return setError("Por favor, confirme sua senha.");
    if (password !== confirmPassword) return setError("As senhas não coincidem.");
    if (password.length < 6) return setError("A senha deve ter no mínimo 6 caracteres.");

    setIsLoading(true);
    try {
      await registerWithEmail(displayName, completeName, email, password, phone);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell maxWidthClassName="max-w-[440px]">
        <div className={`${zoomIn} ${authPanelClassName}`}>
          <div className="text-center mb-6 space-y-2">
            <div className={`${zoomIn} ${authIconClassName} mb-4`}>
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-foreground`}>
              Crie sua conta
            </h1>
            <p className={`${fadeInUp} delay-200 text-sm text-muted-foreground`}>
              Comece a controlar suas financas hoje.
            </p>
            {pendingUpgradePlan && (
              <p className="text-xs font-medium text-primary">
                Depois do cadastro, vamos continuar na contratação do plano {pendingUpgradePlan === "premium" ? "Premium" : "Pro"}.
              </p>
            )}
          </div>

          <form onSubmit={handleRegister} className={`${fadeInUp} delay-300 space-y-4`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">Apelido</Label>
                <Input
                  id="displayName"
                  autoComplete="nickname"
                  placeholder="Ex: Marcelo"
                  className="app-field-surface h-11 rounded-xl"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel-national"
                  inputMode="tel"
                  placeholder="Ex: 1199..."
                  className="app-field-surface h-11 rounded-xl"
                  maxLength={15}
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(normalizePhone(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="completeName">Nome Completo</Label>
              <Input
                id="completeName"
                autoComplete="name"
                placeholder="Ex: Marcelo Augusto"
                className="app-field-surface h-11 rounded-xl"
                value={completeName}
                onChange={(e) => setCompleteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="Ex: seu@email.com"
                spellCheck={false}
                className="app-field-surface h-11 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="******"
                  className="app-field-surface h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="******"
                  className="app-field-surface h-11 rounded-xl"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-center text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </form>

          <div className={`${fadeInUp} delay-500 mt-6 text-center`}>
            <Link
              href={pendingUpgradePlan ? `/login?upgrade_plan=${pendingUpgradePlan}` : "/login"}
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:cursor-pointer transition-colors duration-200"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para Login
            </Link>
          </div>
        </div>
        <p className={`${fadeInUp} delay-500 mt-6 text-center text-[10px] text-muted-foreground/70`}>
          © 2026 WevenFinance.
        </p>
    </AuthPageShell>
  );
}
