"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";

import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n/T";
import { sendPasswordAccessEmail } from "@/services/auth/passwordAccess";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
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
      setError(t("errors.missingEmail"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("errors.invalidEmail"));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsLoading(true);
    try {
      const validationResponse = await fetch("/api/auth/password-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const validationPayload = (await validationResponse.json()) as { ok?: boolean; error?: string };
      if (!validationResponse.ok || !validationPayload.ok) {
        if (validationPayload.error === "email_not_found") {
          throw new Error(t("errors.emailNotFound"));
        }
        throw new Error(t("errors.validateEmail"));
      }

      await sendPasswordAccessEmail(normalizedEmail, "recovery");
      setEmail(normalizedEmail);
      setIsSent(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("errors.sendEmail");
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
            <div className="mb-6 space-y-2 text-center">
              <div className={`${zoomIn} ${authIconClassName} mb-4`}>
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-foreground`}>
                {t("title")}
              </h1>
              <p className={`${fadeInUp} delay-200 text-sm text-muted-foreground`}>
                {t("description")}
              </p>
            </div>

            <form onSubmit={handleResetPassword} className={`${fadeInUp} delay-300 space-y-6`}>
              <div className="space-y-2">
                <Label htmlFor="email"><Mail className="mr-2 inline-block h-4 w-4" /> {t("emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={t("emailPlaceholder")}
                  spellCheck={false}
                  className="app-field-surface h-11 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div role="alert" className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-center text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground shadow-lg shadow-black/10 transition-all duration-200 hover:cursor-pointer hover:bg-primary/90 active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("sendLink")}
              </Button>
            </form>
          </>
        ) : (
          <div className={`${fadeInUp} space-y-6 py-4 text-center`}>
            <div className="animate-in zoom-in mx-auto w-fit rounded-full bg-primary/10 p-4 text-primary duration-300">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">{t("sentTitle")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("sentDescription", { email })}
              </p>
            </div>

            <Button
              onClick={() => setIsSent(false)}
              variant="outline"
              className="h-11 w-full rounded-xl"
            >
              {t("tryAnotherEmail")}
            </Button>
          </div>
        )}

        <div className={`${fadeInUp} delay-500 mt-8 text-center`}>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:cursor-pointer hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {t("backToLogin")}
          </Link>
        </div>
      </div>
    </AuthPageShell>
  );
}
