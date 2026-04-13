"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { sendPasswordAccessEmail } from "@/services/auth/passwordAccess";
import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Por favor, insira seu e-mail.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }

    setIsLoading(true);
    try {
      const validationResponse = await fetch("/api/auth/password-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const validationPayload = (await validationResponse.json()) as { ok?: boolean; error?: string };
      if (!validationResponse.ok || !validationPayload.ok) {
        if (validationPayload.error === "email_not_found") {
          throw new Error("Nenhuma conta foi encontrada com esse e-mail.");
        }
        throw new Error("Nao foi possivel validar este e-mail agora.");
      }

      await sendPasswordAccessEmail(email.trim().toLowerCase(), "recovery");
      setIsSent(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Erro ao enviar e-mail. Tente novamente.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell maxWidthClassName="max-w-[400px]">
        <div className={`${zoomIn} ${authPanelClassName}`}>
          {!isSent ? (
            <>
              <div className="text-center mb-6 space-y-2">
                <div className={`${zoomIn} ${authIconClassName} mb-4`}>
                  <KeyRound className="h-6 w-6" />
                </div>
                <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-foreground`}>
                  Recuperar Senha
                </h1>
                <p className={`${fadeInUp} delay-200 text-sm text-muted-foreground`}>
                  Digite seu e-mail para receber um link de redefinição.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className={`${fadeInUp} delay-300 space-y-6`}>
                <div className="space-y-2">
                  <Label htmlFor="email"><Mail className="inline-block mr-2 h-4 w-4" /> E-mail</Label>
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

                {error && (
                  <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-center text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className={`${fadeInUp} text-center space-y-6 py-4`}>
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 text-primary animate-in zoom-in duration-300">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">E-mail Enviado!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Verifique sua caixa de entrada (e spam) no endereço <strong>{email}</strong>.
                </p>
              </div>

              <Button
                onClick={() => setIsSent(false)}
                variant="outline"
                className="h-11 w-full rounded-xl"
              >
                Tentar outro e-mail
              </Button>
            </div>
          )}

          <div className={`${fadeInUp} delay-500 mt-8 text-center`}>
            <Link
              href="/login"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:cursor-pointer transition-colors duration-200"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para Login
            </Link>
          </div>
        </div>
    </AuthPageShell>
  );
}

