"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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

const POLLING_INTERVAL_MS = 30000;

export function ImpersonationConsentModal() {
  const { user, userProfile } = useAuth();
  const [pending, setPending] = useState<SupportAccessRequest[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  const currentRequest = useMemo(() => pending[0] || null, [pending]);
  const canPollRequests = Boolean(user?.uid && userProfile?.uid);

  useEffect(() => {
    if (!canPollRequests) return;

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
  }, [canPollRequests]);

  const handleRespond = async (approved: boolean) => {
    if (!currentRequest) return;
    setIsResponding(true);
    try {
      await respondImpersonationRequest(currentRequest.id, approved);
      setPending((prev) => prev.filter((item) => item.id !== currentRequest.id));
      if (approved) {
        toast.success("Acesso do suporte aprovado.");
      } else {
        toast.info("Acesso do suporte negado.");
      }
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Dialog open={!!currentRequest} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Você solicitou acesso do suporte técnico?</DialogTitle>
          <DialogDescription>
            {currentRequest
              ? `${currentRequest.requesterDisplayName} (${currentRequest.requesterRole}) solicitou acesso temporario para auxiliar sua conta.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          Se você aprovar, a equipe podera visualizar e operar sua tela por tempo limitado com auditoria em log.
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="destructive"
            disabled={isResponding}
            onClick={() => void handleRespond(false)}
            className="hover:cursor-pointer"
          >
            Não solicitei
          </Button>
          <Button
            disabled={isResponding}
            onClick={() => void handleRespond(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white hover:cursor-pointer"
          >
            Sim, autorizar suporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
