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
  UserCheck,
  Sparkles,
  Copy,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Sun,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useState, useEffect, type CSSProperties } from "react";
import { requestOwnAccountDeletion, updateOwnProfile } from "@/services/userService";
import { rememberAccountDeletionRequest } from "@/lib/account-deletion/client";
import { getKeyFingerprint } from "@/lib/crypto";
import { usePlans } from "@/hooks/usePlans";
import { migrateCryptography } from "@/services/transactionService";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sendFeatureRequest, sendSupportRequest, subscribeToSupportTickets, type SupportTicket } from "@/hooks/supportService";
import { BillingHistoryItem, cancelSubscription, confirmPreapproval, getBillingHistory } from "@/services/billingService";
import { buildUpgradeCheckoutPath, parseUpgradePlan } from "@/services/billing/checkoutIntent";
import { useImpersonation } from "@/hooks/useImpersonation";
import { sendPasswordAccessEmail } from "@/services/auth/passwordAccess";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion/policy";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useAppearance } from "@/hooks/useAppearance";
import { AppearanceAccent, AppearanceThemeMode } from "@/types/appearance";
import { useFormatters } from "@/i18n/useFormatters";
import { getPlanPrice } from "@/lib/billing/prices";
import { getLocalizedPlanCopy, getPlanTone } from "@/lib/plans/display";
import { getPublicPlans } from "@/lib/plans/catalog";
import type { UpgradePlan } from "@/services/billing/checkoutIntent";
import { useTranslations } from "@/i18n/T";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { canManageFamilyBilling, canViewFamilyMembers } from "@/lib/workspaces/family";
import { FamilyWorkspacePanel } from "@/components/workspaces/FamilyWorkspacePanel";
import { WorkspaceSettingsPanel } from "@/components/workspaces/WorkspaceSettingsPanel";

// Tipo para feedback
type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

const APPEARANCE_THEME_OPTIONS: Array<{
  value: AppearanceThemeMode;
  labelKey: string;
  descriptionKey: string;
  icon: typeof Monitor;
}> = [
    { value: "system", labelKey: "appearance.system.label", descriptionKey: "appearance.system.description", icon: Monitor },
    { value: "light", labelKey: "appearance.light.label", descriptionKey: "appearance.light.description", icon: Sun },
    { value: "dark", labelKey: "appearance.dark.label", descriptionKey: "appearance.dark.description", icon: Moon },
  ];

const APPEARANCE_ACCENT_OPTIONS: Array<{
  value: AppearanceAccent;
  labelKey: string;
  descriptionKey: string;
  swatchClass: string;
}> = [
    { value: "violet", labelKey: "appearance.violet.label", descriptionKey: "appearance.violet.description", swatchClass: "from-violet-500 to-fuchsia-500" },
    { value: "indigo", labelKey: "appearance.indigo.label", descriptionKey: "appearance.indigo.description", swatchClass: "from-indigo-500 to-blue-500" },
    { value: "fuchsia", labelKey: "appearance.fuchsia.label", descriptionKey: "appearance.fuchsia.description", swatchClass: "from-fuchsia-500 to-pink-500" },
    { value: "emerald", labelKey: "appearance.emerald.label", descriptionKey: "appearance.emerald.description", swatchClass: "from-emerald-500 to-teal-500" },
    { value: "amber", labelKey: "appearance.amber.label", descriptionKey: "appearance.amber.description", swatchClass: "from-amber-500 to-orange-500" },
  ];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tGlobal = useTranslations();
  const { user, userProfile, logout, privacyMode, togglePrivacyMode, refreshProfile } = useAuth();
  const { completeTour, isActive: isOnboardingActive, loading: onboardingLoading } = useOnboarding();
  const { appearancePreferences, appearanceLoading, updateAppearance } = useAppearance();
  const { workspaces, activeWorkspace, loading: workspacesLoading } = useWorkspaces();
  const { isImpersonating } = useImpersonation();
  const { plans } = usePlans();
  const currency = usePreferredCurrency();
  const { date, money } = useFormatters(currency);
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
  const [keyFingerprint, setKeyFingerprint] = useState(t("security.internalIdLoading"));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<UpgradePlan | null>(null);
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
    ? (userProfile?.displayName || t("common.userFallback"))
    : (userProfile?.displayName || user?.displayName || t("common.userFallback"));

  // Constantes de animação.
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";
  const formatPlanPrice = (planId: UpgradePlan) =>
    money(getPlanPrice(planId, currency)?.amount ?? plans[planId].price);
  const canOpenFamilyWorkspaceSettings = workspaces.some((workspace) => {
    if (workspace.status === "archived") return false;
    if (workspace.type !== "family" && !workspace.settings?.familyModeEnabled && !workspace.membership) return false;
    return !workspace.membership || canViewFamilyMembers(workspace.membership);
  });
  const canOpenBillingSettings = !activeWorkspace?.membership || canManageFamilyBilling(activeWorkspace.membership);
  const canOpenSecuritySettings = !activeWorkspace?.membership || activeWorkspace.membership.permissions.includes("settings.manage_security");
  const settingsTabCount = 3 + (canOpenFamilyWorkspaceSettings ? 1 : 0) + (canOpenBillingSettings ? 1 : 0) + (canOpenSecuritySettings ? 1 : 0);

  usePlatformTour({
    route: "settings",
    disabled: onboardingLoading || isOnboardingActive || workspacesLoading,
    stepVisibility: {
      familyWorkspace: canOpenFamilyWorkspaceSettings,
    },
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

    if (action.includes("cancel")) return t("billing.events.canceled");
    if (action.includes("confirm") || action.includes("authorized")) return t("billing.events.confirmed");
    if (action.includes("pending") || paymentStatus === "pending") return t("billing.events.pending");
    if (action.includes("rejected") || action.includes("fail") || paymentStatus === "rejected") return t("billing.events.rejected");
    if (eventType.includes("subscription")) return t("billing.events.subscriptionUpdate");
    return t("billing.events.chargeEvent");
  };

  const formatBillingHistoryStatus = (value: string | null) => {
    const status = String(value || "").toLowerCase();
    if (status === "paid" || status === "approved" || status === "authorized") return t("billing.history.statuses.paid");
    if (status === "pending" || status === "in_process" || status === "processed") return t("billing.history.statuses.pending");
    if (status === "canceled" || status === "cancelled" || status === "cancelled_by_user") return t("billing.history.statuses.canceled");
    if (status === "not_paid" || status === "rejected" || status === "refunded") return t("billing.history.statuses.notPaid");
    if (status === "overdue" || status === "paused") return t("billing.history.statuses.overdue");
    if (status === "failed") return t("billing.history.statuses.failed");
    return value || t("billing.history.unavailable");
  };

  const getBillingHistoryStatusClass = (value: string | null) => {
    const status = String(value || "").toLowerCase();
    if (["paid", "approved", "authorized"].includes(status)) return "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
    if (["pending", "in_process", "processed"].includes(status)) return "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    if (["overdue", "paused"].includes(status)) return "border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300";
    if (["canceled", "cancelled", "cancelled_by_user"].includes(status)) return "border-zinc-500/30 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300";
    if (["not_paid", "rejected", "refunded", "failed"].includes(status)) return "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300";
    return "border-slate-500/30 bg-slate-500/15 text-slate-600 dark:text-slate-300";
  };

  const formatSupportStatus = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return t("supportStatus.pending");
    if (normalized === "in_progress") return t("supportStatus.inProgress");
    if (normalized === "resolved") return t("supportStatus.resolved");
    if (normalized === "rejected") return t("supportStatus.rejected");
    if (normalized === "under_review") return t("supportStatus.underReview");
    if (normalized === "approved") return t("supportStatus.approved");
    if (normalized === "implemented") return t("supportStatus.implemented");
    return t("supportStatus.open");
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

  const formatTicketType = (ticket: SupportTicket) => {
    if (ticket.type === "feature") return t("ticketTypes.feature");
    if (ticket.supportKind === "account_restore") return t("ticketTypes.accountRestore");
    return t("ticketTypes.support");
  };

  const handleTabChange = (tab: "account" | "profiles" | "family" | "billing" | "security" | "help") => {
    if (tab === "family" && !canOpenFamilyWorkspaceSettings) return;
    if (tab === "billing" && !canOpenBillingSettings) return;
    if (tab === "security" && !canOpenSecuritySettings) return;
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
      showFeedback('success', t("feedback.success"), t("feedback.profileSaved"));
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      showFeedback("error", t("feedback.error"), t("feedback.profileSaveError"));
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
      let errorMessage = t("feedback.deleteErrorMessage");
      if (error instanceof Error) errorMessage = error.message;
      showFeedback("error", t("feedback.deleteErrorTitle"), errorMessage);
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
      showFeedback("success", t("feedback.subscriptionCanceledTitle"), t("feedback.subscriptionCanceledMessage"));
    } catch (error) {
      console.error(error);
      showFeedback("error", t("feedback.cancelSubscriptionErrorTitle"), t("feedback.cancelSubscriptionErrorMessage"));
    } finally {
      setIsCancelingSubscription(false);
    }
  };

  const handleMigration = async () => {
    if (!user) return;
    setIsMigrating(true);
    try {
      const count = await migrateCryptography(effectiveProfileUid);
      showFeedback("success", t("feedback.migrationSuccessTitle"), t("feedback.migrationSuccessMessage", { count }));
    } catch (e) {
      console.error(e);
      showFeedback("error", t("feedback.migrationErrorTitle"), t("feedback.migrationErrorMessage"));
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
      showFeedback("error", t("feedback.appearanceErrorTitle"), t("feedback.appearanceErrorMessage"));
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
      showFeedback("error", t("feedback.passwordLinkErrorTitle"), t("feedback.passwordLinkErrorMessage"));
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
      showFeedback("success", t("feedback.tokenCopiedTitle"), t("feedback.tokenCopiedMessage"));
    } catch (error) {
      console.error("Erro ao copiar token para Swagger:", error);
      showFeedback("error", t("feedback.tokenCopyErrorTitle"), t("feedback.tokenCopyErrorMessage"));
    } finally {
      setIsCopyingSwaggerToken(false);
    }
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim()) {
      showFeedback("error", t("feedback.emptyMessageTitle"), t("feedback.emptyMessageText"));
      return;
    }

    if (!user) return;

    setIsSendingSupport(true);
    try {
      const result = await sendSupportRequest(
        effectiveProfileUid,
        effectiveProfileEmail || t("support.unavailableEmail"),
        userProfile?.displayName || t("support.unnamedUser"),
        supportMessage
      );
      setIsSupportModalOpen(false);
      setSupportMessage("");
      showFeedback(
        "success",
        t("feedback.supportSentTitle"),
        t("feedback.supportSentMessage", { protocol: result.protocol ? ` ${t("help.protocol", { protocol: result.protocol })}.` : "" })
      );
    } catch (error) {
      console.error("Erro ao enviar solicitação de suporte:", error);
      showFeedback("error", t("feedback.error"), t("feedback.supportSendError"));
    } finally {
      setIsSendingSupport(false);
    }
  }; const handleSendFeature = async () => {
    if (!featureMessage.trim()) {
      showFeedback("error", t("feedback.requiredFieldTitle"), t("feedback.requiredFieldText"));
      return;
    }
    if (!user) return;

    setIsSendingFeature(true);
    try {
      const result = await sendFeatureRequest(
        effectiveProfileUid,
        effectiveProfileEmail || t("support.unavailableEmail"),
        userProfile?.displayName || t("common.userFallback"),
        featureMessage
      );
      setIsFeatureModalOpen(false);
      setFeatureMessage("");
      showFeedback(
        "success",
        t("feedback.featureSentTitle"),
        t("feedback.featureSentMessage", { protocol: result.protocol ? ` ${t("help.protocol", { protocol: result.protocol })}.` : "" })
      );
    } catch (error) {
      console.error(error);
      showFeedback("error", t("feedback.error"), t("feedback.featureSendError"));
    } finally {
      setIsSendingFeature(false);
    }
  };

  const handleStartCheckout = async (plan: UpgradePlan) => {
    if (!user) {
      showFeedback("error", t("feedback.expiredSessionTitle"), t("feedback.expiredSessionMessage"));
      return;
    }
    if (isBillingExemptRole) {
      showFeedback("info", t("feedback.exemptAccountTitle"), t("feedback.exemptAccountMessage"));
      return;
    }

    setIsOpeningCheckout(plan);
    
    try {
      router.push(buildUpgradeCheckoutPath(plan));
    } catch (error) {
      console.error(error);
      showFeedback("error", t("feedback.checkoutErrorTitle"), t("feedback.checkoutErrorMessage"));
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  const handleConfirmPreapproval = async (
    preapprovalId?: string,
    expectedPlan?: UpgradePlan,
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
      showFeedback("success", t("feedback.subscriptionConfirmedTitle"), t("feedback.subscriptionConfirmedMessage", { plan: result.targetPlan }));
    } catch (error) {
      console.error(error);
      showFeedback("error", t("feedback.confirmationErrorTitle"), t("feedback.confirmationErrorMessage"));
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
  const canUpgrade = !isBillingExemptRole;
  const currentPlanCopy = getLocalizedPlanCopy(tGlobal, effectivePlan, plans[effectivePlan]);
  const effectivePlanTone = getPlanTone(effectivePlan);
  const availableUpgradePlans = getPublicPlans()
    .map((plan) => plan.id)
    .filter((plan): plan is UpgradePlan => plan !== "free" && plan !== effectivePlan);
  const planRoleLabel = effectivePlan === "free" ? t("billing.role.free") : currentPlanCopy.name;
  const planValueSummary = currentPlanCopy.description;
  const pendingPreapprovalId = userProfile?.billing?.pendingPreapprovalId;
  const pendingCheckoutAttemptId = userProfile?.billing?.pendingCheckoutAttemptId;
  const pendingPlan = userProfile?.billing?.pendingPlan;
  const recoveryPlan: UpgradePlan = parseUpgradePlan(pendingPlan) || parseUpgradePlan(currentPlan) || "premium";
  const shouldShowRecoveryCTA =
    !isBillingExemptRole &&
    (effectivePaymentStatus === "pending" ||
      effectivePaymentStatus === "overdue" ||
      effectivePaymentStatus === "not_paid");

  const handleRecoverPayment = async () => {
    if (pendingPreapprovalId) {
      await handleConfirmPreapproval(pendingPreapprovalId, recoveryPlan, pendingCheckoutAttemptId);
      return;
    }
    await handleStartCheckout(recoveryPlan);
  };

  useEffect(() => {
    if (isTabBootstrapped) return;
    const tab = searchParams.get("tab");
    if (tab === "account" || tab === "profiles" || tab === "family" || tab === "billing" || tab === "security" || tab === "help") {
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
        scope: "mine",
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
    if (!pendingPreapprovalId) return;

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

  useEffect(() => {
    if (workspacesLoading) return;
    if (
      (activeTab === "family" && !canOpenFamilyWorkspaceSettings) ||
      (activeTab === "billing" && !canOpenBillingSettings) ||
      (activeTab === "security" && !canOpenSecuritySettings)
    ) {
      setActiveTab("account");
    }
  }, [activeTab, canOpenBillingSettings, canOpenFamilyWorkspaceSettings, canOpenSecuritySettings, workspacesLoading]);

  return (
    <div className="min-h-screen p-3 font-sans md:p-8 pb-20">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div id="tour-settings-header" className={`${fadeInUp} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
            <p className="text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
          </div>
          <Button
            variant="destructive"
            onClick={logout}
            className="gap-2 rounded-xl shadow-sm hover:shadow-red-500/20 transition-all hover:cursor-pointer hover:scale-105 duration-200"
          >
            <LogOut className="h-4 w-4" /> {t("common.logout")}
          </Button>
        </div>

        {/* Navegação de Abas Personalizada */}
        <div className={`${fadeInUp} delay-150 space-y-6`}>
          <div id="tour-settings-tabs" className="app-panel-subtle grid min-w-full w-full grid-cols-2 gap-1 rounded-2xl border p-1.5 shadow-sm sm:grid-cols-[repeat(var(--settings-tab-count),minmax(0,1fr))]" style={{ "--settings-tab-count": settingsTabCount } as CSSProperties & Record<"--settings-tab-count", number>}>
            <button id="tour-settings-account-tab" type="button" aria-pressed={activeTab === "account"} onClick={() => handleTabChange("account")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "account" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <User className="h-4 w-4" /> {t("tabs.account")}
            </button>
            <button id="tour-settings-profiles-tab" type="button" aria-pressed={activeTab === "profiles"} onClick={() => handleTabChange("profiles")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "profiles" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <WalletCards className="h-4 w-4" /> Perfis
            </button>
            {canOpenFamilyWorkspaceSettings ? (
              <button id="tour-settings-family-tab" type="button" aria-pressed={activeTab === "family"} onClick={() => handleTabChange("family")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "family" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
                <UsersRound className="h-4 w-4" /> Família
              </button>
            ) : null}
            {canOpenBillingSettings ? (
              <button id="tour-settings-billing-tab" type="button" aria-pressed={activeTab === "billing"} onClick={() => handleTabChange("billing")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "billing" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
                <CreditCard className="h-4 w-4" /> {t("tabs.billing")}
              </button>
            ) : null}
            {canOpenSecuritySettings ? (
              <button id="tour-settings-security-tab" type="button" aria-pressed={activeTab === "security"} onClick={() => handleTabChange("security")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "security" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
                <ShieldCheck className="h-4 w-4" /> {t("tabs.security")}
              </button>
            ) : null}
            <button id="tour-settings-help-tab" type="button" aria-pressed={activeTab === "help"} onClick={() => handleTabChange("help")} className={`flex w-full items-center sm:justify-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${activeTab === "help" ? "app-panel-soft border border-color:var(--app-panel-border) text-zinc-900 shadow-sm dark:text-white" : "text-zinc-500 hover:bg-accent hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
              <HelpCircle className="h-4 w-4" /> {t("tabs.help")}
            </button>
          </div>

          {/* ABA GERAL */}
          {activeTab === "account" && (
            <Card id="tour-settings-panel" className={`${zoomIn} delay-200 app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="rounded-full bg-primary/10 p-2"><User className="h-5 w-5 text-primary" /></div> {t("account.title")}</CardTitle>
                <CardDescription>{t("account.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-zinc-50 dark:border-zinc-800 shadow-xl transition-transform duration-300 group-hover:scale-105">
                      <AvatarImage src={isImpersonating ? (userProfile?.photoURL || "") : (userProfile?.photoURL || user?.photoURL || "")} className="object-cover" />
                      <AvatarFallback className="text-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{effectiveProfileDisplayName.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 p-1.5 bg-green-500 border-4 border-white dark:border-zinc-900 rounded-full animate-pulse" title={t("account.online")}></div>
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{displayName || t("common.userFallback")}</h3>
                    <p className="text-sm text-zinc-500 font-medium">{effectiveProfileEmail}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                      <Badge variant="secondary" className={`uppercase text-[10px] tracking-wider border ${effectivePlan === 'free' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'border-primary/20 bg-accent text-primary'}`}>
                        {isBillingExemptRole ? t("account.staffPlan") : t("account.plan", { plan: currentPlanCopy.name })}
                      </Badge>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 gap-1">
                        {(isImpersonating ? userProfile?.verifiedEmail : user?.emailVerified) ? (
                          <><CheckCircle2 className="h-3 w-3" /> {t("account.verified")}</>
                        ) : (
                          <><X className="h-3 w-3" /> {t("account.notVerified")}</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Separator className="bg-border/70" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-500">{t("account.displayName")}</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">{t("account.completeName")}</Label>
                    <Input value={completeName} onChange={(e) => setCompleteName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">{t("account.phone")}</Label>
                    <Input
                      value={formatPhone(phone)}
                      onChange={(e) => setPhone(normalizePhone(e.target.value))}
                      maxLength={15}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">{t("account.accessEmail")}</Label>
                    <Input defaultValue={effectiveProfileEmail || ""} disabled className="h-11 rounded-xl opacity-70 cursor-not-allowed" />
                  </div>
                </div>

                <Separator className="bg-border/70" />
                <div className="app-panel-soft rounded-2xl border p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-primary">
                        <Palette className="h-4 w-4" />
                        <p className="text-sm font-semibold">{t("appearance.title")}</p>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {t("appearance.description")}
                      </p>
                    </div>
                    {isSavingAppearance || appearanceLoading ? (
                      <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("appearance.saving")}</div>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-5">
                    <div className="space-y-3">
                      <Label className="text-zinc-500">{t("appearance.theme")}</Label>
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
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t(option.labelKey)}</p>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-zinc-500">{t(option.descriptionKey)}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-zinc-500">{t("appearance.accent")}</Label>
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
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t(option.labelKey)}</p>
                                <p className="text-xs leading-5 text-zinc-500">{t(option.descriptionKey)}</p>
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
                            <p className="text-sm font-semibold">{t("password.title")}</p>
                          </div>
                          <p className="text-sm text-primary/80">
                            {t("password.description")}
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handlePasswordAccess}
                          disabled={isSendingPasswordEmail}
                          className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {isSendingPasswordEmail ? t("password.sending") : t("password.action")}
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
                    {t("account.swaggerToken")}
                  </Button>
                )}
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 h-11 shadow-lg shadow-primary/10 transition-all active:scale-95 hover:cursor-pointer duration-200">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("common.save")}
                </Button>
              </CardFooter>
            </Card>
          )}

          {activeTab === "profiles" && (
            <div id="tour-settings-profiles-panel" className={`${fadeInUp} delay-200`}>
              <WorkspaceSettingsPanel />
            </div>
          )}

          {activeTab === "family" && canOpenFamilyWorkspaceSettings && (
            <div id="tour-settings-family-panel" className={`${fadeInUp} delay-200`}>
              <FamilyWorkspacePanel workspaces={workspaces} loading={workspacesLoading} />
            </div>
          )}

          {/* ABA PLANOS */}
          {activeTab === "billing" && (
            <div id="tour-settings-panel" className={`${fadeInUp} delay-200 space-y-6`}>
              <Card
                className={`border-none shadow-xl rounded-3xl relative overflow-hidden text-white flex flex-col justify-center min-h-2.5 ${effectivePlanTone.shell}`}
              >
                <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <CardHeader className="relative z-10 flex-1 flex items-center">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">

                    {/* BLOCO PRINCIPAL */}
                    <div className="space-y-3">
                      <CardTitle className="text-3xl font-bold flex items-center gap-3">
                        <Medal className={`h-8 w-8 ${effectivePlanTone.medal}`} />
                        <span>
                          {t("billing.planLabel")}{" "}
                          <span className="opacity-90">
                            {isBillingExemptRole ? "Staff" : currentPlanCopy.name}
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
                          : isBillingExemptRole ? t("billing.summary.staff") : planValueSummary}
                      </CardDescription>
                    </div>

                    {/* FEATURES */}
                    {currentPlanCopy.features.length > 0 && (
                      <nav className="lg:pt-0">
                        <ul className="space-y-2 text-sm text-white/70">
                          {currentPlanCopy.features.map((feature, index) => (
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
                            {t("billing.status.exempt")}
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'paid' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-300" />
                            {t("billing.status.paid")}
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'pending' && (
                          <>
                            <Clock className="h-4 w-4 text-amber-300" />
                            {t("billing.status.pending")}
                          </>
                        )}

                        {!isBillingExemptRole && effectivePaymentStatus === 'overdue' && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                            {t("billing.status.overdue")}
                          </>
                        )}

                        {!isBillingExemptRole && (effectivePaymentStatus === 'not_paid' || effectivePaymentStatus === 'canceled') && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                            {t("billing.status.failed")}
                          </>
                        )}
                      </Badge>

                      {/* Plano ativo */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        {userProfile?.status === 'active' ? (
                          <><CheckCircle className="h-4 w-4 text-white/70" />{t("billing.status.active", { plan: currentPlanCopy.name })}</>
                        ) : (
                          <><AlertTriangle className="h-4 w-4 text-white/70" />{t("billing.status.inactive", { plan: currentPlanCopy.name })}</>
                        )}

                      </Badge>

                      {/* Renovação */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        {(isBillingExemptRole || effectivePaymentStatus === 'paid') ? (
                          <>
                            <RefreshCw className="h-4 w-4 text-white/70" /> {t("billing.status.autoRenew")}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-white/70" /> {t("billing.status.renewalDisabled")}
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
                        {t("billing.plans.freePitch")}
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl border border-white/15 bg-black/10 p-3 text-xs text-white/85 space-y-1">
                    {isBillingExemptRole && (
                      <>
                        <p>
                          {t("billing.details.chargeRule")} <strong>{t("billing.details.exemptFor", { role: userProfile?.role === "admin" ? t("billing.details.admin") : t("billing.details.moderator") })}</strong>
                        </p>
                        <p>
                          {t("billing.details.planSource")}{" "}
                          <strong>
                            {userProfile?.billing?.source === "mercadopago_webhook"
                              ? t("billing.details.mercadoWebhook")
                              : userProfile?.billing?.source === "mercadopago_confirm"
                                ? t("billing.details.mercadoConfirm")
                                : userProfile?.billing?.source === "mercadopago_cancel"
                                  ? t("billing.details.mercadoCancel")
                                  : userProfile?.billing?.source === "system"
                                    ? t("billing.details.system")
                                    : t("billing.details.manualAdmin")}
                          </strong>
                        </p>
                      </>
                    )}
                    <p>
                      {t("billing.details.lastSync")}{" "}
                      <strong>{userProfile?.billing?.lastSyncAt ? date(userProfile?.billing?.lastSyncAt) : t("billing.details.noAutomaticUpdate")}</strong>
                    </p>
                  </div>
                  {shouldShowRecoveryCTA && (
                    <div className="rounded-xl border border-amber-200/30 bg-amber-500/10 p-3 text-xs text-white/90 space-y-2">
                      <p className="font-semibold">
                        {isAutoReconcilingBilling ? t("billing.recovery.checkingTitle") : t("billing.recovery.openTitle")}
                      </p>
                      <p>
                        {isAutoReconcilingBilling
                          ? t("billing.recovery.checkingDescription")
                          : t("billing.recovery.openDescription")}
                      </p>
                      <Button
                        onClick={() => void handleRecoverPayment()}
                        disabled={isOpeningCheckout !== null || isConfirmingPreapproval || isAutoReconcilingBilling}
                        className="h-9 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        {isAutoReconcilingBilling
                          ? t("billing.recovery.checkingAction")
                          : isConfirmingPreapproval
                            ? t("billing.recovery.validatingAction")
                            : isOpeningCheckout
                              ? t("billing.recovery.openingAction")
                              : effectivePaymentStatus === "pending"
                                ? t("billing.recovery.verifyAgain")
                                : t("billing.recovery.regularize")}
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
                        {isCancelingSubscription ? t("billing.cancel.canceling") : t("billing.cancel.action")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!isBillingExemptRole && (
                <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-600" /> {t("billing.history.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("billing.history.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isLoadingBillingHistory ? (
                      <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("billing.history.loading")}
                      </div>
                    ) : billingHistory.length === 0 ? (
                      <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                        {t("billing.history.empty")}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {billingHistory.map((item) => (
                          <div key={item.id} className="app-panel-subtle rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">{formatBillingEventLabel(item)}</p>
                              <Badge variant="outline" className={`text-[10px] uppercase ${getBillingHistoryStatusClass(item.paymentStatus)}`}>
                                {formatBillingHistoryStatus(item.paymentStatus)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.createdAt ? date(item.createdAt) : t("common.unavailableDate")}
                              {item.plan ? ` • ${t("billing.history.planPrefix")} ${item.plan}` : ""}
                              {typeof item.amount === "number" ? ` • ${money(item.amount, (item.currency || "BRL") as "BRL" | "USD" | "EUR")}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {!isLoadingBillingHistory && billingHistoryTotal > billingHistoryPerPage && (
                      <div className="app-panel-subtle mt-2 flex items-center justify-between rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                        <p className="text-xs text-zinc-500">
                          {t("common.pageStatus", {
                            page: billingHistoryPage,
                            total: Math.max(1, Math.ceil(billingHistoryTotal / billingHistoryPerPage)),
                            count: billingHistoryTotal,
                            item: t("billing.history.eventCount"),
                          })}
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
                            {t("common.previous")}
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
                            {t("common.next")}
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
                      <p className="mt-2 text-base font-semibold text-zinc-900">{t("billing.plans.freeTitle")}</p>
                      <p className="mt-1 text-sm text-zinc-600">{t("billing.plans.freeDescription")}</p>
                    </div>
                    {availableUpgradePlans.slice(0, 2).map((planId) => {
                      const planCopy = getLocalizedPlanCopy(tGlobal, planId, plans[planId]);
                      const planTone = getPlanTone(planId);
                      return (
                        <div key={planId} className={`rounded-2xl border px-4 py-4 ${planTone.softCard}`}>
                          <p className={`text-[10px] uppercase tracking-[0.2em] ${planTone.accentText}`}>{planCopy.title}</p>
                          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-white">{planCopy.tag || planCopy.cta}</p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{planCopy.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {availableUpgradePlans.map((planId) => {
                      const planCopy = getLocalizedPlanCopy(tGlobal, planId, plans[planId]);
                      const planTone = getPlanTone(planId);
                      return (
                        <Card key={planId} className={`app-panel-soft relative overflow-hidden h-full flex flex-col border-2 shadow-lg hover:shadow-xl transition-all rounded-3xl group transform hover:-translate-y-1 duration-300 ${planTone.border}`}>
                          <div className={`absolute top-0 left-0 w-full h-1 ${planTone.topBar}`} />
                          <CardHeader className="flex-1">
                            <CardTitle className="flex justify-between items-center gap-3">
                              <span className="flex items-center gap-2">
                                <Medal className={`h-5 w-5 ${planTone.accentText}`} /> {planCopy.title}
                              </span>
                              <span className="text-xl font-bold text-zinc-900 dark:text-white">
                                {formatPlanPrice(planId)}
                              </span>
                            </CardTitle>
                            <CardDescription>{planCopy.description}</CardDescription>
                            {planCopy.tag ? (
                              <p className={`text-xs font-medium uppercase tracking-[0.18em] ${planTone.accentText}`}>
                                {planCopy.tag}
                              </p>
                            ) : null}
                            {planCopy.features.length > 0 ? (
                              <nav>
                                <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                                  {planCopy.features.slice(0, 6).map((feature, index) => (
                                    <li key={index} className="flex items-center gap-2">
                                      <CheckCircle2 className={`h-4 w-4 ${planTone.accentText}`} /> {feature}
                                    </li>
                                  ))}
                                </ul>
                              </nav>
                            ) : null}
                          </CardHeader>
                          <CardFooter className="mt-auto">
                            <Button
                              onClick={() => handleStartCheckout(planId)}
                              disabled={isOpeningCheckout === planId}
                              className={`w-full h-11 rounded-xl shadow-lg hover:cursor-pointer transition-all active:scale-[0.98] ${planTone.action}`}
                            >
                              {isOpeningCheckout === planId ? t("billing.plans.openingCheckout") : planCopy.cta}
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
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
                  {t("security.title")}
                </CardTitle>
                <CardDescription>
                  {t("security.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">

                <div className="app-panel-subtle flex items-center justify-between rounded-2xl border p-5 transition-all hover:border-primary/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><EyeOff className="h-5 w-5 text-zinc-600 dark:text-zinc-400" /><Label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("security.discreetMode")}</Label></div>
                    <p className="text-sm text-zinc-500">{t("security.discreetDescription")}</p>
                  </div>
                  <Switch checked={privacyMode} onCheckedChange={togglePrivacyMode} className="hover:cursor-pointer" />
                </div>
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /><h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">{t("security.dataSecurity")}</h3></div>
                  <div className="p-5 rounded-2xl bg-zinc-950 text-zinc-400 font-mono text-xs break-all relative border border-zinc-800 shadow-inner group transition-all hover:border-zinc-700">
                    <div className="absolute top-3 right-3"><Badge variant="outline" className="text-[10px] border-zinc-700 text-emerald-500 font-bold px-2 py-0.5">{t("security.privacyBadge")}</Badge></div>
                    <p className="mb-2 text-zinc-600 uppercase tracking-widest text-[10px] font-bold">{t("security.internalId")}</p>
                    {keyFingerprint}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{t("security.internalIdHelp")}</p>
                  <Separator className="bg-zinc-300 dark:bg-zinc-800" />

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> {t("security.recoveryTitle")}
                    </h4>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400 mb-4">
                      {t("security.recoveryDescription")}
                    </p>
                    <Button
                      size="sm"
                      onClick={handleMigration}
                      disabled={isMigrating}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-full sm:w-auto hover:cursor-pointer transition-all active:scale-95"
                    >
                      {isMigrating ? t("security.fixing") : t("security.fixProtectedData")}
                    </Button>
                  </div>

                </div>
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
                  <h3 className="text-red-600 font-bold text-sm flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4" /> {t("security.dangerZone")}</h3>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 rounded-2xl">
                    <p className="text-xs text-red-600/80 dark:text-red-400">{t("security.deleteWarning")}</p>
                    <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/40 dark:border-red-900 whitespace-nowrap rounded-xl hover:cursor-pointer transition-all active:scale-95">{t("security.deleteAction")}</Button>
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
                    <PlayCircle className="h-6 w-6" /> {t("help.tutorialTitle")}
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-400">
                    {t("help.tutorialDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="-mt-4">
                  <div className="app-panel-subtle flex flex-col items-center justify-between gap-4 rounded-2xl border border-color:var(--app-panel-border) p-6 shadow-sm sm:flex-row">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("help.platformTourTitle")}</h4>
                      <p className="text-sm text-zinc-500">{t("help.platformTourDescription")}</p>
                    </div>
                    <Button
                      onClick={handleReplayTour}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-black/10 hover:scale-105 transition-all"
                    >
                      {t("help.chooseTour")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20 overflow-hidden">
                <CardHeader className="bg-linear-to-r from-primary/10 to-primary/5 p-4">
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-6 w-6" /> {t("help.exploreTitle")}
                  </CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-400">
                    {t("help.exploreDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="-mt-4">
                  <div className="app-panel-subtle flex flex-col items-center justify-between gap-4 rounded-2xl border border-color:var(--app-panel-border) p-6 shadow-sm sm:flex-row">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("help.exploreCardTitle")}</h4>
                      <p className="text-sm text-zinc-500">{t("help.exploreCardDescription")}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => router.push("/apps")}
                      variant="outline"
                      className="w-full sm:w-auto rounded-xl border-primary/20 text-primary hover:bg-accent"
                    >
                      {t("help.openExplore")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Suporte e Ideias */}
              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <MessageCircle className="h-5 w-5" /> {t("help.contactTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* WhatsApp */}
                  <a href="https://wa.me/5511992348613" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 group cursor-pointer">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 group-hover:scale-110 transition-transform">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("help.whatsappTitle")}</h4>
                      <p className="text-sm text-zinc-500">{t("help.whatsappDescription")}</p>
                    </div>
                  </a>

                  {/* {t("support.title")} via Sistema */}
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 text-left transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="rounded-full bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                      <LifeBuoy className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("help.openTicketTitle")}</h4>
                      <p className="text-sm text-zinc-500">{t("help.openTicketDescription")}</p>
                    </div>
                  </button>

                  {/* {t("feature.send")} / Sugestão */}
                  <button
                    type="button"
                    onClick={() => setIsFeatureModalOpen(true)}
                    className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-transparent p-4 text-left transition-colors hover:border-color:var(--app-panel-border) hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 group-hover:scale-110 transition-transform">
                      <Lightbulb className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t("help.sendIdeaTitle")}</h4>
                      <p className="text-sm text-zinc-500">{t("help.sendIdeaDescription")}</p>
                    </div>
                  </button>
                </CardContent>
              </Card>

              <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <HelpCircle className="h-5 w-5" /> {t("help.myTicketsTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("help.myTicketsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoadingMySupportTickets ? (
                    <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("help.loadingTickets")}
                    </div>
                  ) : mySupportTickets.length === 0 ? (
                    <div className="app-panel-subtle flex h-20 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-zinc-500">
                      {t("help.noTickets")}
                    </div>
                  ) : (
                    mySupportTickets.map((ticket) => (
                      <div key={ticket.id} className="app-panel-subtle rounded-xl border border-color:var(--app-panel-border) px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {t("help.protocol", { protocol: ticket.protocol || `#${ticket.id.slice(0, 8)}` })}
                            </p>
                            <p className="mt-0.5 text-[11px] font-medium text-primary">
                              {formatTicketType(ticket)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {ticket.assignedTo || ticket.assignedToName ? (
                              <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary">
                                <UserCheck className="h-3 w-3" />
                                {t("help.assignedTo", { name: ticket.assignedToName || t("help.supportTeam") })}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 border-border/70 bg-background/60 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {t("help.waitingAssignee")}
                              </Badge>
                            )}
                            <Badge variant="outline" className={getSupportStatusBadgeClass(ticket.status)}>
                              {formatSupportStatus(ticket.status)}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{ticket.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{t("help.openedAt", { date: date(ticket.createdAt) })}</span>
                          {ticket.firstResponseAt ? <span>{t("help.firstResponse")}</span> : null}
                          {ticket.resolvedAt ? <span>{t("help.resolvedAt", { date: date(ticket.resolvedAt) })}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                  {!isLoadingMySupportTickets && mySupportTotal > mySupportPerPage && (
                    <div className="app-panel-subtle mt-3 flex items-center justify-between rounded-xl border border-color:var(--app-panel-border) px-3 py-2">
                      <p className="text-xs text-zinc-500">
                        {t("common.pageStatus", {
                          page: mySupportPage,
                          total: Math.max(1, Math.ceil(mySupportTotal / mySupportPerPage)),
                          count: mySupportTotal,
                          item: t("help.ticketCount"),
                        })}
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
                          {t("common.previous")}
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
                          {t("common.next")}
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
                <LifeBuoy className="h-6 w-6" /> {t("support.title")}
              </DialogTitle>
              <DialogDescription className="pt-2">
                {t("support.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="support-reason">{t("support.reason")}</Label>
                <textarea
                  id="support-reason"
                  className="app-field-surface flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-zinc-400"
                  placeholder={t("support.placeholder")}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                />
              </div>
              <p className="text-xs text-zinc-500">
                {t("support.privacyNote")}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsSupportModalOpen(false)} className="w-full rounded-xl sm:w-auto">{t("common.cancel")}</Button>
              <Button
                onClick={handleSendSupport}
                disabled={isSendingSupport}
                className="w-full rounded-xl bg-primary text-primary-foreground gap-2 hover:bg-primary/90 sm:w-auto"
              >
                {isSendingSupport ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                {isSendingSupport ? t("support.sending") : t("support.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Cancelamento de Assinatura */}
        <Dialog open={showCancelSubscriptionModal} onOpenChange={setShowCancelSubscriptionModal}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> {t("billing.cancel.title")}
              </DialogTitle>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                {t("billing.cancel.description1")}
              </DialogDescription>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                {t("billing.cancel.description2")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowCancelSubscriptionModal(false)}
                className="rounded-xl h-10 w-full sm:w-auto hover:cursor-pointer transition-all duration-200"
              >
                {t("billing.cancel.keep")}
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
                {isCancelingSubscription ? t("billing.cancel.cancelingShort") : t("billing.cancel.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Ideia / Feature */}
        <Dialog open={isFeatureModalOpen} onOpenChange={setIsFeatureModalOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[500px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-6 w-6" /> {t("feature.title")}
              </DialogTitle>
              <DialogDescription className="pt-2">
                {t("feature.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="feature-idea">{t("feature.label")}</Label>
                <textarea
                  id="feature-idea"
                  className="app-field-surface flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-amber-600"
                  placeholder={t("feature.placeholder")}
                  value={featureMessage}
                  onChange={(e) => setFeatureMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsFeatureModalOpen(false)} className="w-full rounded-xl sm:w-auto">{t("common.cancel")}</Button>
              <Button
                onClick={handleSendFeature}
                disabled={isSendingFeature}
                className="w-full rounded-xl bg-amber-600 text-white gap-2 hover:bg-amber-700 sm:w-auto"
              >
                {isSendingFeature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                {t("feature.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px] rounded-3xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> {t("delete.title")}
              </DialogTitle>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                {t("delete.irreversible")}
              </DialogDescription>
              <DialogDescription className="pt-3 font-medium text-zinc-700 dark:text-zinc-300">
                {t("delete.description")}
              </DialogDescription>
              <DialogDescription className="pt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {t("delete.grace", { days: ACCOUNT_DELETION_GRACE_DAYS })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl h-10 w-full sm:w-auto hover:cursor-pointer transition-all duration-200">
                {t("common.cancel")}
              </Button>
              <Button variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="rounded-xl h-10 w-full sm:w-auto bg-red-600 hover:bg-red-700 hover:cursor-pointer transition-all duration-200">
                {isDeleting ? t("delete.deleting") : t("delete.confirm")}
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
                {t("common.understood")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}




