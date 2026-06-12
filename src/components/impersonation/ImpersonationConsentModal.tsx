"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPendingImpersonationRequests,
  respondImpersonationRequest,
  type SupportAccessRequest,
} from "@/services/impersonationService";
import { toast } from "react-toastify";
import { useTranslations } from "@/i18n/T";

const POLLING_INTERVAL_MS = 30000;

export function ImpersonationConsentModal() {
  const { user, userProfile } = useAuth();
  const t = useTranslations("components.impersonation.consent");
  const { isPlatformTourActive } = usePlatformExperience();
  const [pending, setPending] = useState<SupportAccessRequest[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  const currentRequest = useMemo(() => pending[0] || null, [pending]);
  const canPollRequests = Boolean(user?.uid && userProfile?.uid);

  useEffect(() => {
    if (!canPollRequests || isPlatformTourActive) return;

    let cancelled = false;
    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const data = await getPendingImpersonationRequests();
        if (!cancelled) setPending(data);
      } catch {
        if (!cancelled) setPending([]);
      }
    };

    void run();
    const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canPollRequests, isPlatformTourActive]);

  if (isPlatformTourActive) return null;

  const handleRespond = async (approved: boolean) => {
    if (!currentRequest) return;
    setIsResponding(true);
    try {
      await respondImpersonationRequest(currentRequest.id, approved);
      setPending((prev) => prev.filter((item) => item.id !== currentRequest.id));
      if (approved) {
        toast.success(t("approved"));
      } else {
        toast.info(t("denied"));
      }
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Dialog open={!!currentRequest} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {currentRequest
              ? t("description", { name: currentRequest.requesterDisplayName, role: currentRequest.requesterRole })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          {t("warning")}
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="destructive"
            disabled={isResponding}
            onClick={() => void handleRespond(false)}
            className="hover:cursor-pointer"
          >
            {t("deny")}
          </Button>
          <Button
            disabled={isResponding}
            onClick={() => void handleRespond(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white hover:cursor-pointer"
          >
            {t("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
