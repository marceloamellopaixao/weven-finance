"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  User, Lock, CreditCard, ShieldCheck,
  LogOut, CheckCircle2, AlertTriangle, EyeOff, Loader2, Medal,
  RefreshCw,
  Clock,
  CheckCircle,
  X,
  Info,
  HelpCircle,
  PlayCircle,
  MessageCircle,
  LifeBuoy,
  Lightbulb,
  Sparkles,
  Copy,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";
import { requestOwnAccountDeletion, updateOwnProfile } from "@/services/userService";
import { rememberAccountDeletionRequest } from "@/lib/account-deletion/client";
import { getKeyFingerprint } from "@/lib/crypto";
import { usePlans } from "@/hooks/usePlans";
import { migrateCryptography } from "@/services/transactionService";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sendFeatureRequest, sendSupportRequest, subscribeToSupportTickets, type SupportTicket } from "@/hooks/supportService";
import { BillingHistoryItem, cancelSubscription, confirmPreapproval, getBillingHistory } from "@/services/billingService";
import { buildUpgradeCheckoutPath } from "@/services/billing/checkoutIntent";
import { useImpersonation } from "@/hooks/useImpersonation";
import { sendPasswordAccessEmail } from "@/services/auth/passwordAccess";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion/policy";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useAppearance } from "@/hooks/useAppearance";
import { AppearanceAccent, AppearanceThemeMode } from "@/types/appearance";

// Tipo para feedback
type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

const APPEARANCE_THEME_OPTIONS: Array<{
  value: AppearanceThemeMode;
  label: string;
  description: string;
  icon: typeof Monitor;
}> = [
    { value: "system", label: "Automático (sistema)", description: "Acompanha o tema do seu celular ou computador.", icon: Monitor },
    { value: "light", label: "Claro", description: "Mais leve para ambientes claros e leitura prolongada.", icon: Sun },
    { value: "dark", label: "Escuro", description: "Mais contraste visual e menos brilho no uso noturno.", icon: Moon },
  ];

const APPEARANCE_ACCENT_OPTIONS: Array<{
  value: AppearanceAccent;
  label: string;
  description: string;
  swatchClass: string;
}> = [
    { value: "violet", label: "Violet", description: "A cor principal da identidade do app.", swatchClass: "from-violet-500 to-fuchsia-500" },
    { value: "indigo", label: "Indigo", description: "Mais frio e discreto.", swatchClass: "from-indigo-500 to-blue-500" },
    { value: "fuchsia", label: "Fuchsia", description: "Mais vibrante e premium.", swatchClass: "from-fuchsia-500 to-pink-500" },
    { value: "emerald", label: "Emerald", description: "Mais limpo e fresco.", swatchClass: "from-emerald-500 to-teal-500" },
    { value: "amber", label: "Amber", description: "Mais quente e chamativo.", swatchClass: "from-amber-500 to-orange-500" },
  ];

export default function SettingsPage() {
  const { user, userProfile, logout, privacyMode, togglePrivacyMode, refreshProfile } = useAuth();
  const { completeTour, isActive: isOnboardingActive, loading: onboardingLoading } = useOnboarding();
  const { appearancePreferences, appearanceLoading, updateAppearance } = useAppearance();
  const { isImpersonating } = useImpersonation();
  const { plans } = usePlans();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isMigrating, setIsMigrating] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [isTabBootstrapped, setIsTabBootstrapped] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [completeName, setCompleteName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [keyFingerprint, setKeyFingerprint] = useState("Carregando identificador seguro...");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);
  const [isConfirmingPreapproval, setIsConfirmingPreapproval] = useState(false);
  const [isAutoReconcilingBilling, setIsAutoReconcilingBilling] = useState(false);
  const [lastAutoBillingAttemptKey, setLastAutoBillingAttemptKey] = useState("");
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [isLoadingBillingHistory, setIsLoadingBillingHistory] = useState(false);
  const [billingHistoryPage, setBillingHistoryPage] = useState(1);
  const [billingHistoryPerPage] = useState(8);
  const [billingHistoryTotal, setBillingHistoryTotal] = useState(0);

  // Estados para Suporte
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // Estados para Ideias/Features
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [featureMessage, setFeatureMessage] = useState("");
  const [isSendingFeature, setIsSendingFeature] = useState(false);
  const [isCopyingSwaggerToken, setIsCopyingSwaggerToken] = useState(false);
  const [isSendingPasswordEmail, setIsSendingPasswordEmail] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [mySupportTickets, setMySupportTickets] = useState<SupportTicket[]>([]);
  const [isLoadingMySupportTickets, setIsLoadingMySupportTickets] = useState(false);
  const [mySupportPage, setMySupportPage] = useState(1);
  const [mySupportPerPage] = useState(8);
  const [mySupportTotal, setMySupportTotal] = useState(0);

  // Estado para feedback modal
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });
  const effectiveProfileUid = userProfile?.uid || user?.uid || "";
  const effectiveProfileEmail = isImpersonating
    ? (userProfile?.email || "")
    : (userProfile?.email || user?.email || "");
  const effectiveProfileDisplayName = isImpersonating
    ? (userProfile?.displayName || "Usuário")
    : (userProfile?.displayName || user?.displayName || "Usuário");

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  usePlatformTour({
    route: "settings",
    disabled: onboardingLoading || isOnboardingActive,
    onComplete: completeTour,
  });

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile?.displayName);
      setCompleteName(userProfile?.completeName);
      setPhone(normalizePhone(userProfile?.phone));
    }
  }, [userProfile]);

  useEffect(() => {
    if (effectiveProfileUid) {
      getKeyFingerprint(effectiveProfileUid).then(setKeyFingerprint);
    }
  }, [effectiveProfileUid]);

  const showFeedback = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setFeedbackModal({ isOpen: true, type, title, message });
  };

  const formatBillingEventLabel = (item: BillingHistoryItem) => {
    const action = item.action.toLowerCase();
    const eventType = item.eventType.toLowerCase();
    const paymentStatus = (item.paymentStatus || "").toLowerCase();

    if (action.includes("cancel")) return "Assinatura cancelada";
    if (action.includes("confirm") || action.includes("authorized")) return "Assinatura confirmada";
    if (action.includes("pending") || paymentStatus === "pending") return "Pagamento pendente";
    if (action.includes("rejected") || action.includes("fail") || paymentStatus === "rejected") return "Pagamento recusado";
    if (eventType.includes("subscription")) return "Atualização de assinatura";
    return "Evento de cobrança";
  };

  const formatSupportStatus = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return "Pendente";
    if (normalized === "in_progress") return "Em progresso";
    if (normalized === "resolved") return "Resolvido";
    if (normalized === "rejected") return "Rejeitado";
    if (normalized === "under_review") return "Em análise";
    if (normalized === "approved") return "Aprovado";
    if (normalized === "implemented") return "Implementado";
    return "Aberto";
  };

  const getSupportStatusBadgeClass = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "resolved" || normalized === "approved" || normalized === "implemented") {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
    if (normalized === "rejected") {
      return "bg-red-100 text-red-700 border-red-200";
    }
    if (normalized === "in_progress" || normalized === "under_review") {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    return "bg-amber-100 text-amber-700 border-amber-200";
  };

  const handleTabChange = (tab: "account" | "billing" | "security" | "help") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateOwnProfile(effectiveProfileUid, {
        displayName: displayName.trim(),
        completeName: completeName.trim(),
        phone: normalizePhone(phone),
      });
      await refreshProfile();
      showFeedback('success', 'Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      showFeedback('error', 'Erro', 'Falha ao salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);

    try {
      const token = await user?.getIdToken();
      await requestOwnAccountDeletion(token);
      rememberAccountDeletionRequest();
      await refreshProfile();
      router.push("/goodbye");
    } catch (error) {
      let errorMessage = "Ocorreu um erro ao tentar excluir sua conta.";
      if (error instanceof Error) errorMessage = error.message;
      showFeedback('error', 'Erro na Exclusão', errorMessage);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setIsCancelingSubscription(true);
    try {
      const token = await user?.getIdToken();
      await cancelSubscription(token);
      showFeedback("success", "Assinatura cancelada", "Seu plano foi alterado para Free.");
    } catch (error) {
      console.error(error);
      showFeedback("error", "Falha no cancelamento", "Não foi possível cancelar a assinatura agora.");
    } finally {
      setIsCancelingSubscription(false);
    }
  };

  const handleMigration = async () => {
    if (!user) return;
    setIsMigrating(true);
    try {
      const count = await migrateCryptography(effectiveProfileUid);
      showFeedback('success', 'Migração Concluída', `${count} transações foram atualizadas para a nova segurança.`);
    } catch (e) {
      console.error(e);
      showFeedback('error', 'Erro na Migração', 'Não foi possível completar a migração de criptografia.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAppearanceChange = async (
    patch: Partial<{ themeMode: AppearanceThemeMode; accent: AppearanceAccent }>
  ) => {
    setIsSavingAppearance(true);
    try {
      await updateAppearance((current) => ({ ...current, ...patch }));
    } catch (error) {
      console.error("Erro ao salvar aparência:", error);
      showFeedback("error", "Falha ao aplicar aparência", "Não foi possível salvar seu tema agora.");
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const handlePasswordAccess = async () => {
    if (!user?.email || isImpersonating) return;
    setIsSendingPasswordEmail(true);
    try {
      await sendPasswordAccessEmail(user.email, "change-password");
      router.push("/first-access?intent=change-password&requested=1");
    } catch (error) {
      console.error("Erro ao enviar link de senha:", error);
      showFeedback("error", "Falha ao enviar link", "Não foi possível enviar o link para definir sua nova senha.");
    } finally {
      setIsSendingPasswordEmail(false);
    }
  };

  const handleReplayTour = () => {
    router.push("/apps#tour-guided");
  };

  const handleCopySwaggerToken = async () => {
    if (!user) return;
    setIsCopyingSwaggerToken(true);
    try {
      const token = await user?.getIdToken(true);
      await navigator.clipboard.writeText(token);
      showFeedback("success", "Token copiado", "Cole no Authorize do Swagger sem o prefixo Bearer.");
    } catch (error) {
      console.error("Erro ao copiar token para Swagger:", error);
      showFeedback("error", "Falha ao copiar token", "Não foi possível copiar o token agora.");
    } finally {
      setIsCopyingSwaggerToken(false);
    }
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim()) {
      showFeedback('error', 'Mensagem Vazia', 'Por favor, descreva o motivo do contato.');
      return;
    }

    if (!user) return;

    setIsSendingSupport(true);
    try {
      const result = await sendSupportRequest(
        effectiveProfileUid,
        effectiveProfileEmail || "E-mail não disponível",
        userProfile?.displayName || "Usuário sem nome",
        supportMessage
      );
      setIsSupportModalOpen(false);
      setSupportMessage("");
      showFeedback(
        'success',
        'Solicitação Enviada',
        `Nossa equipe de suporte entrará em contato em breve.${result.protocol ? ` Protocolo: ${result.protocol}.` : ''}`
      );
    } catch (error) {
      console.error("Erro ao enviar solicitação de suporte:", error);
      showFeedback('error', 'Erro', 'Não foi possível enviar a solicitação. Tente novamente mais tarde.');
    } finally {
      setIsSendingSupport(false);
    }
  }; const handleSendFeature = async () => {
    if (!featureMessage.trim()) {
      showFeedback('error', 'Campo Obrigatório', 'Por favor, descreva sua ideia.');
      return;
    }
    if (!user) return;

    setIsSendingFeature(true);
    try {
      const result = await sendFeatureRequest(
        effectiveProfileUid,
        effectiveProfileEmail || "Sem email",
        userProfile?.displayName || "Usuário",
        featureMessage
      );
      setIsFeatureModalOpen(false);
      setFeatureMessage("");
      showFeedback(
        'success',
        'Ideia Recebida!',
        `Obrigado por contribuir! Sua sugestão foi enviada para nosso time de produto.${result.protocol ? ` Protocolo: ${result.protocol}.` : ''}`
      );
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro', 'Não foi possível enviar sua sugestão. Tente novamente.');
    } finally {
      setIsSendingFeature(false);
    }
  };

  const handleStartCheckout = async (plan: "premium" | "pro") => {
    if (!user) {
      showFeedback("error", "Sessão expirada", "Faça login novamente para continuar.");
      return;
    }
    if (isBillingExemptRole) {
      showFeedback("info", "Conta isenta", "Administradores e moderadores não precisam de pagamento.");
      return;
    }

    setIsOpeningCheckout(plan);
    
    try {
      router.push(buildUpgradeCheckoutPath(plan));
    } catch (error) {
      console.error(error);
      showFeedback("error", "Falha no checkout", "Não foi possível abrir o pagamento agora.");
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  const handleConfirmPreapproval = async (
    preapprovalId?: string,
    expectedPlan?: "premium" | "pro",
    checkoutAttemptId?: string
  ) => {
    if (!user) return;

    setIsConfirmingPreapproval(true);
    try {
      const token = await user?.getIdToken();
      const result = await confirmPreapproval(
        preapprovalId?.trim() || pendingPreapprovalId,
        token,
        expectedPlan,
        checkoutAttemptId
      );
      await refreshProfile();
      showFeedback("success", "Assinatura confirmada", `Plano atualizado para ${result.targetPlan}.`);
    } catch (error) {
      console.error(error);
      showFeedback("error", "Falha na confirmação", "Não foi possível validar a assinatura agora.");
    } finally {
      setIsConfirmingPreapproval(false);
    }
  };

  const currentPlan = userProfile?.plan || "free";
  const isBillingExemptRole = userProfile?.role === "admin" || userProfile?.role === "moderator";
  const showSwaggerTokenButton =
    process.env.NODE_ENV === "development" &&
    (userProfile?.role === "admin" || userProfile?.role === "moderator");
  const effectivePlan = isBillingExemptRole ? "pro" : currentPlan;
  const billingPaymentStatus = userProfile?.billing?.paymentStatus;
  const effectivePaymentStatus = isBillingExemptRole
    ? "free"
    : billingPaymentStatus === "failed"
      ? "not_paid"
      : (userProfile?.paymentStatus || billingPaymentStatus || "pending");
  const canUpgrade = !isBillingExemptRole && effectivePlan !== "pro";
  const planRoleLabel = effectivePlan === "free"
    ? "Registrar"
    : effectivePlan === "premium"
      ? "Organizar"
      : "Decidir";
  const planValueSummary = effectivePlan === "free"
    ? "Registre o essencial do mês e sinta valor rápido sem complicação."
    : effectivePlan === "premium"
      ? "Organize cartões, parcelas, vencimentos e metas com mais clareza."
      : "Decida melhor no dia a dia com direção prática para gastar com mais segurança.";
  const pendingPreapprovalId = userProfile?.billing?.pendingPreapprovalId;
  const pendingCheckoutAttemptId = userProfile?.billing?.pendingCheckoutAttemptId;
  const pendingPlan = userProfile?.billing?.pendingPlan;
  const recoveryPlan: "premium" | "pro" =
    pendingPlan === "pro" || currentPlan === "pro" ? "pro" : "premium";
  const shouldShowRecoveryCTA =
    !isBillingExemptRole &&
    (effectivePaymentStatus === "pending" ||
      effectivePaymentStatus === "overdue" ||
      effectivePaymentStatus === "not_paid");

  const handleRecoverPayment = async () => {
    if (pendingPreapprovalId || pendingCheckoutAttemptId) {
      await handleConfirmPreapproval(pendingPreapprovalId, recoveryPlan, pendingCheckoutAttemptId);
      return;
    }
    await handleStartCheckout(recoveryPlan);
  };

  useEffect(() => {
    if (isTabBootstrapped) return;
    const tab = searchParams.get("tab");
    if (tab === "account" || tab === "billing" || tab === "security" || tab === "help") {
      setActiveTab(tab);
    }
    setIsTabBootstrapped(true);
  }, [isTabBootstrapped, searchParams]);

  useEffect(() => {
    if (!isTabBootstrapped) return;
    const tab = searchParams.get("tab");
    if (tab !== activeTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [activeTab, isTabBootstrapped, pathname, router, searchParams]);

  useEffect(() => {
    if (!user || !userProfile || activeTab !== "help") return;
    setIsLoadingMySupportTickets(true);
    const unsubscribe = subscribeToSupportTickets(
      effectiveProfileUid,
      userProfile.role,
      (result) => {
        setMySupportTickets(
          result.tickets
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        );
        setMySupportTotal(result.total);
        setIsLoadingMySupportTickets(false);
      },
      {
        page: mySupportPage,
        limit: mySupportPerPage,
      },
      () => {
        setIsLoadingMySupportTickets(false);
      }
    );
    return () => unsubscribe();
  }, [activeTab, effectiveProfileUid, mySupportPage, mySupportPerPage, user, userProfile]);

  useEffect(() => {
    if (activeTab !== "help") return;
    setMySupportPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "billing") return;
    if (isBillingExemptRole) return;
    if (!shouldShowRecoveryCTA) return;
    if (isConfirmingPreapproval || isAutoReconcilingBilling) return;
    if (!pendingPreapprovalId && !pendingCheckoutAttemptId) return;

    const autoAttemptKey = [
      effectiveProfileUid,
      pendingCheckoutAttemptId || "",
      pendingPreapprovalId || "",
      pendingPlan || "",
      effectivePaymentStatus,
    ].join(":");

    if (!autoAttemptKey.replace(/:/g, "")) return;
    if (autoAttemptKey === lastAutoBillingAttemptKey) return;

    setLastAutoBillingAttemptKey(autoAttemptKey);
    setIsAutoReconcilingBilling(true);

    const run = async () => {
      try {
        const token = await user.getIdToken();
        await confirmPreapproval(undefined, token, recoveryPlan, pendingCheckoutAttemptId);
        await refreshProfile();
      } catch (error) {
        console.error("Falha na reconciliação automática da assinatura:", error);
      } finally {
        setIsAutoReconcilingBilling(false);
      }
    };

    void run();
  }, [
    activeTab,
    effectivePaymentStatus,
    effectiveProfileUid,
    isAutoReconcilingBilling,
    isBillingExemptRole,
    isConfirmingPreapproval,
    lastAutoBillingAttemptKey,
    pendingCheckoutAttemptId,
    pendingPlan,
    pendingPreapprovalId,
    recoveryPlan,
    refreshProfile,
    shouldShowRecoveryCTA,
    user,
  ]);

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "billing") return;
    if (isBillingExemptRole) return;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        setIsLoadingBillingHistory(true);
        const token = await user?.getIdToken();
        const historyPage = await getBillingHistory(token, {
          page: billingHistoryPage,
          limit: billingHistoryPerPage,
        });
        if (!cancelled) {
          setBillingHistory(historyPage.history);
          setBillingHistoryTotal(historyPage.total);
        }
      } catch (error) {
        console.error("Erro ao carregar histórico de cobrança:", error);
        if (!cancelled) {
          setBillingHistory([]);
          setBillingHistoryTotal(0);
        }
      } finally {
        if (!cancelled) setIsLoadingBillingHistory(false);
      }
    };

    void loadHistory();
    const timer = setInterval(() => void loadHistory(), 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab, billingHistoryPage, billingHistoryPerPage, isBillingExemptRole, user]);

  useEffect(() => {
    if (activeTab !== "billing") return;
    setBillingHistoryPage(1);
  }, [activeTab]);

  return (
    <div className="font-sans p-4 md:p-8 pb-28 md:pb-32">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div id="tour-settings-header" className={`${fadeInUp} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Configurações</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Gerencie sua conta, privacidade e assinatura.</p>
          </div>
          <Button
            variant="destructive"
            onClick={logout}
            className="gap-2 rounded-xl shadow-sm hover:shadow-red-500/20 transition-all hover:cursor-pointer hover:scale-105 duration-200"
          >
            <LogOut className="h-4 w-4" /> Sair da Conta
          </Button>
        </div>

        {/* Navegação de Abas Personalizada */}
        <div className={`${fadeInUp} delay-150 space-y-6`}>
          <div id="tour-settings-tabs" className="app-panel-subtle grid min-w-full w-full grid-cols-1 gap-1 rounded-2xl border p-1.5 shadow-sm sm:grid-cols-2 md:grid-cols-4">
            <button id="tour-settings-account-tab" type="button" aria-pressed={activeTab === "account"} onClick={() => handleTabChange("account")} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "account" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <User className="h-4 w-4" /> Geral
            </button>
            <button id="tour-settings-billing-tab" type="button" aria-pressed={activeTab === "billing"} onClick={() => handleTabChange("billing")} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "billing" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <CreditCard className="h-4 w-4" /> Planos
            </button>
            <button id="tour-settings-security-tab" type="button" aria-pressed={activeTab === "security"} onClick={() => handleTabChange("security")} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "security" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <ShieldCheck className="h-4 w-4" /> Privacidade
            </button>
            <button id="tour-settings-help-tab" type="button" aria-pressed={activeTab === "help"} onClick={() => handleTabChange("help")} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "help" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <HelpCircle className="h-4 w-4" /> Ajuda
            </button>
          </div>

          {/* ABA GERAL */}
          {activeTab === "account" && (
            <Card id="tour-settings-panel" className={`${zoomIn} delay-200 app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="rounded-full bg-primary/10 p-2"><User className="h-5 w-5 text-primary" /></div> Perfil do Usuário
                </CardTitle>
                <CardDescription>Suas informações pessoais visíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-zinc-50 dark:border-zinc-800 shadow-xl transition-transform duration-300 group-hover:scale-105">
                      <AvatarImage src={isImpersonating ? (userProfile?.photoURL || "") : (userProfile?.photoURL || user?.photoURL || "")} className="object-cover" />
                      <AvatarFallback className="text-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{effectiveProfileDisplayName.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 p-1.5 bg-green-500 border-4 border-white dark:border-zinc-900 rounded-full animate-pulse" title="Online"></div>
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{displayName || "Usuário"}</h3>
                    <p className="text-sm text-zinc-500 font-medium">{effectiveProfileEmail}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                      <Badge variant="secondary" className={`uppercase text-[10px] tracking-wider border ${effectivePlan === 'free' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'border-primary/20 bg-accent text-primary'}`}>
                        {isBillingExemptRole ? "Plano Staff (Isento)" : `Plano ${effectivePlan}`}
                      </Badge>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 gap-1">
                        {(isImpersonating ? userProfile?.verifiedEmail : user?.emailVerified) ? (
                          <><CheckCircle2 className="h-3 w-3" /> Verificado</>
                        ) : (
                          <><X className="h-3 w-3" /> Não Verificado</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Separator className="bg-border/70" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Nome de Exibição (Apelido)</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Nome Completo</Label>
                    <Input value={completeName} onChange={(e) => setCompleteName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Celular</Label>
                    <Input
                      value={formatPhone(phone)}
                      onChange={(e) => setPhone(normalizePhone(e.target.value))}
                      maxLength={15}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">E-mail de Acesso</Label>
                    <Input defaultValue={effectiveProfileEmail || ""} disabled className="h-11 rounded-xl opacity-70 cursor-not-allowed" />
                  </div>
                </div>

                <Separator className="bg-border/70" />
                <div className="app-panel-soft rounded-2xl border p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-primary">
                        <Palette className="h-4 w-4" />
                        <p className="text-sm font-semibold">Aparência do app</p>
                      </div>
                      <p className="text-sm text-zinc-500">
                        Escolha o tema geral e a cor principal para os campos, focos e destaques do app.
                      </p>
                    </div>
                    {isSavingAppearance || appearanceLoading ? (
                      <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando preferência...
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-5">
                    <div className="space-y-3">
                      <Label className="text-zinc-500">Tema</Label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {APPEARANCE_THEME_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const selected = appearancePreferences.themeMode === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => void handleAppearanceChange({ themeMode: option.value })}
                              disabled={appearanceLoading || isSavingAppearance}
                              className={`rounded-2xl border p-4 text-left transition-all ${selected
                                ? "border-primary/35 bg-primary/10 ring-2 ring-primary/15"
                                : "app-panel-subtle hover:border-primary/25 hover:bg-primary/5"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${selected ? "bg-primary text-primary-foreground" : "app-panel-subtle text-zinc-600 dark:text-zinc-300"}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</p>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-zinc-500">{option.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-zinc-500">Cor principal</Label>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {APPEARANCE_ACCENT_OPTIONS.map((option) => {
                          const selected = appearancePreferences.accent === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => void handleAppearanceChange({ accent: option.value })}
                              disabled={appearanceLoading || isSavingAppearance}
                              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected
                                ? "border-primary/35 bg-primary/10 ring-2 ring-primary/15"
                                : "app-panel-subtle hover:border-primary/25 hover:bg-primary/5"
                                }`}
                            >
                              <div className={`h-10 w-10 rounded-2xl bg-linear-to-br ${option.swatchClass}`} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</p>
                                <p className="text-xs leading-5 text-zinc-500">{option.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {!isImpersonating && (
                  <>
                    <Separator className="bg-border/70" />
                    <div className="rounded-2xl border border-primary/15 bg-primary/6 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-primary">
                            <KeyRound className="h-4 w-4" />
                            <p className="text-sm font-semibold">Acesso por senha</p>
                          </div>
                          <p className="text-sm text-primary/80">
                            Receba um link seguro para criar ou trocar sua senha em `/first-access`.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handlePasswordAccess}
                          disabled={isSendingPasswordEmail}
                          className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {isSendingPasswordEmail ? "Enviando link..." : "Alterar senha"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap justify-end gap-2 border-t border-border/70 bg-transparent pt-6">
                {showSwaggerTokenButton && (
                  <Button
                    variant="outline"
                    onClick={handleCopySwaggerToken}
                    disabled={isCopyingSwaggerToken}
                    className="rounded-xl px-4 h-11 hover:cursor-pointer"
                  >
                    {isCopyingSwaggerToken ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copiar Token Swagger
                  </Button>
                )}
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 h-11 shadow-lg shadow-primary/10 transition-all active:scale-95 hover:cursor-pointer duration-200">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* ABA PLANOS */}
          {activeTab === "billing" && (
            <div id="tour-settings-panel" className={`${fadeInUp} delay-200 space-y-6`}>
              <Card
                className={`border-none shadow-xl rounded-3xl relative overflow-hidden text-white flex flex-col justify-center min-h-2.5 ${effectivePlan === "free"
                  ? "bg-linear-to-br from-amber-700 to-amber-900 shadow-amber-700/30"
                  : effectivePlan === "premium"
                    ? "bg-linear-to-br from-slate-600 to-slate-800 shadow-slate-500/30"
                    : "bg-linear-to-br from-yellow-500 to-amber-600 shadow-yellow-500/30"
                  }`}
              >
                <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <CardHeader className="relative z-10 flex-1 flex items-center">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">

                    {/* BLOCO PRINCIPAL */}
                    <div className="space-y-3">
                      <CardTitle className="text-3xl font-bold flex items-center gap-3">
                        {effectivePlan === 'free' && <Medal className="h-8 w-8 text-amber-400" />}
                        {effectivePlan === 'premium' && <Medal className="h-8 w-8 text-slate-200" />}
                        {effectivePlan === 'pro' && <Medal className="h-8 w-8 text-yellow-300" />}
                        <span>
                          Plano{' '}
                          <span className="opacity-90">
                            {isBillingExemptRole ? "Staff" : effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1)}
                          </span>
                        </span>
                      </CardTitle>

                      {!isBillingExemptRole && (
                        <Badge className="w-fit border-none bg-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/85">
                          {planRoleLabel}
                        </Badge>
                      )}

                      <CardDescription className="text-base text-white/75 max-w-md leading-relaxed">
                        {effectivePlan === 'free'
                          ? planValueSummary
                          : isBillingExemptRole ? 'Conta da equipe com acesso isento de cobrança.' : planValueSummary}
                      </CardDescription>
                    </div>

                    {/* FEATURES */}
                    {plans[effectivePlan].features && (
                      <nav className="lg:pt-0">
                        <ul className="space-y-2 text-sm text-white/70">
                          {plans[effectivePlan].features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-white/60" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    )}

                    {/* STATUS / BADGES */}
                    <div className="flex flex-col gap-2 items-start lg:items-end">

                      {/* Status pagamento */}
                      <Badge className="bg-white/15 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        {isBillingExemptRole && (
                          <>
                            <ShieldCheck className="h-4 w-4 text-emerald-300" />
                            Isento de Pagamento
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'paid' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-300" />
                            Pagamento Confirmado
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'pending' && (
                          <>
                            <Clock className="h-4 w-4 text-amber-300" />
                            Pagamento Pendente
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'overdue' && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                            Pagamento Atrasado
                          </>
                        )}

                        {!isBillingExemptRole && (effectivePaymentStatus === 'not_paid' || effectivePaymentStatus === 'canceled') && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                            Pagamento com Falha
                          </>
                        )}
                      </Badge>

                      {/* Plano ativo */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        {userProfile?.status === 'active' ? (
                          <><CheckCircle className="h-4 w-4 text-white/70" />Plano {effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1)} Ativo</>
                        ) : (
                          <><AlertTriangle className="h-4 w-4 text-white/70" />Plano {effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1)} Inativo</>
                        )}

                      </Badge>

                      {/* Renovação */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        {(isBillingExemptRole || effectivePaymentStatus === 'paid') ? (
                          <>
                            <RefreshCw className="h-4 w-4 text-white/70" /> Renovação Automática
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-white/70" /> Renovação Desativada
                          </>
                        )}
                      </Badge>

                    </div>
                  </div>
                </CardHeader>
                <CardContent className="z-10 relative space-y-3">
                  {!isBillingExemptRole && effectivePlan === "free" && (
                    <div className="mt-4">
                      <p className="text-sm text-zinc-300 mb-2">
                        Free registra o básico. Premium organiza cartões, parcelas, vencimentos e metas. Pro adiciona direção diária para você decidir melhor.
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl border border-white/15 bg-black/10 p-3 text-xs text-white/85 space-y-1">
                    {isBillingExemptRole && (
                      <>
                        <p>
                          Regra de cobrança: <strong>Isento para {userProfile?.role === "admin" ? "Admin" : "Moderador"}</strong>
                        </p>
                        <p>
                          Origem do plano:{" "}
                          <strong>
                            {userProfile?.billing?.source === "mercadopago_webhook"
                              ? "Webhook Mercado Pago"
                              : userProfile?.billing?.source === "mercadopago_confirm"
                                ? "Confirmação Mercado Pago"
                                : userProfile?.billing?.source === "mercadopago_cancel"
                                  ? "Cancelamento Mercado Pago"
                                  : userProfile?.billing?.source === "system"
                                    ? "Sistema"
                                    : "Administração manual"}
                          </strong>
                        </p>
                      </>
                    )}
                    <p>
                      Última atualização da assinatura:{" "}
                      <strong>{userProfile?.billing?.lastSyncAt ? new Date(userProfile?.billing?.lastSyncAt).toLocaleString() : "Ainda sem atualização automática"}</strong>
                    </p>
                  </div>
                  {shouldShowRecoveryCTA && (
                    <div className="rounded-xl border border-amber-200/30 bg-amber-500/10 p-3 text-xs text-white/90 space-y-2">
                      <p className="font-semibold">
                        {isAutoReconcilingBilling ? "Verificando sua assinatura..." : "Pagamento em aberto detectado."}
                      </p>
                      <p>
                        {isAutoReconcilingBilling
                          ? "Estamos tentando confirmar automaticamente seu pagamento no Mercado Pago."
                          : "Se a confirmação automática atrasar, você pode pedir uma nova verificação sem preencher códigos."}
                      </p>
                      <Button
                        onClick={() => void handleRecoverPayment()}
                        disabled={isOpeningCheckout !== null || isConfirmingPreapproval || isAutoReconcilingBilling}
                        className="h-9 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        {isAutoReconcilingBilling
                          ? "Verificando automaticamente..."
                          : isConfirmingPreapproval
                            ? "Validando pagamento..."
                            : isOpeningCheckout
                              ? "Abrindo checkout..."
                              : effectivePaymentStatus === "pending"
                                ? "Verificar assinatura novamente"
                                : "Regularizar pagamento agora"}
                      </Button>
                    </div>
                  )}
                  {!isBillingExemptRole && effectivePlan !== "free" && (
                    <div className="pt-1">
                      <Button
                        onClick={() => setShowCancelSubscriptionModal(true)}
                        disabled={isCancelingSubscription}
                        className="h-9 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isCancelingSubscription ? "Cancelando assinatura..." : "Cancelar Assinatura"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!isBillingExemptRole && (
                <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-600" /> Histórico de cobrança
                    </CardTitle>
                    <CardDescription>
                      Últimos eventos de assinatura e pagamento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isLoadingBillingHistory ? (
                      <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando histórico...
                      </div>
                    ) : billingHistory.length === 0 ? (
                      <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                        Nenhum evento encontrado.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {billingHistory.map((item) => (
                          <div key={item.id} className="app-panel-subtle rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">{formatBillingEventLabel(item)}</p>
                              <Badge variant="secondary" className="text-[10px] uppercase">
                                {item.paymentStatus || "n/a"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Data indisponível"}
                              {item.plan ? ` • Plano ${item.plan}` : ""}
                              {typeof item.amount === "number" ? ` • ${item.currency || "BRL"} ${item.amount.toFixed(2)}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!isLoadingBillingHistory && billingHistoryTotal > billingHistoryPerPage && (
                      <div className="app-panel-subtle mt-2 flex items-center justify-between rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                        <p className="text-xs text-zinc-500">
                          Página {billingHistoryPage} de {Math.max(1, Math.ceil(billingHistoryTotal / billingHistoryPerPage))} • {billingHistoryTotal} evento(s)
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            disabled={billingHistoryPage <= 1}
                            onClick={() => setBillingHistoryPage((prev) => Math.max(1, prev - 1))}
                          >
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            disabled={billingHistoryPage >= Math.ceil(billingHistoryTotal / billingHistoryPerPage)}
                            onClick={() =>
                              setBillingHistoryPage((prev) =>
                                Math.min(Math.ceil(billingHistoryTotal / billingHistoryPerPage), prev + 1)
                              )
                            }
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {canUpgrade && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="app-panel-subtle rounded-2xl border-slate-200 bg-slate-50/80 px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Free</p>
                      <p className="mt-2 text-base font-semibold text-zinc-900">Registrar</p>
                      <p className="mt-1 text-sm text-zinc-600">Para sair do caos e registrar o essencial do mês.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Premium</p>
                      <p className="mt-2 text-base font-semibold text-zinc-900">Organizar</p>
                      <p className="mt-1 text-sm text-zinc-600">Para controlar cartões, parcelas, vencimentos e metas com clareza.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600">Pro</p>
                      <p className="mt-2 text-base font-semibold text-zinc-900">Decidir</p>
                      <p className="mt-1 text-sm text-zinc-600">Para saber quanto ainda pode gastar hoje e agir com mais segurança.</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {effectivePlan !== 'premium' && (
                      <Card className="app-panel-soft relative overflow-hidden h-full flex flex-col border-2 border-slate-300/40 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all rounded-3xl group transform hover:-translate-y-1 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-400" />
                        <CardHeader className="flex-1">
                          <CardTitle className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <Medal className="h-5 w-5 text-slate-500" /> Premium · Organizar
                            </span>
                            <span className="text-xl font-bold text-zinc-900 dark:text-white">
                              R$ {plans.premium.price.toFixed(2).toString().replace(".", ",")}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            {plans.premium.description}
                          </CardDescription>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            Ideal para quem quer parar de se perder em cartões, parcelas e vencimentos.
                          </p>
                          <nav>
                            {plans.premium.features &&
                              (
                                <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                                  {plans.premium.features.map((feature, index) => (
                                    <li key={index} className="flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-slate-500" /> {feature}
                                    </li>
                                  ))}
                                </ul>
                              )}
                          </nav>
                        </CardHeader>
                        <CardFooter className="mt-auto">
                          <Button
                            onClick={() => handleStartCheckout("premium")}
                            disabled={isOpeningCheckout === "premium"}
                            className="w-full h-11 rounded-xl bg-slate-600 hover:bg-slate-700 text-white shadow-lg shadow-slate-500/20 hover:cursor-pointer transition-all active:scale-[0.98]"
                          >
                            {isOpeningCheckout === "premium" ? "Abrindo checkout..." : "Ir para o Premium"}
                          </Button>
                        </CardFooter>
                      </Card>
                    )}
                    <Card className="app-panel-soft relative overflow-hidden h-full flex flex-col border-2 border-yellow-300/40 dark:border-yellow-700/30 shadow-lg hover:shadow-xl transition-all rounded-3xl group transform hover:-translate-y-1 duration-300">
                      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />
                      <CardHeader className="flex-1">
                        <CardTitle className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <Medal className="h-5 w-5 text-yellow-500" /> Pro · Decidir
                          </span>
                          <span className="text-xl font-bold text-zinc-900 dark:text-white">
                            R$ {plans.pro.price.toFixed(2).toString().replace(".", ",")}
                          </span>
                        </CardTitle>
                        <CardDescription>
                          {plans.pro.description}
                        </CardDescription>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-yellow-600">
                          Ideal para quem quer direção prática no dia a dia, não só histórico do mês.
                        </p>
                        <nav>
                          {plans.pro.features &&
                            (
                              <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                                {plans.pro.features.map((feature, index) => (
                                  <li key={index} className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-yellow-500" /> {feature}
                                  </li>
                                ))}
                              </ul>
                            )}
                        </nav>
                      </CardHeader>
                      <CardFooter className="mt-auto">
                        <Button
                          onClick={() => handleStartCheckout("pro")}
                          disabled={isOpeningCheckout === "pro"}
                          variant="outline"
                          className="w-full h-11 rounded-xl border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:cursor-pointer transition-all active:scale-[0.98]"
                        >
                          {isOpeningCheckout === "pro" ? "Abrindo checkout..." : "Ir para o Pro"}
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA SEGURANÇA */}
          {activeTab === "security" && (
            <Card id="tour-settings-panel" className={`${zoomIn} delay-200 app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Privacidade de Dados
                </CardTitle>
                <CardDescription>
                  Controle como seus dados são exibidos e armazenados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">

                <div className="app-panel-subtle flex items-center justify-between rounded-2xl border p-5 transition-all hover:border-primary/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><EyeOff className="h-5 w-5 text-zinc-600 dark:text-zinc-400" /><Label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Modo Discreto (Blur)</Label></div>
                    <p className="text-sm text-zinc-500">Oculta valores monetários no Dashboard para privacidade.</p>
                  </div>
                  <Switch checked={privacyMode} onCheckedChange={togglePrivacyMode} className="hover:cursor-pointer" />
                </div>
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /><h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Segurança de Dados</h3></div>
                  <div className="p-5 rounded-2xl bg-zinc-950 text-zinc-400 font-mono text-xs break-all relative border border-zinc-800 shadow-inner group transition-all hover:border-zinc-700">
                    <div className="absolute top-3 right-3"><Badge variant="outline" className="text-[10px] border-zinc-700 text-emerald-500 font-bold px-2 py-0.5">PRIVACIDADE NO APP</Badge></div>
                    <p className="mb-2 text-zinc-600 uppercase tracking-widest text-[10px] font-bold">Identificador interno</p>
                    {keyFingerprint}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">* Este identificador ajuda o aplicativo a reconhecer e recuperar dados exibidos como protegidos.</p>
                  <Separator className="bg-zinc-300 dark:bg-zinc-800" />

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Recuperação de dados protegidos
                    </h4>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400 mb-4">
                      Se você trocou de dispositivo e seus dados antigos aparecem como &quot;Dados Protegidos&quot;, clique abaixo.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleMigration}
                      disabled={isMigrating}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-full sm:w-auto hover:cursor-pointer transition-all active:scale-95"
                    >
                      {isMigrating ? "Corrigindo..." : "Corrigir dados protegidos"}
                    </Button>
                  </div>

                </div>
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
                  <h3 className="text-red-600 font-bold text-sm flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4" /> Zona de Perigo</h3>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 rounded-2xl">
                    <p className="text-xs text-red-600/80 dark:text-red-400">A exclusão da conta é <strong>irreversível</strong>. Seu acesso será removido e a conta deixará de existir para você.</p>
                    <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/40 dark:border-red-900 whitespace-nowrap rounded-xl hover:cursor-pointer transition-all active:scale-95">Excluir Minha Conta</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AJUDA & TUTORIAL */}
          {activeTab === "help" && (
            <div id="tour-settings-panel" className={`${fadeInUp} delay-200 space-y-6`}>
              {/* Card de Tutorial */}
              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20 overflow-hidden hover:shadow-2xl transition-shadow">
                <CardHeader className="bg-linear-to-r from-primary/10 to-primary/5 p-4">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <PlayCircle className="h-6 w-6" /> Tutorial Interativo
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-400">
                    Escolha as partes do guia que você quer rever e monte um tour sob medida.
                  </CardDescription>
                </CardHeader>
                <CardContent className="-mt-4">
                  <div className="app-panel-subtle flex flex-col items-center justify-between gap-4 rounded-2xl border border-color:var(--app-panel-border) p-6 shadow-sm sm:flex-row">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Tour da plataforma</h4>
                      <p className="text-sm text-zinc-500">Escolha entre ver tudo ou apenas dashboard, configurações, lançamentos, cartões e metas.</p>
                    </div>
                    <Button
                      onClick={handleReplayTour}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-black/10 hover:scale-105 transition-all"
                    >
                      Escolher Tour
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20 overflow-hidden">
                <CardHeader className="bg-linear-to-r from-primary/10 to-primary/5 p-4">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-6 w-6" /> Explorar o App
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-400">
                    Veja o que cada área faz e personalize a barra rápida com os atalhos que fazem mais sentido para você.
                  </CardDescription>
                </CardHeader>
                <CardContent className="-mt-4">
                  <div className="app-panel-subtle flex flex-col items-center justify-between gap-4 rounded-2xl border border-color:var(--app-panel-border) p-6 shadow-sm sm:flex-row">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Tela de funcionalidades e atalhos</h4>
                      <p className="text-sm text-zinc-500">Acesse a visão geral das páginas e ajuste a barra rápida do seu jeito.</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => router.push("/apps")}
                      variant="outline"
                      className="w-full sm:w-auto rounded-xl border-primary/20 text-primary hover:bg-accent"
                    >
                      Abrir Explorar App
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Suporte e Ideias */}
              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <MessageCircle className="h-5 w-5" /> Fale Conosco
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* WhatsApp */}
                  <a href="https://wa.me/5511992348613" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 group cursor-pointer">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 group-hover:scale-110 transition-transform">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">WhatsApp Suporte</h4>
                      <p className="text-sm text-zinc-500">Fale diretamente com nossa equipe técnica.</p>
                    </div>
                  </a>

                  {/* Solicitar Suporte via Sistema */}
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 text-left transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="rounded-full bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                      <LifeBuoy className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Abrir Chamado</h4>
                      <p className="text-sm text-zinc-500">Relate problemas ou tire dúvidas técnicas.</p>
                    </div>
                  </button>

                  {/* Enviar Ideia / Sugestão */}
                  <button
                    type="button"
                    onClick={() => setIsFeatureModalOpen(true)}
                    className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 text-left transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 group-hover:scale-110 transition-transform">
                      <Lightbulb className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Enviar Ideia ou Sugestão</h4>
                      <p className="text-sm text-zinc-500">Tem uma ideia incrível? Queremos ouvir você.</p>
                    </div>
                  </button>
                </CardContent>
              </Card>

              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <HelpCircle className="h-5 w-5" /> Meus chamados
                  </CardTitle>
                  <CardDescription>
                    Acompanhe o protocolo e o status do atendimento em tempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoadingMySupportTickets ? (
                    <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando chamados...
                    </div>
                  ) : mySupportTickets.length === 0 ? (
                    <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                      Nenhum chamado aberto ainda.
                    </div>
                  ) : (
                    mySupportTickets.map((ticket) => (
                      <div key={ticket.id} className="app-panel-subtle rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            Protocolo {ticket.protocol || `#${ticket.id.slice(0, 8)}`}
                          </p>
                          <Badge variant="outline" className={getSupportStatusBadgeClass(ticket.status)}>
                            {formatSupportStatus(ticket.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{ticket.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {ticket.createdAt.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))
                  )}
                  {!isLoadingMySupportTickets && mySupportTotal > mySupportPerPage && (
                    <div className="app-panel-subtle mt-3 flex items-center justify-between rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                      <p className="text-xs text-zinc-500">
                        Página {mySupportPage} de {Math.max(1, Math.ceil(mySupportTotal / mySupportPerPage))} • {mySupportTotal} chamado(s)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg"
                          disabled={mySupportPage <= 1}
                          onClick={() => setMySupportPage((prev) => Math.max(1, prev - 1))}
                        >
                          Anterior
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg"
                          disabled={mySupportPage >= Math.ceil(mySupportTotal / mySupportPerPage)}
                          onClick={() =>
                            setMySupportPage((prev) => Math.min(Math.ceil(mySupportTotal / mySupportPerPage), prev + 1))
                          }
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Modal de Suporte */}
        <Dialog open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[500px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <LifeBuoy className="h-6 w-6" /> Solicitar Suporte
              </DialogTitle>
              <DialogDescription className="pt-2">
                Descreva seu problema ou dúvida abaixo. Nossa equipe analisará e retornará o contato.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="support-reason">Motivo do Contato</Label>
                <textarea
                  id="support-reason"
                  className="app-field-surface flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-zinc-400"
                  placeholder="Ex: Não consigo editar uma transação parcelada..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                />
              </div>
              <p className="text-xs text-zinc-500">
                * Ao enviar, compartilharemos seu ID de usuário e email para facilitar o atendimento.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsSupportModalOpen(false)} className="w-full rounded-xl sm:w-auto">Cancelar</Button>
              <Button
                onClick={handleSendSupport}
                disabled={isSendingSupport}
                className="w-full rounded-xl bg-primary text-primary-foreground gap-2 hover:bg-primary/90 sm:w-auto"
              >
                {isSendingSupport ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Cancelamento de Assinatura */}
        <Dialog open={showCancelSubscriptionModal} onOpenChange={setShowCancelSubscriptionModal}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Cancelar assinatura
              </DialogTitle>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                Sua assinatura recorrente no Mercado Pago será cancelada.
              </DialogDescription>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                O plano voltará para Free e os recursos Premium/Pro serão removidos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowCancelSubscriptionModal(false)}
                className="rounded-xl h-10 w-full sm:w-auto hover:cursor-pointer transition-all duration-200"
              >
                Manter assinatura
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleCancelSubscription();
                  setShowCancelSubscriptionModal(false);
                }}
                disabled={isCancelingSubscription}
                className="rounded-xl h-10 w-full sm:w-auto bg-red-600 hover:bg-red-700 hover:cursor-pointer transition-all duration-200"
              >
                {isCancelingSubscription ? "Cancelando..." : "Sim, cancelar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Ideia / Feature */}
        <Dialog open={isFeatureModalOpen} onOpenChange={setIsFeatureModalOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[500px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-6 w-6" /> Enviar Sugestão
              </DialogTitle>
              <DialogDescription className="pt-2">
                Compartilhe suas ideias para tornar o WevenFinance ainda melhor. Adoramos inovar com você!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="feature-idea">Sua Ideia Brilhante</Label>
                <textarea
                  id="feature-idea"
                  className="app-field-surface flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-amber-600"
                  placeholder="Ex: Gostaria de ver um gráfico de gastos por categoria..."
                  value={featureMessage}
                  onChange={(e) => setFeatureMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsFeatureModalOpen(false)} className="w-full rounded-xl sm:w-auto">Cancelar</Button>
              <Button
                onClick={handleSendFeature}
                disabled={isSendingFeature}
                className="w-full rounded-xl bg-amber-600 text-white gap-2 hover:bg-amber-700 sm:w-auto"
              >
                {isSendingFeature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                Enviar Ideia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Tem certeza absoluta?
              </DialogTitle>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                Esta ação não pode ser desfeita!
              </DialogDescription>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                Sua conta será encerrada imediatamente e este acesso não poderá mais ser utilizado.
              </DialogDescription>
              <DialogDescription className="pt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Seus dados ficam indisponíveis por até {ACCOUNT_DELETION_GRACE_DAYS} dias para corrigir exclusões acidentais. Após esse prazo, a exclusão permanente acontece automaticamente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl h-10 w-full sm:w-auto hover:cursor-pointer transition-all duration-200">
                Cancelar
              </Button>
              <Button variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="rounded-xl h-10 w-full sm:w-auto bg-red-600 hover:bg-red-700 hover:cursor-pointer transition-all duration-200">
                {isDeleting ? "Excluindo..." : "Sim, excluir conta!"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Genérico de Feedback */}
        <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => !open && setFeedbackModal({ ...feedbackModal, isOpen: false })}>
          <DialogContent className="rounded-2xl sm:max-w-[400px]">
            <DialogHeader>
              <div className={`mx-auto p-3 rounded-full mb-2 w-fit ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : feedbackModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {feedbackModal.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : feedbackModal.type === 'error' ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
              </div>
              <DialogTitle className="text-center">{feedbackModal.title}</DialogTitle>
              <DialogDescription className="text-center pt-2">
                {feedbackModal.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
                className="w-full rounded-xl hover:cursor-pointer transition-all duration-200"
              >
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}




