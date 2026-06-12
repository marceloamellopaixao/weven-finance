"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ArrowRight, Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react";

import { AuthPageShell, authIconClassName } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/i18n/T";
import {
  buildEmailVerificationRedirectUrl,
  clearPendingVerificationEmail,
  readPendingVerificationEmail,
} from "@/services/auth/emailVerification";
import { resolvePendingUpgradePath } from "@/services/billing/checkoutIntent";
import { getSupabaseClient } from "@/services/supabase/client";

export function VerifyEmailClient() {
  const { logout, user, userProfile, loading, canPreviewRestrictedPages } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth.verifyEmail");
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingEmailLoaded, setPendingEmailLoaded] = useState(false);

  useEffect(() => {
    setPendingEmail(readPendingVerificationEmail());
    setPendingEmailLoaded(true);
  }, []);

  const displayEmail = useMemo(() => user?.email || pendingEmail || "", [pendingEmail, user?.email]);

  useEffect(() => {
    if (loading || !pendingEmailLoaded) return;
    if (userProfile?.verifiedEmail && !canPreviewRestrictedPages) {
      router.replace(resolvePendingUpgradePath() || "/dashboard");
      return;
    }
    if (!user && !pendingEmail) {
      router.replace("/register");
    }
  }, [canPreviewRestrictedPages, loading, pendingEmail, pendingEmailLoaded, router, user, userProfile?.verifiedEmail]);

  const syncVerifiedEmail = useCallback(async (token: string) => {
    const response = await fetch("/api/profile/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const payload = (await response.json()) as { ok: boolean };
    if (!response.ok || !payload.ok) {
      throw new Error(t("errors.syncProfile"));
    }
    clearPendingVerificationEmail();
    router.refresh();
    router.replace(resolvePendingUpgradePath() || "/dashboard");
  }, [router, t]);

  useEffect(() => {
    if (!user || !user.emailVerified || userProfile?.verifiedEmail) return;

    let cancelled = false;
    const autoSync = async () => {
      try {
        const token = await user.getIdToken(true);
        if (!cancelled) {
          await syncVerifiedEmail(token);
        }
      } catch {
        // The manual verification button remains available if automatic sync fails.
      }
    };

    void autoSync();
    return () => {
      cancelled = true;
    };
  }, [syncVerifiedEmail, user, user?.emailVerified, userProfile?.verifiedEmail]);

  const handleSendEmailVerification = async () => {
    try {
      const targetEmail = user?.email || pendingEmail;
      if (!targetEmail) {
        toast.error(t("errors.missingEmail"));
        return;
      }
      setIsResending(true);
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: buildEmailVerificationRedirectUrl(),
        },
      });
      if (error) throw new Error(error.message || t("errors.resendEmail"));
      setPendingEmail(targetEmail);
      toast.success(t("success.sent"));
    } catch {
      toast.error(t("errors.sendEmail"));
    } finally {
      setIsResending(false);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setIsChecking(true);
    try {
      const refreshed = await user.reload();
      if (refreshed.emailVerified) {
        const token = await refreshed.getIdToken(true);
        await syncVerifiedEmail(token);
      } else {
        toast.error(t("errors.notDetected"));
      }
    } catch {
      toast.error(t("errors.checkVerification"));
    } finally {
      setIsChecking(false);
    }
  };

  if (loading || !pendingEmailLoaded || (!user && !pendingEmail) || (userProfile?.verifiedEmail && !canPreviewRestrictedPages)) {
    return (
      <AuthPageShell maxWidthClassName="max-w-md">
        <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-6 text-center text-sm text-muted-foreground shadow-xl shadow-primary/10">
          {t("loading")}
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell maxWidthClassName="max-w-lg">
      <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-2xl shadow-primary/10 backdrop-blur-xl">
        <div className="h-2 w-full bg-primary" />
        <CardHeader className="pb-2 pt-8 text-center">
          <div className={`${authIconClassName} mx-auto mb-4`}>
            <Mail className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{t("title")}</CardTitle>
          <CardDescription className="mt-2 text-base text-muted-foreground">
            {t("description", { email: displayEmail || t("fallbackEmail") })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-5">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-xs leading-relaxed text-foreground">
              {t("instruction")}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pb-8 pt-2">
          <Button
            onClick={checkVerification}
            disabled={isChecking}
            className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t("actions.check")}
          </Button>
          <Button variant="ghost" onClick={handleSendEmailVerification} disabled={isResending} className="h-12 w-full rounded-xl">
            {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.resend")}
          </Button>
          {user ? (
            <Button onClick={logout} variant="outline" className="h-12 w-full rounded-xl">
              {t("actions.backToLogin")} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => router.push("/login")} variant="outline" className="h-12 w-full rounded-xl">
              {t("actions.goToLogin")} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}
