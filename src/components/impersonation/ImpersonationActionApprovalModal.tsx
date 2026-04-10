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
  getPendingImpersonationActionRequests,
  respondImpersonationActionRequest,
  type ImpersonationActionRequest,
} from "@/services/impersonationService";

const POLLING_INTERVAL_MS = 20000;

export function ImpersonationActionApprovalModal() {
  const { user, userProfile } = useAuth();
  const { isPlatformTourActive } = usePlatformExperience();
  const [pending, setPending] = useState<ImpersonationActionRequest[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  const currentRequest = useMemo(() => pending[0] || null, [pending]);
  const canPollRequests = Boolean(user?.uid && userProfile?.uid);

  useEffect(() => {
    if (!canPollRequests || isPlatformTourActive) return;

    let cancelled = false;
    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const data = await getPendingImpersonationActionRequests();
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
      await respondImpersonationActionRequest(currentRequest.id, approved);
      setPending((prev) => prev.filter((item) => item.id !== currentRequest.id));
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Dialog open={!!currentRequest} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprovar alteração do suporte?</DialogTitle>
          <DialogDescription>
            {currentRequest
              ? `${currentRequest.requesterDisplayName} quer executar: ${currentRequest.actionLabel}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          Apenas aprove se você reconhece esta ação. Toda tentativa fica registrada em log.
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="destructive"
            disabled={isResponding}
            onClick={() => void handleRespond(false)}
            className="hover:cursor-pointer"
          >
            Recusar
          </Button>
          <Button
            disabled={isResponding}
            onClick={() => void handleRespond(true)}
            className="bg-emerald-600 text-white hover:cursor-pointer hover:bg-emerald-700"
          >
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
