"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Wallet, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const { registerWithEmail } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [completeName, setCompleteName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!displayName) return setError("Por favor, insira um apelido para o dashboard.");
    if (!phone) return setError("Por favor, insira seu número de celular/telefone.");
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

  const formatPhone = (value: string) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");

    if (digits.length <= 10) {
      // Formato Fixo: (11) 4444-4444
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
    } else {
      // Formato Celular: (11) 99999-9999
      return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">

      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">

        <div className={`${zoomIn} bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 md:p-8`}>

          <div className="text-center mb-6 space-y-2">
            <div className={`${zoomIn} inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4`}>
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100`}>
              Crie sua conta
            </h1>
            <p className={`${fadeInUp} delay-200 text-sm text-zinc-500 dark:text-zinc-400`}>
              Comece a controlar suas finanças hoje.
            </p>
          </div>

          <form onSubmit={handleRegister} className={`${fadeInUp} delay-300 space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Apelido</Label>
                <Input
                  id="displayName"
                  placeholder="Ex: Marcelo"
                  className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input
                  id="phone"
                  placeholder="Ex: 1199..."
                  className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                  maxLength={15}
                  value={formatPhone(phone)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    setPhone(rawValue);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="completeName">Nome Completo</Label>
              <Input
                id="completeName"
                placeholder="Ex: Marcelo Augusto"
                className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                value={completeName}
                onChange={(e) => setCompleteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                placeholder="Ex: seu@email.com"
                className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="******"
                  className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="******"
                  className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium shadow-lg shadow-violet-500/20 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
          </form>

          <div className={`${fadeInUp} delay-500 mt-6 text-center`}>
            <Link
              href="/login"
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center justify-center gap-1 hover:cursor-pointer transition-all duration-200"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para Login
            </Link>
          </div>
        </div>
        <p className={`${fadeInUp} delay-500 text-center text-[10px] text-zinc-400 mt-6 opacity-60`}>
          © 2026 WevenFinance.
        </p>
      </div>
    </div>
  );
}