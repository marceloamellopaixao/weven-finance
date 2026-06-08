"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { useTranslations } from "@/i18n/T";
import { parseUpgradePlan, readPendingUpgradePlan, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";

export default function RegisterPage() {
  const { registerWithEmail } = useAuth();
  const tRegister = useTranslations("auth.register");
  const tPlaceholders = useTranslations("auth.placeholders");
  const tValidation = useTranslations("validation");
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

    if (!displayName) return setError(tValidation("nicknameRequired"));
    if (!phone) return setError(tValidation("phoneRequired"));
    if (phone.replace(/\D/g, "").length < 10) return setError(tValidation("phoneInvalid"));
    if (!completeName) return setError(tValidation("fullNameRequired"));
    if (!email) return setError(tValidation("emailRequired"));
    if (!password) return setError(tValidation("passwordRequired"));
    if (!confirmPassword) return setError(tValidation("confirmPasswordRequired"));
    if (password !== confirmPassword) return setError(tValidation("passwordMismatch"));
    if (password.length < 6) return setError(tValidation("passwordMin"));

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
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher />
        </div>
        <div className="text-center mb-6 space-y-2">
          <div className={`${zoomIn} ${authIconClassName} mb-4`}>
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-foreground`}>
            {tRegister("title")}
          </h1>
          <p className={`${fadeInUp} delay-200 text-sm text-muted-foreground`}>
            {tRegister("subtitle")}
          </p>
          {pendingUpgradePlan && (
            <p className="text-xs font-medium text-primary">
              {tRegister("pendingUpgrade", { plan: pendingUpgradePlan === "premium" ? "Premium" : "Pro" })}
            </p>
          )}
        </div>

        <form onSubmit={handleRegister} className={`${fadeInUp} delay-300 space-y-4`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">{tRegister("nickname")}</Label>
              <Input
                id="displayName"
                autoComplete="nickname"
                placeholder={tPlaceholders("nickname")}
                className="app-field-surface h-11 rounded-xl"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tRegister("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="tel"
                placeholder={tPlaceholders("phone")}
                className="app-field-surface h-11 rounded-xl"
                maxLength={15}
                value={formatPhone(phone)}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="completeName">{tRegister("fullName")}</Label>
            <Input
              id="completeName"
              autoComplete="name"
              placeholder={tPlaceholders("fullName")}
              className="app-field-surface h-11 rounded-xl"
              value={completeName}
              onChange={(e) => setCompleteName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{tRegister("email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={tPlaceholders("email")}
              spellCheck={false}
              className="app-field-surface h-11 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">{tRegister("password")}</Label>
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
              <Label htmlFor="confirmPassword">{tRegister("confirm")}</Label>
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
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : tRegister("submit")}
          </Button>
        </form>

        <div className={`${fadeInUp} delay-500 mt-6 text-center`}>
          <Link
            href={pendingUpgradePlan ? `/login?upgrade_plan=${pendingUpgradePlan}` : "/login"}
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:cursor-pointer transition-colors duration-200"
          >
            <ArrowLeft className="w-3 h-3" /> {tRegister("backToLogin")}
          </Link>
        </div>
      </div>
      <p className={`${fadeInUp} delay-500 mt-6 text-center text-[10px] text-muted-foreground/70`}>
        © 2026 WevenFinance.
      </p>
    </AuthPageShell>
  );
}
