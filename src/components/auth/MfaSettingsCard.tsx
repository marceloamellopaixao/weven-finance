"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MfaCodeInput } from "@/components/auth/MfaCodeInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/services/supabase/client";

type PendingEnrollment = { factorId: string; qrCode: string; secret: string };

export function MfaSettingsCard({ required }: { required: boolean }) {
  const [verifiedFactors, setVerifiedFactors] = useState<Array<{ id: string; name: string }>>([]);
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const attemptedCodeRef = useRef("");

  const refresh = useCallback(async () => {
    const { data, error: listError } = await getSupabaseClient().auth.mfa.listFactors();
    if (listError) {
      setError("Não foi possível consultar a autenticação em duas etapas.");
      setLoading(false);
      return;
    }
    setVerifiedFactors((data?.totp || []).filter((factor) => factor.status === "verified").map((factor, index) => ({ id: factor.id, name: factor.friendly_name || `Autenticador ${index + 1}` })));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void getSupabaseClient().auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) {
        setError("Não foi possível consultar a autenticação em duas etapas.");
        setLoading(false);
        return;
      }
      setVerifiedFactors((data?.totp || []).filter((factor) => factor.status === "verified").map((factor, index) => ({ id: factor.id, name: factor.friendly_name || `Autenticador ${index + 1}` })));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const startEnrollment = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    const supabase = getSupabaseClient();
    try {
      // O Supabase preserva fatores não verificados quando uma configuração
      // anterior é interrompida. Eles não aparecem na lista da tela, mas ainda
      // reservam o friendly_name e impedem uma nova tentativa com o mesmo nome.
      const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const allFactors = listed?.all || [];
      const verifiedTotpFactors = listed?.totp || [];
      const incompleteFactors = allFactors.filter(
        (factor) => factor.factor_type === "totp" && factor.status !== "verified",
      );
      for (const factor of incompleteFactors) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (cleanupError) throw cleanupError;
      }

      const usedNames = new Set(
        verifiedTotpFactors.map((factor) => String(factor.friendly_name || "")),
      );
      let nextNumber = 1;
      while (usedNames.has(`WevenFinance ${nextNumber}`)) nextNumber += 1;

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `WevenFinance ${nextNumber}`,
      });
      if (enrollError || !data.totp) throw enrollError || new Error("missing_totp_enrollment");
      setPending({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Não foi possível iniciar uma nova configuração. Atualize a página e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = useCallback(async (submittedCode = code) => {
    if (!pending || !/^\d{6}$/.test(submittedCode)) {
      setError("Digite o código de 6 dígitos exibido no aplicativo autenticador.");
      return;
    }
    const attemptKey = `${pending.factorId}:${submittedCode}`;
    if (attemptedCodeRef.current === attemptKey) return;
    attemptedCodeRef.current = attemptKey;
    setBusy(true); setError("");
    const { error: verifyError } = await getSupabaseClient().auth.mfa.challengeAndVerify({ factorId: pending.factorId, code: submittedCode });
    if (verifyError) {
      setError("Código inválido ou expirado. Tente novamente com o código atual.");
      attemptedCodeRef.current = "";
      setCode("");
    } else {
      await getSupabaseClient().auth.refreshSession();
      setPending(null); setCode(""); setMessage("Autenticação em duas etapas ativada com sucesso.");
      await refresh();
    }
    setBusy(false);
  }, [code, pending, refresh]);

  const handleCodeChange = (value: string) => {
    const nextCode = value.replace(/\D/g, "").slice(0, 6);
    setCode(nextCode);
    if (error) setError("");
    if (nextCode.length !== 6) attemptedCodeRef.current = "";
    else void confirmEnrollment(nextCode);
  };

  const cancelEnrollment = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const { error: unenrollError } = await getSupabaseClient().auth.mfa.unenroll({ factorId: pending.factorId });
    if (unenrollError) {
      setError("Não foi possível cancelar a configuração agora.");
    } else {
      attemptedCodeRef.current = "";
      setPending(null);
      setCode("");
      setError("");
    }
    setBusy(false);
  };

  const removeFactor = async (factor: { id: string; name: string }) => {
    if (required && verifiedFactors.length === 1) {
      setError("Sua função exige autenticação em duas etapas. Adicione outro autenticador antes de remover este.");
      return;
    }
    if (!window.confirm(`Remover “${factor.name}” da sua conta?`)) return;
    setBusy(true); setError(""); setMessage("");
    const supabase = getSupabaseClient();
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") {
      setError("Confirme seu código de segurança novamente antes de remover um autenticador.");
      setBusy(false);
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) setError("Não foi possível remover este autenticador. Confirme novamente seu acesso e tente outra vez.");
    else {
      await supabase.auth.refreshSession();
      setMessage("Autenticador removido com sucesso.");
      await refresh();
    }
    setBusy(false);
  };

  return (
    <div className="app-panel-subtle space-y-4 rounded-2xl border p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-primary" /> Autenticação em duas etapas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Proteja sua conta com códigos gerados no celular.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${verifiedFactors.length > 0 ? "bg-emerald-500/15 text-emerald-600" : pending ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600"}`}>
          {verifiedFactors.length > 0 ? `${verifiedFactors.length} autenticador(es)` : pending ? "Configuração em andamento" : required ? "Obrigatória para sua função" : "Desativada"}
        </span>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {!loading && verifiedFactors.length > 0 ? (
        <div className="space-y-2">
          {verifiedFactors.map((factor) => {
            const isRequiredLastFactor = required && verifiedFactors.length === 1;
            return (
              <div key={factor.id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{factor.name}</p>
                  <p className="text-xs text-muted-foreground">Aplicativo autenticador</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void removeFactor(factor)} disabled={busy || isRequiredLastFactor} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Remover
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
      {!loading && !pending ? (
        <Button type="button" onClick={startEnrollment} disabled={busy}><ShieldCheck className="mr-2 h-4 w-4" /> {verifiedFactors.length > 0 ? "Adicionar autenticador reserva" : "Configurar agora"}</Button>
      ) : null}
      {pending ? (
        <div className="overflow-hidden rounded-2xl border bg-muted/20">
          <div className="border-b bg-muted/30 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold">Conecte seu aplicativo autenticador</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Leva menos de um minuto e a confirmação acontece automaticamente.</p>
          </div>
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
            <div className="mx-auto w-full max-w-[200px] rounded-2xl border bg-white p-3 shadow-sm">
              <Image src={pending.qrCode.trimEnd()} alt="QR Code para configurar o autenticador" width={176} height={176} unoptimized className="h-auto w-full" />
            </div>
            <div className="min-w-0 space-y-5">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
                <div>
                  <p className="text-sm font-medium">Escaneie o QR Code</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Abra seu autenticador, adicione uma conta e leia o código ao lado.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="mfa-manual-secret">Se preferir, use a chave manual</Label>
                  <div className="flex min-w-0 gap-2">
                    <Input id="mfa-manual-secret" readOnly value={pending.secret} className="min-w-0 font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Copiar chave" onClick={() => { void navigator.clipboard.writeText(pending.secret); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <Label htmlFor="mfa-enrollment-code">Confirme o código de 6 dígitos</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">A verificação começa assim que o sexto número for informado.</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <MfaCodeInput id="mfa-enrollment-code" value={code} onChange={handleCodeChange} disabled={busy} invalid={Boolean(error)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <Button type="button" variant="ghost" onClick={() => void cancelEnrollment()} disabled={busy}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmEnrollment()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />} Ativar proteção
            </Button>
          </div>
        </div>
      ) : null}
      {verifiedFactors.length > 0 && required ? <p className="text-xs text-muted-foreground">Sua função exige ao menos um autenticador. Recomendamos cadastrar uma segunda opção de segurança.</p> : null}
      {message ? <p role="status" className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
