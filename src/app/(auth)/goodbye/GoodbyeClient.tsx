"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Home, Loader2, Mail, MessageCircle, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { ACCOUNT_DELETION_GRACE_DAYS, computePermanentDeleteAt } from "@/lib/account-deletion/policy";
import { hasAccountDeletionRequest } from "@/lib/account-deletion/client";
import { getSupabaseClient } from "@/services/supabase/client";

const WHATSAPP_SUPPORT_URL = "https://wa.me/5511992348613";

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function GoodbyeClient() {
  const router = useRouter();
  const { locale } = useI18n();
  const { user, userProfile, loading, canPreviewRestrictedPages } = useAuth();
  const t = useTranslations("auth.goodbye");
  const [hasDeletionContext, setHasDeletionContext] = useState<boolean | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState("");
  const [restoreName, setRestoreName] = useState("");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreProtocol, setRestoreProtocol] = useState("");
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);

  useEffect(() => {
    setHasDeletionContext(hasAccountDeletionRequest());
  }, []);

  useEffect(() => {
    if (loading) return;
    if (hasDeletionContext === null) return;
    if (canPreviewRestrictedPages || userProfile?.status === "deleted" || (!user && hasDeletionContext)) return;
    router.replace(user ? "/dashboard" : "/");
  }, [canPreviewRestrictedPages, hasDeletionContext, loading, router, user, userProfile?.status]);

  useEffect(() => {
    if (!restoreEmail && user?.email) {
      setRestoreEmail(user.email);
    }
    if (!restoreName) {
      const nextName = userProfile?.completeName || userProfile?.displayName || user?.displayName || "";
      if (nextName) setRestoreName(nextName);
    }
  }, [restoreEmail, restoreName, user, userProfile]);

  const permanentDeleteAt = useMemo(() => {
    return userProfile?.permanentDeleteAt || computePermanentDeleteAt(userProfile?.deletedAt || null);
  }, [userProfile?.deletedAt, userProfile?.permanentDeleteAt]);

  const permanentDeleteLabel = formatDate(permanentDeleteAt || null, locale);
  const deletionWindowExpired = Boolean(
    permanentDeleteAt && new Date(permanentDeleteAt).getTime() <= Date.now(),
  );

  if (
    loading ||
    hasDeletionContext === null ||
    (!canPreviewRestrictedPages && userProfile?.status !== "deleted" && (user || !hasDeletionContext))
  ) {
    return (
      <AuthPageShell maxWidthClassName="max-w-md">
        <div className="app-panel-soft rounded-3xl border border-[color:var(--app-panel-border)] p-6 text-center text-sm text-muted-foreground shadow-xl shadow-primary/10">
          {t("loading")}
        </div>
      </AuthPageShell>
    );
  }

  async function handleFreshStart() {
    setError("");
    setIsRestarting(true);

    const supabase = getSupabaseClient();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error(t("errors.missingToken"));
      }

      const response = await fetch("/api/account/permanent-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || t("errors.freshStart"));
      }

      await supabase.auth.signOut();
      router.replace("/register?fresh=1");
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : t("errors.freshStartFallback"));
      setIsRestarting(false);
    }
  }

  async function handleRestoreRequest() {
    setError("");
    setRestoreProtocol("");
    setIsSubmittingRestore(true);

    try {
      const response = await fetch("/api/account/restore-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: restoreEmail,
          name: restoreName,
          wantsData: true,
          message: restoreMessage,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; protocol?: string };
      if (!response.ok || !payload.ok) {
        if (payload.error === "restore_window_expired") {
          throw new Error(t("errors.restoreWindowExpired"));
        }
        if (payload.error === "account_not_deleted") {
          throw new Error(t("errors.accountNotDeleted"));
        }
        throw new Error(payload.error || t("errors.restoreRequest"));
      }

      setRestoreProtocol(payload.protocol || "");
      setRestoreMessage("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("errors.restoreRequestFallback"));
    } finally {
      setIsSubmittingRestore(false);
    }
  }

  return (
    <AuthPageShell maxWidthClassName="max-w-3xl" className="items-start sm:items-center">
      <Card className="app-panel-soft w-full rounded-3xl border border-[color:var(--app-panel-border)] shadow-xl shadow-primary/10">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-primary/10 text-primary shadow-lg">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
              {t("title")}
            </CardTitle>
            <CardDescription className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("description")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{t("completedTitle")}</p>
                <p className="mt-1">
                  {t("completedDescription", { days: ACCOUNT_DELETION_GRACE_DAYS })}
                </p>
              </div>
            </div>
          </div>

          <div className="app-panel-subtle rounded-2xl border p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">{t("permanentDeleteTitle")}</p>
                <p className="mt-1">
                  {permanentDeleteLabel
                    ? t("permanentDeleteWithDate", { date: permanentDeleteLabel })
                    : t("permanentDeleteFallback", { days: ACCOUNT_DELETION_GRACE_DAYS })}
                </p>
              </div>
            </div>
          </div>

          {!deletionWindowExpired ? (
            <div className="app-panel-subtle rounded-2xl border border-[color:var(--app-panel-border)] p-4">
              <div className="mb-4 flex items-start gap-3 text-sm text-foreground">
                <RotateCcw className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{t("restoreTitle")}</p>
                  <p className="mt-1">
                    {t("restoreDescription", { days: ACCOUNT_DELETION_GRACE_DAYS })}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  autoComplete="name"
                  value={restoreName}
                  onChange={(e) => setRestoreName(e.target.value)}
                  placeholder={t("placeholders.name")}
                  className="app-field-surface h-11 rounded-xl"
                />
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={restoreEmail}
                  onChange={(e) => setRestoreEmail(e.target.value)}
                  placeholder={t("placeholders.email")}
                  className="app-field-surface h-11 rounded-xl"
                />
              </div>

              <textarea
                value={restoreMessage}
                onChange={(e) => setRestoreMessage(e.target.value)}
                placeholder={t("placeholders.message")}
                className="app-field-surface mt-3 min-h-[110px] w-full rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t("restoreSupportNote")}
                </p>
                <Button
                  type="button"
                  onClick={handleRestoreRequest}
                  disabled={isSubmittingRestore || !restoreName.trim() || !restoreEmail.trim()}
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmittingRestore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  {t("actions.restore")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              {t("expiredRestore")}
            </div>
          )}

          {restoreProtocol ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              {t("restoreSuccess", { protocol: restoreProtocol })}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="app-panel-subtle flex flex-col gap-3 border-t border-border/70 p-6 sm:flex-row sm:justify-between">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full rounded-xl">
              <Home className="mr-2 h-4 w-4" />
              {t("actions.home")}
            </Button>
          </Link>

          <Link href={WHATSAPP_SUPPORT_URL} target="_blank" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full rounded-xl border-green-600/30 text-green-700 hover:bg-green-50">
              <MessageCircle className="mr-2 h-4 w-4" />
              {t("actions.whatsapp")}
            </Button>
          </Link>

          <Button
            type="button"
            onClick={handleFreshStart}
            disabled={isRestarting}
            className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {t("actions.freshStart")}
          </Button>
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}
