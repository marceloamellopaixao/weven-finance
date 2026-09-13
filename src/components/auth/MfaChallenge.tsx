"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2, ShieldCheck } from "lucide-react";

import { AuthPageShell, authIconClassName, authPanelClassName } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MfaCodeInput } from "@/components/auth/MfaCodeInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearPostAuthRedirect, readPostAuthRedirect } from "@/services/auth/postAuthRedirect";
import { requestMfaRecovery } from "@/services/auth/mfaRecovery";
import { getSupabaseClient } from "@/services/supabase/client";

export function MfaChallenge() {
  const router = useRouter();
  const [factors, setFactors] = useState<Array<{ id: string; name: string }>>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryProtocol, setRecoveryProtocol] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const attemptedCodeRef = useRef("");
  const recoveryRequestIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabaseClient();
      setLoading(true);
      setError("");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) {
        if (active) {
          setError("Não foi possível verificar sua sessão de segurança.");
          setLoading(false);
        }
        return;
      }
      if (assurance?.currentLevel === "aal2") {
        const destination = readPostAuthRedirect() || "/dashboard";
        clearPostAuthRedirect();
        router.replace(destination);
        return;
      }
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = (data?.totp || [])
        .filter((item) => item.status === "verified")
        .map((item, index) => ({ id: item.id, name: item.friendly_name || `Autenticador ${index + 1}` }));
      if (!active) return;
      if (listError) {
        setError("Não foi possível carregar seus autenticadores.");
        setLoading(false);
        return;
      }
      if (verifiedFactors.length === 0) {
        router.replace("/settings?tab=security&mfa=required");
        return;
      }
      setFactors(verifiedFactors);
      setFactorId(verifiedFactors[0].id);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  const verifyCode = useCallback(async (submittedCode: string) => {
    if (!/^\d{6}$/.test(submittedCode) || !factorId) {
      setError("Digite o código de 6 dígitos do aplicativo autenticador.");
      return;
    }
    const attemptKey = `${factorId}:${submittedCode}`;
    if (attemptedCodeRef.current === attemptKey) return;
    attemptedCodeRef.current = attemptKey;
    setVerifying(true);
    setError("");
    const supabase = getSupabaseClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: submittedCode });
    if (verifyError) {
      setError("Código inválido ou expirado. Aguarde o próximo código e tente novamente.");
      attemptedCodeRef.current = "";
      setCode("");
      setVerifying(false);
      return;
    }
    await supabase.auth.refreshSession();
    const destination = readPostAuthRedirect() || "/dashboard";
    clearPostAuthRedirect();
    window.location.assign(destination);
  }, [factorId]);

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void verifyCode(code);
  };

  const handleCodeChange = (value: string) => {
    const nextCode = value.replace(/\D/g, "").slice(0, 6);
    setCode(nextCode);
    if (error) setError("");
    if (nextCode.length !== 6) attemptedCodeRef.current = "";
    else void verifyCode(nextCode);
  };

  const submitRecovery = async () => {
    setRecoveryBusy(true);
    setRecoveryError("");
    try {
      const protocol = await requestMfaRecovery(recoveryRequestIdRef.current);
      setRecoveryProtocol(protocol);
    } catch (requestError) {
      const reason = requestError instanceof Error ? requestError.message : "";
      setRecoveryError(reason === "rate_limited"
        ? "Você atingiu o limite de solicitações. Tente novamente mais tarde."
        : "Não foi possível enviar a solicitação agora. Tente novamente.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  return (
    <AuthPageShell maxWidthClassName="max-w-[420px]">
      <div className={authPanelClassName}>
        <div className="mb-6 space-y-2 text-center">
          <div className={`${authIconClassName} mb-4`}><ShieldCheck className="h-8 w-8" /></div>
          <h1 className="text-2xl font-bold text-foreground">Verificação em duas etapas</h1>
          <p className="text-sm text-muted-foreground">Abra seu aplicativo autenticador e informe o código atual.</p>
        </div>
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /> Verificando sua conta...</div>
        ) : factors.length === 0 && error ? (
          <div className="space-y-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={() => setLoadAttempt((current) => current + 1)}>Tentar novamente</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={verify}>
            {factors.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="mfa-factor">Autenticador</Label>
                <select id="mfa-factor" value={factorId} onChange={(event) => { setFactorId(event.target.value); setCode(""); setError(""); attemptedCodeRef.current = ""; }} className="app-field-surface h-11 w-full rounded-xl border px-3 text-sm">
                  {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.name}</option>)}
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
              <MfaCodeInput id="mfa-code" value={code} onChange={handleCodeChange} disabled={verifying} invalid={Boolean(error)} autoFocus />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button className="h-11 w-full" type="submit" disabled={verifying}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar acesso
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Perdeu acesso ao aplicativo?
              <br />
              <button type="button" onClick={() => setRecoveryOpen(true)} className="font-medium text-primary underline-offset-4 hover:underline">
                Solicite a recuperação da conta
              </button>
            </div>

          </form>
        )}
      </div>
      <Dialog open={recoveryOpen} onOpenChange={(open) => { setRecoveryOpen(open); if (!open && !recoveryProtocol) setRecoveryError(""); }}>
        <DialogContent className="max-w-[440px] rounded-2xl">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
            <DialogTitle>Recuperar acesso ao MFA</DialogTitle>
            <DialogDescription>
              {recoveryProtocol
                ? "Sua solicitação foi enviada para a equipe de suporte."
                : "Enviaremos uma solicitação segura para a equipe verificar a titularidade da conta. Seus autenticadores não serão removidos automaticamente."}
            </DialogDescription>
          </DialogHeader>
          {recoveryProtocol ? (
            <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
              <p className="font-semibold text-emerald-600">Solicitação registrada</p>
              <p className="mt-1 text-muted-foreground">Protocolo: <strong className="text-foreground">{recoveryProtocol}</strong></p>
              <p className="mt-2 text-muted-foreground">A equipe entrará em contato pelo e-mail cadastrado antes de redefinir o MFA.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/35 p-4 text-sm text-muted-foreground">
              Este processo existe para impedir que apenas o acesso ao e-mail seja suficiente para desativar a segunda etapa de segurança.
            </div>
          )}
          {recoveryError ? <p role="alert" className="text-sm text-destructive">{recoveryError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRecoveryOpen(false)}>{recoveryProtocol ? "Fechar" : "Cancelar"}</Button>
            {!recoveryProtocol ? (
              <Button type="button" onClick={() => void submitRecovery()} disabled={recoveryBusy}>
                {recoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar solicitação
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthPageShell>
  );
}
