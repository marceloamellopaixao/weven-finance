"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlans } from "@/hooks/usePlans";
import {
  fetchAdminUsersPage,
  updateUserStatus,
  updateUserPlan,
  updateUserRole,
  getUserTransactionCount,
  resetUserFinancialData,
  softDeleteUser,
  updateUserPaymentStatus,
  normalizeDatabaseUsers,
  restoreUserAccount,
  permanentlyDeleteUser,
  getStaffUsers,
  downloadAdminCsv,
} from "@/services/userService";
import { getAccessControlConfig, updateAccessControlConfig, updatePlansConfig } from "@/services/systemService";
import {
  UserProfile,
  UserStatus,
  UserPlan,
  UserRole,
  UserPaymentStatus,
} from "@/types/user";
import {
  AccessControlConfig,
  AccessPermissionLevel,
  AccessResourceKey,
  AccessRoleDefinition,
  AccessSubjectType,
  DEFAULT_ACCESS_CONTROL_CONFIG,
  PlansConfig,
  PlanDetails,
} from "@/types/system";
import { ACCESS_RESOURCE_LABEL_BY_KEY, ACCESS_SCREENS, hasAccess, hasBillingExemption } from "@/lib/access-control/config";
import { CREATOR_SUPREME_UID, canAccessAdminArea, isCreatorSupremeUid } from "@/lib/access-control/roles";
import { computePermanentDeleteAt } from "@/lib/account-deletion/policy";
import { getPlanTone } from "@/lib/plans/display";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  User,
  ShieldAlert,
  UserX,
  CheckCircle2,
  Search,
  MoreVertical,
  Trash2,
  RefreshCcw,
  Save,
  Loader2,
  User as UserIcon,
  CreditCard,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArchiveRestore,
  ShieldCheck,
  AlertTriangle,
  Info,
  History,
  Lock,
  HeadphonesIcon,
  Lightbulb,
  MessageSquare,
  Eye,
  Bell,
  Calculator,
  Download,
  FilterX,
} from "lucide-react";
import { deleteTicket, FeatureRequestStatus, fetchSupportTicketsPage, markSupportTicketsAsSeen, SupportRequestStatus, SupportTicket, updateTicket } from "@/hooks/supportService";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import {
  activateImpersonation,
  getMyImpersonationStatus,
  requestImpersonationAccess,
} from "@/services/impersonationService";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { AdminLoadingShell } from "./components/AdminLoadingShell";

type UserWithCount = UserProfile & { transactionCount?: number };
type DeletionSuccessData = { name: string; email: string } | null;
type PaymentFilterType = UserPaymentStatus | "unpaid_group" | "all";

type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

type AccessEditorLevel = AccessPermissionLevel | "inherit";
type AdminPermissionArea = "users" | "support" | "restore" | "metrics" | "plans" | "audit" | "permissions";
type AdminPermissionMinimum = "read" | "write" | "full";

const ADMIN_REALTIME_FALLBACK_INTERVAL_MS = 60000;
const ADMIN_MONITORING_INTERVAL_MS = 60000;

function shouldRefreshAdminNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

type AdminAuditLog = {
  id: string;
  actorUid: string;
  action: string;
  targetUid: string | null;
  requestId: string | null;
  route: string | null;
  method: string | null;
  ip: string | null;
  createdAt: string | null;
  details: Record<string, unknown>;
};

type AdminMetricsSummary = {
  total: number;
  errors: number;
  rateLimited: number;
  avgDurationMs: number;
  errorRatePct: number;
  rateLimitedPct: number;
  previousTotal?: number;
  trafficDropPct?: number;
};

type AdminMetricsRoute = {
  route: string;
  total: number;
  errors: number;
  rateLimited: number;
  avgDurationMs: number;
};

type AdminMetricsAlert = {
  code?: string;
  level: "critical" | "high" | "medium";
  title: string;
  description: string;
  value?: number;
};

type AdminHealth = {
  dbHealthy: boolean;
  latestWebhookAt: string | null;
  webhookDelayMinutes: number | null;
  failedPayments24h: number;
  pendingRecoveryUsers: number;
  apiErrors1h: number;
  apiAvgLatency1h: number;
};

function formatDateSafe(value: unknown) {
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return null;
}

const ADMIN_USERS_FILTERS_STORAGE_KEY = "wevenfinance:admin:users-filters:v1";
const ADMIN_SUPPORT_FILTERS_STORAGE_KEY = "wevenfinance:admin:support-filters:v1";
const ADMIN_AUDIT_FILTERS_STORAGE_KEY = "wevenfinance:admin:audit-filters:v1";
const ADMIN_DIALOG_CONTENT_CLASS = "app-panel-soft w-[calc(100vw-1rem)] max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl border border-color:var(--app-panel-border) p-5 shadow-2xl shadow-primary/10 sm:p-6";

type TicketPriority = NonNullable<SupportTicket["priority"]>;
type TicketStatus = SupportRequestStatus | FeatureRequestStatus;

const SUPPORT_STATUS_OPTIONS: Array<{ value: SupportRequestStatus; label: string }> = [
  { value: "pending", label: "support.status.pending" },
  { value: "in_progress", label: "support.status.inProgress" },
  { value: "resolved", label: "support.status.resolved" },
  { value: "rejected", label: "support.status.rejected" },
];

const FEATURE_STATUS_OPTIONS: Array<{ value: FeatureRequestStatus; label: string }> = [
  { value: "pending", label: "support.status.pending" },
  { value: "under_review", label: "support.status.underReview" },
  { value: "approved", label: "support.status.approved" },
  { value: "rejected", label: "support.status.rejected" },
  { value: "implemented", label: "support.status.implemented" },
];

const TICKET_PRIORITY_OPTIONS: Array<{ value: TicketPriority; label: string }> = [
  { value: "low", label: "support.priority.low" },
  { value: "medium", label: "support.priority.medium" },
  { value: "high", label: "support.priority.high" },
  { value: "urgent", label: "support.priority.urgent" },
];

const ACCESS_SUBJECT_LABELS: Record<AccessSubjectType, string> = {
  global: "access.subject.global",
  plan: "access.subject.plan",
  role: "access.subject.role",
  user: "access.subject.user",
};

const ACCESS_LEVEL_LABELS: Record<AccessPermissionLevel, string> = {
  none: "access.level.none",
  read: "access.level.read",
  write: "access.level.write",
  full: "access.level.full",
};

const ADMIN_RESOURCE_ACCESS: Record<AdminPermissionArea, { read: AccessResourceKey; write?: AccessResourceKey; delete?: AccessResourceKey }> = {
  users: { read: "admin.users.read", write: "admin.users.write", delete: "admin.users.delete" },
  support: { read: "admin.support.read", write: "admin.support.write", delete: "admin.support.delete" },
  restore: { read: "admin.restore.read", write: "admin.restore.write", delete: "admin.restore.delete" },
  metrics: { read: "admin.metrics.read" },
  plans: { read: "admin.plans.read", write: "admin.plans.write" },
  audit: { read: "admin.audit.read" },
  permissions: { read: "admin.permissions.read", write: "admin.permissions.write", delete: "admin.permissions.delete" },
};

function getAdminNavButtonClass(active: boolean) {
  return cn(
    "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary/35 bg-primary/10 text-foreground shadow-sm"
      : "border-transparent text-muted-foreground hover:border-color:var(--app-panel-border) hover:bg-accent hover:text-foreground"
  );
}

export default function AdminPage() {
  const { user, userProfile, loading } = useAuth();
  const { plans } = usePlans();
  const tAdmin = useTranslations("admin");
  const { locale } = useI18n();
  const freePlanTone = getPlanTone("free");
  const premiumPlanTone = getPlanTone("premium");
  const proPlanTone = getPlanTone("pro");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Constantes de Animação ---
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";

  // UI - Abas
  const [activeTab, setActiveTab] = useState<string>("users");
  const [isTabBootstrapped, setIsTabBootstrapped] = useState(false);

  // Users Data
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Support Data
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [supportUnseenCount, setSupportUnseenCount] = useState(0);
  const [supportPage, setSupportPage] = useState(1);
  const supportPerPage = 12;
  const [supportTypeFilter, setSupportTypeFilter] = useState<"support" | "feature" | "all">("all");
  const [supportStatusFilter, setSupportStatusFilter] = useState("all");
  const [supportPriorityFilter, setSupportPriorityFilter] = useState<"low" | "medium" | "high" | "urgent" | "all">("all");
  const [supportSearch, setSupportSearch] = useState("");
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [viewTicket, setViewTicket] = useState<SupportTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicket | null>(null);
  const [restoreDetailsUser, setRestoreDetailsUser] = useState<UserProfile | null>(null);
  const [isMarkingSupportSeen, setIsMarkingSupportSeen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditActorUidFilter, setAuditActorUidFilter] = useState("");
  const [auditTargetUidFilter, setAuditTargetUidFilter] = useState("");
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditToDate, setAuditToDate] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const auditPerPage = 20;
  const [metricsWindowMinutes, setMetricsWindowMinutes] = useState("60");
  const [metricsSummary, setMetricsSummary] = useState<AdminMetricsSummary | null>(null);
  const [metricsByRoute, setMetricsByRoute] = useState<AdminMetricsRoute[]>([]);
  const [metricsAlerts, setMetricsAlerts] = useState<AdminMetricsAlert[]>([]);
  const [criticalMetricsAlerts, setCriticalMetricsAlerts] = useState<AdminMetricsAlert[]>([]);
  const [healthData, setHealthData] = useState<AdminHealth | null>(null);
  const [healthAlerts, setHealthAlerts] = useState<AdminMetricsAlert[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState<"users" | "support" | "audit" | null>(null);

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [planFilter, setPlanFilter] = useState<UserPlan | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentFilterType>("all");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // --- Modais de Ação ---
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToPermanentDelete, setUserToPermanentDelete] = useState<UserProfile | null>(null);
  const [deletedUserData, setDeletedUserData] = useState<DeletionSuccessData>(null);
  const [userToReactivate, setUserToReactivate] = useState<UserProfile | null>(null);
  const [userToBlock, setUserToBlock] = useState<UserProfile | null>(null);

  const [userToRestore, setUserToRestore] = useState<{ user: UserProfile, withData: boolean } | null>(null);
  const [showNormalizeConfirm, setShowNormalizeConfirm] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });

  const [pendingPaymentChange, setPendingPaymentChange] = useState<{ uid: string; status: UserPaymentStatus } | null>(null);
  const [impersonationPollingTargetUid, setImpersonationPollingTargetUid] = useState<string | null>(null);

  // Block reason
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const blockReasonOptions = useMemo(() => [
    { value: "Falta de Pagamento", label: tAdmin("block.reasons.payment") },
    { value: "Violação dos Termos de Uso", label: tAdmin("block.reasons.terms") },
    { value: "Solicitação do Usuário", label: tAdmin("block.reasons.userRequest") },
    { value: "Outros", label: tAdmin("block.reasons.other") },
  ], [tAdmin]);

  // Plans
  const [editedPlans, setEditedPlans] = useState<PlansConfig | null>(null);
  const [editedAccessControl, setEditedAccessControl] = useState<AccessControlConfig | null>(null);
  const [isSavingPlans, setIsSavingPlans] = useState(false);
  const [isSavingAccessControl, setIsSavingAccessControl] = useState(false);
  const [accessSubjectType, setAccessSubjectType] = useState<AccessSubjectType>("plan");
  const [accessSubjectId, setAccessSubjectId] = useState("free");
  const [permissionGroupByScreen, setPermissionGroupByScreen] = useState<Record<string, string>>({});

  // --- Permissões ---
  const isSupremeAdmin = isCreatorSupremeUid(userProfile?.uid);
  const accessControlConfig = editedAccessControl ?? DEFAULT_ACCESS_CONTROL_CONFIG;
  const hasAdminPermission = useCallback((
    resource: AdminPermissionArea,
    minimum: AdminPermissionMinimum = "read"
  ) => {
    if (!userProfile) return false;
    if (isSupremeAdmin) return true;
    if (userProfile.role === "client") return false;

    const mapped = ADMIN_RESOURCE_ACCESS[resource];
    const accessResource =
      minimum === "full" ? mapped.delete ?? mapped.write ?? mapped.read :
      minimum === "write" ? mapped.write ?? mapped.read :
      mapped.read;

    return hasAccess(accessControlConfig, {
      uid: userProfile.uid,
      plan: userProfile.plan,
      role: userProfile.role,
    }, accessResource, minimum === "read" ? "read" : "write");
  }, [accessControlConfig, isSupremeAdmin, userProfile]);
  const canManageSensitive = hasAdminPermission("plans", "write");
  const canViewPermissions = hasAdminPermission("permissions", "read");
  const canManagePermissions = hasAdminPermission("permissions", "write");
  const canDeletePermissions = hasAdminPermission("permissions", "full");
  const canDeleteRecords =
    canDeletePermissions ||
    hasAdminPermission("users", "full") ||
    hasAdminPermission("support", "full") ||
    hasAdminPermission("restore", "full");
  const canRestore = hasAdminPermission("restore", "read");
  const canImpersonateUsers = hasAdminPermission("users", "write") || hasAdminPermission("support", "write");

  const unseenSupportTickets = useMemo(() => {
    if (!userProfile) return [];
    if (!canAccessAdminArea(userProfile)) return [];
    return tickets.filter((ticket) => !Array.isArray(ticket.staffSeenBy) || !ticket.staffSeenBy.includes(userProfile.uid));
  }, [tickets, userProfile]);

  const unseenSupportCount = supportUnseenCount || unseenSupportTickets.length;

  const adminNavItems = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      description: string;
      icon: typeof UserIcon;
      badge?: number;
    }> = [];

    if (hasAdminPermission("users", "read")) {
      items.push({
        id: "users",
        label: tAdmin("nav.users.label"),
        description: tAdmin("nav.users.description"),
        icon: UserIcon,
      });
    }
    if (hasAdminPermission("support", "read")) {
      items.push({
        id: "support",
        label: tAdmin("nav.support.label"),
        description: tAdmin("nav.support.description"),
        icon: HeadphonesIcon,
        badge: unseenSupportCount,
      });
    }
    if (canRestore) {
      items.push({
        id: "restore",
        label: tAdmin("nav.restore.label"),
        description: tAdmin("nav.restore.description"),
        icon: History,
      });
    }
    if (hasAdminPermission("plans", "read")) {
      items.push({
        id: "plans",
        label: tAdmin("nav.plans.label"),
        description: tAdmin("nav.plans.description"),
        icon: CreditCard,
      });
    }
    if (canViewPermissions) {
      items.push({
        id: "permissions",
        label: tAdmin("nav.permissions.label"),
        description: tAdmin("nav.permissions.description"),
        icon: Lock,
      });
    }
    if (hasAdminPermission("audit", "read")) {
      items.push({
        id: "audit",
        label: tAdmin("nav.audit.label"),
        description: tAdmin("nav.audit.description"),
        icon: ShieldCheck,
      });
    }
    if (hasAdminPermission("metrics", "read")) {
      items.push({
        id: "metrics",
        label: tAdmin("nav.metrics.label"),
        description: tAdmin("nav.metrics.description"),
        icon: Calculator,
        badge: criticalMetricsAlerts.length,
      });
    }

    return items;
  }, [canRestore, canViewPermissions, criticalMetricsAlerts.length, hasAdminPermission, tAdmin, unseenSupportCount]);

  const activeAdminNavItem = adminNavItems.find((item) => item.id === activeTab) ?? adminNavItems[0];

  const allowedTabs = useMemo(() => {
    if (!userProfile) return ["users", "support", "audit"];
    const tabs: string[] = [];
    if (hasAdminPermission("users", "read")) tabs.push("users");
    if (hasAdminPermission("support", "read")) tabs.push("support");
    if (hasAdminPermission("restore", "read")) tabs.push("restore");
    if (hasAdminPermission("audit", "read")) tabs.push("audit");
    if (hasAdminPermission("metrics", "read")) tabs.push("metrics");
    if (hasAdminPermission("plans", "read")) tabs.push("plans");
    if (hasAdminPermission("permissions", "read")) tabs.push("permissions");
    return tabs;
  }, [hasAdminPermission, userProfile]);

  const setActiveTabAndPersist = useCallback((tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const clearUsersFilters = useCallback(() => {
    setSearchTerm("");
    setRoleFilter("all");
    setPlanFilter("all");
    setStatusFilter("all");
    setPaymentStatusFilter("all");
    setCurrentPage(1);
  }, []);

  // Permissão de Visualização na Tabela de Usuários
  const canViewRole = useCallback((targetRole: UserRole) => {
    if (!userProfile) return false;
    if (hasAdminPermission("users", "read")) return true;
    if (userProfile.role === "admin") return true;

    // Moderador vê Cliente e Suporte
    if (userProfile.role === "moderator") {
      return targetRole === "client" || targetRole === "support";
    };

    // Suporte não tem acesso Ã  tabela de usuários
    return false;
  }, [hasAdminPermission, userProfile]);

  // Permissão de Edição de Cargo
  const canEditRole = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (targetUser.uid === userProfile.uid) return false; // Não edita a si mesmo
    if (targetUser.uid === CREATOR_SUPREME_UID) return false; // Não edita o Criador Supremo
    if (hasAdminPermission("users", "write")) return true;

    if (userProfile.role === 'admin') {
      if (isCreatorSupremeUid(userProfile.uid)) return true; // Criador edita tudo
      if (targetUser.role === 'admin') return false; // Admin comum não edita outro admin
      return true;
    }

    if (userProfile.role === 'moderator') {
      if (targetUser.role === 'admin' || targetUser.role === 'moderator') return false;
      return true; // Moderador edita apenas Clientes e Suporte
    };

    return false;
  }, [hasAdminPermission, userProfile]);

  // Permissão de Edição de Plano/Status
  const canEditPlan = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (targetUser.uid === userProfile.uid) return userProfile.role === "admin";
    if (hasAdminPermission("users", "write")) return true;

    const hierarchy: Record<string, number> = { admin: 3, moderator: 2, support: 1, client: 0 };
    const myRank = hierarchy[userProfile.role] ?? 0;
    const targetRank = hierarchy[targetUser.role] ?? 0;

    // Só pode editar se tiver hierarquia maior e não for o Criador Supremo
    if (isCreatorSupremeUid(userProfile.uid)) return true;

    return myRank > targetRank;
  }, [hasAdminPermission, userProfile]);

  // PERMISSÃ•ES no usuário (Bloquear, Resetar, Deletar)
  const canEditUser = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;

    // Ninguém edita a si mesmo nestas ações
    if (targetUser.uid === userProfile.uid) return isCreatorSupremeUid(userProfile.uid);

    // Criador Supremo pode se editar
    if (isCreatorSupremeUid(userProfile.uid)) return true;
    if (hasAdminPermission("users", "write")) return true;

    const hierarchy: Record<string, number> = { admin: 3, moderator: 2, support: 1, client: 0 };
    const myRank = hierarchy[userProfile.role] ?? 0;
    const targetRank = hierarchy[targetUser.role] ?? 0;

    // Criador supremo edita todos
    if (isCreatorSupremeUid(userProfile.uid)) return true;

    // Regra geral: Só edita quem está abaixo na hierarquia
    return myRank > targetRank;
  }, [hasAdminPermission, userProfile]);

  const canResetUser = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (!canDeleteRecords) return false;
    if (targetUser.uid === userProfile.uid) return isCreatorSupremeUid(userProfile.uid);
    return canEditUser(targetUser);
  }, [canDeleteRecords, canEditUser, userProfile]);

  const canDeleteUser = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (!canDeleteRecords) return false;
    if (targetUser.uid === userProfile.uid) return false;
    return canEditUser(targetUser);
  }, [canDeleteRecords, canEditUser, userProfile]);

  const canToggleUserStatus = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (targetUser.uid === userProfile.uid) return false;
    return canEditUser(targetUser);
  }, [canEditUser, userProfile]);

  // --- Guards ---
  useEffect(() => {
    if (loading || !userProfile) return;
    if (userProfile.role === "client") {
      router.push("/");
      return;
    }
    if (!editedAccessControl) return;
    if (allowedTabs.length === 0) router.push("/");
  }, [allowedTabs.length, editedAccessControl, userProfile, loading, router]);

  useEffect(() => {
    if (plans) setEditedPlans(plans);
  }, [plans]);

  useEffect(() => {
    if (!userProfile || userProfile.role === "client") return;
    let cancelled = false;
    void getAccessControlConfig().then((config) => {
      if (!cancelled) setEditedAccessControl(config);
    });
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  useEffect(() => {
    if (accessSubjectType === "global") {
      setAccessSubjectId("all");
      return;
    }
    if (accessSubjectType === "plan" && !["free", "premium", "pro"].includes(accessSubjectId)) {
      setAccessSubjectId("free");
      return;
    }
    if (accessSubjectType === "role" && editedAccessControl && !editedAccessControl.roles.some((role) => role.key === accessSubjectId)) {
      setAccessSubjectId(editedAccessControl.roles[0]?.key || "client");
      return;
    }
    if (accessSubjectType === "user" && !accessSubjectId && users[0]?.uid) {
      setAccessSubjectId(users[0].uid);
    }
  }, [accessSubjectId, accessSubjectType, editedAccessControl, users]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ADMIN_USERS_FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        searchTerm: string;
        roleFilter: UserRole | "all";
        planFilter: UserPlan | "all";
        statusFilter: UserStatus | "all";
        paymentStatusFilter: PaymentFilterType;
      }>;
      if (typeof parsed.searchTerm === "string") setSearchTerm(parsed.searchTerm);
      if (parsed.roleFilter) setRoleFilter(parsed.roleFilter);
      if (parsed.planFilter) setPlanFilter(parsed.planFilter);
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.paymentStatusFilter) setPaymentStatusFilter(parsed.paymentStatusFilter);
    } catch {
      // Ignora parse inválido
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ADMIN_USERS_FILTERS_STORAGE_KEY,
        JSON.stringify({
          searchTerm,
          roleFilter,
          planFilter,
          statusFilter,
          paymentStatusFilter,
        })
      );
    } catch {
      // Ignora falha de storage
    }
  }, [searchTerm, roleFilter, planFilter, statusFilter, paymentStatusFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ADMIN_SUPPORT_FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        supportTypeFilter: "support" | "feature" | "all";
        supportStatusFilter: string;
        supportPriorityFilter: "low" | "medium" | "high" | "urgent" | "all";
        supportSearch: string;
      }>;
      if (parsed.supportTypeFilter) setSupportTypeFilter(parsed.supportTypeFilter);
      if (typeof parsed.supportStatusFilter === "string") setSupportStatusFilter(parsed.supportStatusFilter);
      if (parsed.supportPriorityFilter) setSupportPriorityFilter(parsed.supportPriorityFilter);
      if (typeof parsed.supportSearch === "string") setSupportSearch(parsed.supportSearch);
    } catch {
      // ignora parse invalido
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ADMIN_SUPPORT_FILTERS_STORAGE_KEY,
        JSON.stringify({
          supportTypeFilter,
          supportStatusFilter,
          supportPriorityFilter,
          supportSearch,
        })
      );
    } catch {
      // ignora falha de storage
    }
  }, [supportTypeFilter, supportStatusFilter, supportPriorityFilter, supportSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ADMIN_AUDIT_FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        auditSearch: string;
        auditActionFilter: string;
        auditActorUidFilter: string;
        auditTargetUidFilter: string;
        auditFromDate: string;
        auditToDate: string;
      }>;
      if (typeof parsed.auditSearch === "string") setAuditSearch(parsed.auditSearch);
      if (typeof parsed.auditActionFilter === "string") setAuditActionFilter(parsed.auditActionFilter);
      if (typeof parsed.auditActorUidFilter === "string") setAuditActorUidFilter(parsed.auditActorUidFilter);
      if (typeof parsed.auditTargetUidFilter === "string") setAuditTargetUidFilter(parsed.auditTargetUidFilter);
      if (typeof parsed.auditFromDate === "string") setAuditFromDate(parsed.auditFromDate);
      if (typeof parsed.auditToDate === "string") setAuditToDate(parsed.auditToDate);
    } catch {
      // ignora parse invalido
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ADMIN_AUDIT_FILTERS_STORAGE_KEY,
        JSON.stringify({
          auditSearch,
          auditActionFilter,
          auditActorUidFilter,
          auditTargetUidFilter,
          auditFromDate,
          auditToDate,
        })
      );
    } catch {
      // ignora falha de storage
    }
  }, [auditSearch, auditActionFilter, auditActorUidFilter, auditTargetUidFilter, auditFromDate, auditToDate]);

  useEffect(() => {
    if (loading || !userProfile || isTabBootstrapped) return;
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && allowedTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (userProfile.role === "support") {
      setActiveTab("support");
    }
    setIsTabBootstrapped(true);
  }, [allowedTabs, isTabBootstrapped, loading, searchParams, userProfile]);

  useEffect(() => {
    if (!isTabBootstrapped || !allowedTabs.includes(activeTab)) return;
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl !== activeTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [activeTab, allowedTabs, isTabBootstrapped, pathname, router, searchParams]);

  useEffect(() => {
    if (loading || !userProfile) return;
    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;
    if (activeTab !== "users" && activeTab !== "restore" && activeTab !== "permissions") return;

    let cancelled = false;
    const loadUsers = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        setIsLoadingUsers(true);
        const effectiveStatus = activeTab === "restore" ? "deleted" : statusFilter;
        const payload = await fetchAdminUsersPage({
          page: currentPage,
          limit: usersPerPage,
          q: searchTerm,
          role: roleFilter,
          plan: planFilter,
          status: effectiveStatus,
          paymentStatus: paymentStatusFilter,
        });
        if (cancelled) return;
        setUsers(payload.users as UserWithCount[]);
        setUsersTotal(payload.total);
      } catch {
        if (!cancelled) {
          setUsers([]);
          setUsersTotal(0);
        }
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };

    void loadUsers();
    const interval = setInterval(() => void loadUsers(), ADMIN_REALTIME_FALLBACK_INTERVAL_MS);
    const stopRealtime = subscribeToTableChanges({
      table: "profiles",
      onChange: () => void loadUsers(),
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      stopRealtime();
    };
  }, [activeTab, loading, userProfile, currentPage, usersPerPage, searchTerm, roleFilter, planFilter, statusFilter, paymentStatusFilter]);

  useEffect(() => {
    if (loading || !userProfile) return;
    if (activeTab !== "support") return;

    let cancelled = false;
    const loadTickets = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        const payload = await fetchSupportTicketsPage({
          page: supportPage,
          limit: supportPerPage,
          type: supportTypeFilter,
          status: supportStatusFilter,
          priority: supportPriorityFilter,
          q: supportSearch,
        });
        if (cancelled) return;
        setTickets(payload.tickets);
        setTicketsTotal(payload.total);
        setSupportUnseenCount(payload.unseenCount);
      } catch {
        if (!cancelled) {
          setTickets([]);
          setTicketsTotal(0);
          setSupportUnseenCount(0);
        }
      }
    };

    void loadTickets();
    const interval = setInterval(() => void loadTickets(), ADMIN_REALTIME_FALLBACK_INTERVAL_MS);
    const stopRealtime = subscribeToTableChanges({
      table: "support_requests",
      onChange: () => void loadTickets(),
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      stopRealtime();
    };
  }, [activeTab, loading, userProfile, supportPage, supportTypeFilter, supportStatusFilter, supportPriorityFilter, supportSearch]);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role === 'admin') {
      void getStaffUsers().then(setStaffMembers);
    }
  }, [userProfile]);

  // --- Helper para Feedback ---
  const showFeedback = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setFeedbackModal({ isOpen: true, type, title, message });
  };

  // --- HANDLERS (SUPORTE) ---
  const formatTicketStatus = (status: SupportTicket["status"]): string => {
    const labels: Record<string, string> = {
      pending: tAdmin("support.status.pending"),
      in_progress: tAdmin("support.status.inProgress"),
      resolved: tAdmin("support.status.resolved"),
      rejected: tAdmin("support.status.rejected"),
      under_review: tAdmin("support.status.underReview"),
      approved: tAdmin("support.status.approved"),
      implemented: tAdmin("support.status.implemented"),
    };
    return labels[status] || String(status);
  };

  const getTicketStatusTone = (status: SupportTicket["status"]) => {
    if (status === "resolved" || status === "implemented" || status === "approved") {
      return {
        badge: "bg-emerald-500",
        dot: "bg-emerald-500",
        border: "border-emerald-200",
      };
    }
    if (status === "pending" || status === "under_review") {
      return {
        badge: "bg-amber-500",
        dot: "bg-amber-500",
        border: "border-amber-200",
      };
    }
    if (status === "in_progress") {
      return {
        badge: "bg-blue-500",
        dot: "bg-blue-500",
        border: "border-blue-200",
      };
    }
    return {
      badge: "bg-red-500",
      dot: "bg-red-500",
      border: "border-red-200",
    };
  };

  const formatAuditAction = (action: string) =>
    action
      .replace(/\./g, " • ")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getMetricsAlertTone = (level: AdminMetricsAlert["level"]) => {
    if (level === "critical") {
      return "border-red-300 bg-red-50 text-red-800";
    }
    if (level === "high") {
      return "border-orange-300 bg-orange-50 text-orange-800";
    }
    return "border-amber-300 bg-amber-50 text-amber-800";
  };

  const onlyCriticalAlerts = useCallback(
    (alerts: AdminMetricsAlert[]) => alerts.filter((alert) => alert.level === "critical"),
    []
  );

  const getTicketPriorityLabel = (priority?: string) => {
    if (priority === "urgent") return tAdmin("support.priority.urgent");
    if (priority === "high") return tAdmin("support.priority.high");
    if (priority === "medium") return tAdmin("support.priority.medium");
    return tAdmin("support.priority.low");
  };

  const getTicketPriorityTone = (priority?: string) => {
    if (priority === "urgent") return "bg-red-600 text-white";
    if (priority === "high") return "bg-orange-500 text-white";
    if (priority === "medium") return "bg-amber-500 text-white";
    return "bg-zinc-500 text-white";
  };

  const getUserStatusLabel = (status: UserStatus | string) => {
    if (status === "active") return tAdmin("users.status.active");
    if (status === "blocked") return tAdmin("users.status.blocked");
    return tAdmin("users.status.inactive");
  };

  const isTicketFinalStatus = (status: SupportTicket["status"]) =>
    status === "resolved" || status === "implemented" || status === "rejected";

  const canEditTicketStatus = (ticket: SupportTicket) => {
    return userProfile?.role === "admin" || !isTicketFinalStatus(ticket.status);
  };

  const canEditTicketPriority = userProfile?.role === "admin" || userProfile?.role === "moderator";

  const parseIsoToMs = (value?: string | Date | null) => {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };

  const supportTicketsOrdered = useMemo(() => {
    const priorityRank: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return [...tickets].sort((a, b) => {
      const aOver = Boolean(a.slaBreached);
      const bOver = Boolean(b.slaBreached);
      if (aOver !== bOver) return aOver ? -1 : 1;

      const aPriority = priorityRank[String(a.priority || "low")] || 1;
      const bPriority = priorityRank[String(b.priority || "low")] || 1;
      if (aPriority !== bPriority) return bPriority - aPriority;

      return parseIsoToMs(b.createdAt) - parseIsoToMs(a.createdAt);
    });
  }, [tickets]);

  const supportQueueMetrics = useMemo(() => {
    const openTickets = tickets.filter(
      (ticket) => ticket.status !== "resolved" && ticket.status !== "implemented" && ticket.status !== "rejected"
    );
    const overdue = openTickets.filter((ticket) => ticket.slaBreached).length;
    const urgent = openTickets.filter((ticket) => ticket.priority === "urgent" || ticket.priority === "high").length;

    const finished = tickets.filter((ticket) => ticket.resolvedAt);
    const avgResolutionMinutes =
      finished.length === 0
        ? 0
        : Math.round(
          finished.reduce((acc, ticket) => {
            const start = parseIsoToMs(ticket.createdAt);
            const end = parseIsoToMs(ticket.resolvedAt || null);
            if (!start || !end || end < start) return acc;
            return acc + (end - start) / 60000;
          }, 0) / finished.length
        );

    return {
      open: openTickets.length,
      overdue,
      urgent,
      avgResolutionMinutes,
    };
  }, [tickets]);

  const handleRequestImpersonation = async (targetUser: UserProfile) => {
    try {
      const result = await requestImpersonationAccess(targetUser.uid);
      setImpersonationPollingTargetUid(targetUser.uid);
      const message = result.alreadyPending
        ? tAdmin("impersonation.pendingMessage")
        : tAdmin("impersonation.sentMessage");
      showFeedback("info", tAdmin("impersonation.title"), message);
    } catch {
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("impersonation.requestErrorMessage"));
    }
  };

  useEffect(() => {
    if (!impersonationPollingTargetUid) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const run = async () => {
      try {
        const status = await getMyImpersonationStatus(impersonationPollingTargetUid);
        if (cancelled) return;

        if (status.approved) {
          activateImpersonation(impersonationPollingTargetUid);
          setImpersonationPollingTargetUid(null);
          showFeedback("success", tAdmin("impersonation.activeTitle"), tAdmin("impersonation.activeMessage"));
          router.push("/dashboard");
          return;
        }

        const requestStatus = status.request?.status;
        if (requestStatus === "rejected" || requestStatus === "revoked" || requestStatus === "expired") {
          setImpersonationPollingTargetUid(null);
          showFeedback("info", tAdmin("impersonation.finishedTitle"), tAdmin("impersonation.rejectedMessage"));
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setImpersonationPollingTargetUid(null);
          showFeedback("info", tAdmin("impersonation.timeoutTitle"), tAdmin("impersonation.timeoutMessage"));
        }
      } catch {
        // polling best effort
      }
    };

    const timer = setInterval(() => {
      void run();
    }, 3000);

    void run();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [impersonationPollingTargetUid, router, tAdmin]);

  useEffect(() => {
    if (!userProfile) return;
    if (activeTab !== "support") return;
    if (unseenSupportTickets.length === 0) return;
    if (isMarkingSupportSeen) return;

    const ids = unseenSupportTickets.map((ticket) => ticket.id);
    setIsMarkingSupportSeen(true);
    void markSupportTicketsAsSeen(ids)
      .then(() => {
        setTickets((prev) =>
          prev.map((ticket) =>
            ids.includes(ticket.id)
              ? { ...ticket, staffSeenBy: Array.from(new Set([...(ticket.staffSeenBy || []), userProfile.uid])) }
              : ticket
          )
        );
      })
      .catch((err) => console.error(err))
      .finally(() => setIsMarkingSupportSeen(false));
  }, [activeTab, unseenSupportTickets, userProfile, isMarkingSupportSeen]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (activeTab !== "audit") return;

    let cancelled = false;

    const loadAuditLogs = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        setIsLoadingAuditLogs(true);
        const token = await user.getIdToken();
        const params = new URLSearchParams();
        params.set("page", String(auditPage));
        params.set("limit", String(auditPerPage));
        if (auditSearch.trim()) params.set("q", auditSearch.trim());
        if (auditActionFilter !== "all") params.set("action", auditActionFilter);
        if (auditActorUidFilter.trim()) params.set("actorUid", auditActorUidFilter.trim());
        if (auditTargetUidFilter.trim()) params.set("targetUid", auditTargetUidFilter.trim());
        if (auditFromDate) params.set("from", auditFromDate);
        if (auditToDate) params.set("to", auditToDate);

        const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          total?: number;
          data?: AdminAuditLog[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || tAdmin("audit.errors.load"));
        }

        if (!cancelled) {
          setAuditLogs(Array.isArray(payload.data) ? payload.data : []);
          setAuditTotal(Number(payload.total || 0));
        }
      } catch (error) {
        if (!cancelled) {
          setAuditLogs([]);
          setAuditTotal(0);
        }
        console.error(error);
      } finally {
        if (!cancelled) setIsLoadingAuditLogs(false);
      }
    };

    void loadAuditLogs();
    const interval = setInterval(() => void loadAuditLogs(), ADMIN_REALTIME_FALLBACK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, auditPage, auditPerPage, auditSearch, auditActionFilter, auditActorUidFilter, auditTargetUidFilter, auditFromDate, auditToDate, tAdmin, user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (activeTab !== "metrics") return;

    let cancelled = false;

    const loadMetrics = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        setIsLoadingMetrics(true);
        const token = await user.getIdToken();
        const params = new URLSearchParams();
        params.set("windowMinutes", metricsWindowMinutes || "60");

        const response = await fetch(`/api/admin/metrics?${params.toString()}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          summary?: AdminMetricsSummary;
          byRoute?: AdminMetricsRoute[];
          alerts?: AdminMetricsAlert[];
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || tAdmin("metrics.errors.load"));
        }

        if (!cancelled) {
          setMetricsSummary(payload.summary || null);
          setMetricsByRoute(Array.isArray(payload.byRoute) ? payload.byRoute : []);
          const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
          setMetricsAlerts(alerts);
          setCriticalMetricsAlerts(onlyCriticalAlerts(alerts));
        }
      } catch (error) {
        if (!cancelled) {
          setMetricsSummary(null);
          setMetricsByRoute([]);
          setMetricsAlerts([]);
          setCriticalMetricsAlerts([]);
        }
        console.error(error);
      } finally {
        if (!cancelled) setIsLoadingMetrics(false);
      }
    };

    void loadMetrics();
    const interval = setInterval(() => void loadMetrics(), ADMIN_MONITORING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, metricsWindowMinutes, onlyCriticalAlerts, tAdmin, user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;

    let cancelled = false;

    const loadCriticalAlerts = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/admin/metrics?windowMinutes=60", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as {
          ok: boolean;
          alerts?: AdminMetricsAlert[];
        };
        if (!response.ok || !payload.ok) return;
        if (cancelled) return;
        const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
        setCriticalMetricsAlerts(onlyCriticalAlerts(alerts));
      } catch {
        if (!cancelled) setCriticalMetricsAlerts([]);
      }
    };

    void loadCriticalAlerts();
    const timer = setInterval(() => void loadCriticalAlerts(), ADMIN_MONITORING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onlyCriticalAlerts, user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;

    let cancelled = false;

    const loadHealth = async () => {
      if (!shouldRefreshAdminNow()) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/admin/health", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as {
          ok: boolean;
          health?: AdminHealth;
          alerts?: AdminMetricsAlert[];
        };
        if (!response.ok || !payload.ok || cancelled) return;
        setHealthData(payload.health || null);
        setHealthAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
      } catch {
        if (!cancelled) {
          setHealthData(null);
          setHealthAlerts([]);
        }
      }
    };

    void loadHealth();
    const timer = setInterval(() => void loadHealth(), ADMIN_MONITORING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, userProfile]);

  const handleAssignTicket = async (ticketId: string, staffUid: string) => {
    const staff = staffMembers.find(s => s.uid === staffUid);
    const assignment = {
      assignedTo: staffUid,
      assignedToName: staff?.displayName || tAdmin("common.staff"),
    };
    try {
      await updateTicket(ticketId, assignment);
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, ...assignment } : ticket)));
      setViewTicket((ticket) => (ticket?.id === ticketId ? { ...ticket, ...assignment } : ticket));
      showFeedback("success", tAdmin("support.feedback.assignedTitle"), tAdmin("support.feedback.assignedMessage"));
    } catch {
      showFeedback("error", tAdmin("support.feedback.assignErrorTitle"), tAdmin("support.feedback.assignErrorMessage"));
    }
  };

  const handleChangeTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      await updateTicket(ticketId, { status } as Partial<SupportTicket>);
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status } : ticket)));
      setViewTicket((ticket) => (ticket?.id === ticketId ? { ...ticket, status } : ticket));
    } catch {
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("support.feedback.statusErrorMessage"));
    }
  };

  const handleChangeTicketPriority = async (
    ticketId: string,
    priority: TicketPriority
  ) => {
    try {
      await updateTicket(ticketId, { priority } as Partial<SupportTicket>);
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, priority } : ticket)));
      setViewTicket((ticket) => (ticket?.id === ticketId ? { ...ticket, priority } : ticket));
    } catch {
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("support.feedback.priorityErrorMessage"));
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    if (!canDeleteRecords) {
      showFeedback("error", tAdmin("feedback.accessDeniedTitle"), tAdmin("feedback.supremeAdminDeleteRecords"));
      setTicketToDelete(null);
      return;
    }
    try {
      await deleteTicket(ticketToDelete.id);
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketToDelete.id));
      setViewTicket((ticket) => (ticket?.id === ticketToDelete.id ? null : ticket));
      showFeedback("success", tAdmin("support.feedback.deletedTitle"), tAdmin("support.feedback.deletedMessage"));
    } catch {
      showFeedback("error", tAdmin("support.feedback.deleteErrorTitle"), tAdmin("support.feedback.deleteErrorMessage"));
    } finally {
      setTicketToDelete(null);
    }
  };

  // --- HANDLERS (GERAIS) ---
  const confirmNormalizeDB = async () => {
    setShowNormalizeConfirm(false);
    setIsNormalizing(true);
    try {
      const count = await normalizeDatabaseUsers();
      showFeedback("success", tAdmin("users.normalization.successTitle"), tAdmin("users.normalization.successMessage", { count }));
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("users.normalization.errorMessage"));
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleStatusChange = async (uid: string, newStatus: string) => {
    const status = newStatus as UserStatus;
    if (status === "inactive" || status === "blocked") {
      const u = users.find((x) => x.uid === uid);
      if (u) {
        setUserToBlock(u);
        setSelectedReason("");
        setCustomReason("");
      }
      return;
    }
    await updateUserStatus(uid, status);
  };

  const handleRestoreUser = (u: UserProfile, restoreData: boolean) => {
    setUserToRestore({ user: u, withData: restoreData });
  };

  const confirmRestoreUser = async () => {
    if (!userToRestore) return;
    if (isRestoreExpired(userToRestore.user)) {
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("restore.expiredWindowMessage"));
      setUserToRestore(null);
      return;
    }
    try {
      await restoreUserAccount(userToRestore.user.uid, userToRestore.withData);
      showFeedback("success", tAdmin("restore.restoredTitle"), tAdmin("restore.restoredMessage", { name: userToRestore.user.displayName }));
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("restore.restoreErrorMessage"));
    } finally {
      setUserToRestore(null);
    }
  };

  const confirmBlockUser = async () => {
    if (!userToBlock) return;
    const finalReason = selectedReason === "Outros" ? customReason : selectedReason;
    if (!finalReason) {
      showFeedback("error", tAdmin("block.requiredTitle"), tAdmin("block.requiredMessage"));
      return;
    }

    await updateUserStatus(userToBlock.uid, "blocked", finalReason);

    if (pendingPaymentChange && pendingPaymentChange.uid === userToBlock.uid) {
      await updateUserPaymentStatus(pendingPaymentChange.uid, pendingPaymentChange.status);
    }

    setUserToBlock(null);
    setPendingPaymentChange(null);
    setSelectedReason("");
    setCustomReason("");
  };

  const cancelBlockUser = () => {
    setUserToBlock(null);
    setPendingPaymentChange(null);
    setSelectedReason("");
    setCustomReason("");
  };

  const confirmReactivateUser = async () => {
    if (!userToReactivate) return;
    await updateUserStatus(userToReactivate.uid, "active");
    if (pendingPaymentChange && pendingPaymentChange.uid === userToReactivate.uid) {
      await updateUserPaymentStatus(pendingPaymentChange.uid, pendingPaymentChange.status);
    }
    setUserToReactivate(null);
    setPendingPaymentChange(null);
  };

  const cancelReactivateUser = () => {
    setUserToReactivate(null);
    setPendingPaymentChange(null);
  };

  const handlePlanChange = async (uid: string, newPlan: string) => {
    await updateUserPlan(uid, newPlan as UserPlan);
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    await updateUserRole(uid, newRole as UserRole);
  };

  const handlePaymentStatusChange = async (uid: string, newStatus: string) => {
    const status = newStatus as UserPaymentStatus;
    const u = users.find((user) => user.uid === uid);
    if (!u) return;

    if (status === "overdue") {
      setPendingPaymentChange({ uid, status });
      setUserToBlock(u);
      setSelectedReason("Falta de Pagamento");
      return;
    }
    if (status === "canceled") {
      setPendingPaymentChange({ uid, status });
      setUserToBlock(u);
      setSelectedReason("Outros");
      setCustomReason(tAdmin("block.subscriptionCancellation"));
      return;
    }

    if ((status === "paid" || status === "free") && (u.status === "blocked" || u.status === "inactive")) {
      setPendingPaymentChange({ uid, status });
      setUserToReactivate(u);
      return;
    }

    await updateUserPaymentStatus(uid, status);
  };

  const confirmResetData = async () => {
    if (!userToReset) return;
    if (!canDeleteRecords) {
      showFeedback("error", tAdmin("feedback.accessDeniedTitle"), tAdmin("feedback.supremeAdminResetData"));
      setUserToReset(null);
      return;
    }
    await resetUserFinancialData(userToReset.uid);
    setUserToReset(null);
    showFeedback("success", tAdmin("dialogs.dataResetTitle"), tAdmin("dialogs.dataResetMessage"));

    try {
      const count = await getUserTransactionCount(userToReset.uid);
      setUsers((prev) =>
        prev.map((u) => (u.uid === userToReset.uid ? { ...u, transactionCount: count } : u))
      );
    } catch { }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (!canDeleteRecords) {
      showFeedback("error", tAdmin("feedback.accessDeniedTitle"), tAdmin("feedback.supremeAdminArchiveAccounts"));
      setUserToDelete(null);
      return;
    }
    try {
      const data = { name: userToDelete.displayName, email: userToDelete.email };
      await softDeleteUser(userToDelete.uid);
      setDeletedUserData(data);
      setUserToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("dialogs.deleteUserErrorMessage"));
    }
  };

  const confirmPermanentDeleteUser = async () => {
    if (!userToPermanentDelete) return;
    if (!canDeleteRecords) {
      showFeedback("error", tAdmin("feedback.accessDeniedTitle"), tAdmin("feedback.supremeAdminPermanentDelete"));
      setUserToPermanentDelete(null);
      return;
    }
    try {
      await permanentlyDeleteUser(userToPermanentDelete.uid);
      showFeedback("success", tAdmin("dialogs.permanentDeleteCompletedTitle"), tAdmin("dialogs.permanentDeleteCompletedMessage", { name: userToPermanentDelete.displayName }));
    } catch (error) {
      console.error("Erro ao excluir permanentemente o usuário:", error);
      showFeedback("error", tAdmin("feedback.genericErrorTitle"), tAdmin("dialogs.permanentDeleteErrorMessage"));
    } finally {
      setUserToPermanentDelete(null);
    }
  };

  const handlePlanEdit = (
    planKey: keyof PlansConfig,
    field: keyof PlanDetails,
    value: string | number | boolean
  ) => {
    if (!editedPlans) return;
    setEditedPlans({
      ...editedPlans,
      [planKey]: {
        ...editedPlans[planKey],
        [field]: value,
      },
    });
  };

  const handleFeaturesEdit = (planKey: keyof PlansConfig, value: string) => {
    if (!editedPlans) return;
    const featuresArray = value.split("\n").filter((line) => line.trim() !== "");
    setEditedPlans({
      ...editedPlans,
      [planKey]: {
        ...editedPlans[planKey],
        features: featuresArray,
      },
    });
  };

  const getDefaultAccessSubjectId = useCallback((subjectType: AccessSubjectType) => {
    if (subjectType === "global") return "all";
    if (subjectType === "plan") return "free";
    if (subjectType === "role") return editedAccessControl?.roles[0]?.key || "client";
    return users[0]?.uid || "";
  }, [editedAccessControl?.roles, users]);

  const handleAccessSubjectTypeChange = (subjectType: AccessSubjectType) => {
    setAccessSubjectType(subjectType);
    setAccessSubjectId(getDefaultAccessSubjectId(subjectType));
  };

  const handleAccessRoleEdit = (
    index: number,
    field: keyof AccessRoleDefinition,
    value: string | boolean
  ) => {
    if (!editedAccessControl || !canManagePermissions) return;
    setEditedAccessControl({
      ...editedAccessControl,
      roles: editedAccessControl.roles.map((role, roleIndex) =>
        roleIndex === index ? { ...role, [field]: value } : role
      ),
    });
  };

  const handleAddAccessRole = () => {
    if (!editedAccessControl || !canManagePermissions) return;
    const id = crypto.randomUUID();
    setEditedAccessControl({
      ...editedAccessControl,
      roles: [
        ...editedAccessControl.roles,
        {
          id,
          key: `role_${id.slice(0, 6)}`,
          name: tAdmin("access.newRoleName"),
          description: "",
          active: true,
          system: false,
        },
      ],
    });
  };

  const handleRemoveAccessRole = (key: string) => {
    if (!editedAccessControl || !canDeletePermissions) return;
    setEditedAccessControl({
      roles: editedAccessControl.roles.filter((role) => role.key !== key || role.system),
      rules: editedAccessControl.rules.filter((rule) => rule.subjectType !== "role" || rule.subjectId !== key),
    });
  };

  const getAccessRuleForSelection = useCallback((resource: AccessResourceKey) => {
    const subjectId = accessSubjectType === "global" ? "all" : accessSubjectId;
    return editedAccessControl?.rules.find(
      (rule) =>
        rule.subjectType === accessSubjectType &&
        rule.subjectId === subjectId &&
        rule.resource === resource
    ) ?? null;
  }, [accessSubjectId, accessSubjectType, editedAccessControl?.rules]);

  const getAccessEditorLevel = useCallback((resource: AccessResourceKey): AccessEditorLevel => {
    const rule = getAccessRuleForSelection(resource);
    if (!rule || !rule.active) return "inherit";
    return rule.level;
  }, [getAccessRuleForSelection]);

  const handleAccessLevelChange = (resource: AccessResourceKey, level: AccessEditorLevel) => {
    if (!editedAccessControl || !canManagePermissions) return;
    if (resource === "billing.exempt" && accessSubjectType !== "role" && accessSubjectType !== "user") return;
    const subjectId = accessSubjectType === "global" ? "all" : accessSubjectId;
    if (!subjectId) return;
    const existing = getAccessRuleForSelection(resource);

    setEditedAccessControl({
      ...editedAccessControl,
      rules: existing
        ? editedAccessControl.rules.map((rule) =>
            rule.id === existing.id
              ? {
                  ...rule,
                  active: level !== "inherit",
                  level: level === "inherit" ? rule.level : level,
                }
              : rule
          )
        : [
            ...editedAccessControl.rules,
            {
              id: crypto.randomUUID(),
              subjectType: accessSubjectType,
              subjectId,
              resource,
              level: level === "inherit" ? "read" : level,
              label: "",
              active: level !== "inherit",
              startsAt: null,
              endsAt: null,
            },
          ],
    });
  };

  const handleBillingExemptionChange = (value: "inherit" | "exempt") => {
    handleAccessLevelChange("billing.exempt", value === "exempt" ? "read" : "inherit");
  };

  const getPermissionGroupLabel = (screenId: string, resource: AccessResourceKey, label: string) => {
    if (resource === "billing.exempt") return tAdmin("access.groups.billing");
    if (screenId !== "admin") return tAdmin("access.groups.general");
    if (resource.startsWith("admin.users.")) return tAdmin("access.groups.users");
    if (resource.startsWith("admin.support.")) return tAdmin("access.groups.support");
    if (resource.startsWith("admin.restore.")) return tAdmin("access.groups.restore");
    if (resource.startsWith("admin.plans.")) return tAdmin("access.groups.plans");
    if (resource.startsWith("admin.permissions.")) return tAdmin("access.groups.permissions");
    if (resource === "admin.pages.preview") return tAdmin("access.groups.screenAudit");
    if (resource === "admin.billing_jobs" || resource === "admin.retention_jobs" || resource === "admin.health") return tAdmin("access.groups.jobsHealth");
    if (resource === "admin.metrics.read") return tAdmin("access.groups.metrics");
    if (resource === "admin.audit.read") return tAdmin("access.groups.audit");
    if (resource === "admin.export") return tAdmin("access.groups.exports");
    if (resource === "admin.impersonation") return tAdmin("access.groups.impersonation");
    return label.split("·")[0].trim() || tAdmin("access.groups.general");
  };

  const getVisiblePermissionResources = (screen: (typeof ACCESS_SCREENS)[number]) => {
    const subjectResources = screen.resources.filter((resource) => {
      if (resource.key !== "billing.exempt") return true;
      return accessSubjectType === "role" || accessSubjectType === "user";
    });
    const groups = subjectResources.reduce((acc, resource) => {
      const group = getPermissionGroupLabel(screen.id, resource.key, resource.label);
      if (!acc[group]) acc[group] = [];
      acc[group].push(resource);
      return acc;
    }, {} as Record<string, typeof subjectResources>);
    const groupNames = Object.keys(groups);
    const selectedGroup = permissionGroupByScreen[screen.id] && groups[permissionGroupByScreen[screen.id]]
      ? permissionGroupByScreen[screen.id]
      : groupNames[0] || "Geral";
    return {
      groups,
      groupNames,
      selectedGroup,
      resources: groups[selectedGroup] || [],
      total: subjectResources.length,
    };
  };

  const saveAccessControl = async () => {
    if (!editedAccessControl) return;
    setIsSavingAccessControl(true);
    try {
      await updateAccessControlConfig(editedAccessControl);
      showFeedback("success", tAdmin("access.savedTitle"), tAdmin("access.savedMessage"));
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("access.saveErrorTitle"), tAdmin("access.saveErrorMessage"));
    } finally {
      setIsSavingAccessControl(false);
    }
  };

  const savePlans = async () => {
    if (!editedPlans) return;
    setIsSavingPlans(true);
    try {
      await updatePlansConfig(editedPlans);
      showFeedback("success", tAdmin("plans.savedTitle"), tAdmin("plans.savedMessage"));
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("plans.saveErrorTitle"), tAdmin("plans.saveErrorMessage"));
    } finally {
      setIsSavingPlans(false);
    }
  };

  // --- FILTRAGEM ---
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => u.status !== "deleted" && canViewRole(u.role));

    const rolePriority: Record<string, number> = {
      admin: 1, moderator: 2, support: 3, client: 4
    };
    return list.sort((a, b) => (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99));
  }, [users, canViewRole]);

  const handleExportUsersCsv = useCallback(async () => {
    try {
      setIsExportingCsv("users");
      await downloadAdminCsv("users", {
        q: searchTerm,
        role: roleFilter,
        plan: planFilter,
        status: statusFilter,
        paymentStatus: paymentStatusFilter,
      });
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("users.exportErrorTitle"), tAdmin("users.exportErrorMessage"));
    } finally {
      setIsExportingCsv(null);
    }
  }, [searchTerm, roleFilter, planFilter, statusFilter, paymentStatusFilter, tAdmin]);

  const clearSupportFilters = useCallback(() => {
    setSupportTypeFilter("all");
    setSupportStatusFilter("all");
    setSupportPriorityFilter("all");
    setSupportSearch("");
    setSupportPage(1);
  }, []);

  const handleExportSupportCsv = useCallback(async () => {
    try {
      setIsExportingCsv("support");
      await downloadAdminCsv("support", {
        q: supportSearch,
        type: supportTypeFilter,
        status: supportStatusFilter,
        priority: supportPriorityFilter,
      });
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("support.feedback.exportErrorTitle"), tAdmin("support.feedback.exportErrorMessage"));
    } finally {
      setIsExportingCsv(null);
    }
  }, [supportSearch, supportTypeFilter, supportStatusFilter, supportPriorityFilter, tAdmin]);

  const handleExportAuditCsv = useCallback(async () => {
    try {
      setIsExportingCsv("audit");
      await downloadAdminCsv("audit", {
        q: auditSearch,
        action: auditActionFilter,
        actorUid: auditActorUidFilter,
        targetUid: auditTargetUidFilter,
        from: auditFromDate,
        to: auditToDate,
      });
    } catch (error) {
      console.error(error);
      showFeedback("error", tAdmin("audit.errors.exportTitle"), tAdmin("audit.errors.exportMessage"));
    } finally {
      setIsExportingCsv(null);
    }
  }, [auditSearch, auditActionFilter, auditActorUidFilter, auditTargetUidFilter, auditFromDate, auditToDate, tAdmin]);

  const deletedUsers = useMemo(() => {
    return users.filter(u => u.status === 'deleted');
  }, [users]);

  const getRestoreDeadlineLabel = useCallback((user: UserProfile) => {
    const value = user.permanentDeleteAt || computePermanentDeleteAt(user.deletedAt || null);
    if (!value) return tAdmin("restore.deadlineNotProvided");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return tAdmin("restore.deadlineNotProvided");
    return parsed.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [locale, tAdmin]);

  const isRestoreExpired = useCallback((user: UserProfile) => {
    const value = user.permanentDeleteAt || computePermanentDeleteAt(user.deletedAt || null);
    return Boolean(value && new Date(value).getTime() <= Date.now());
  }, []);

  const totalPages = Math.ceil(usersTotal / usersPerPage);
  const paginatedUsers = filteredUsers;
  const supportTotalPages = Math.ceil(ticketsTotal / supportPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, planFilter, paymentStatusFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === "support") setSupportPage(1);
  }, [activeTab]);

  useEffect(() => {
    setSupportPage(1);
  }, [supportTypeFilter, supportStatusFilter, supportPriorityFilter, supportSearch]);

  const hasAdminAccess = Boolean(userProfile && userProfile.role !== "client" && allowedTabs.length > 0);
  const shouldLoadAdminConfig = Boolean(userProfile && userProfile.role !== "client");

  if (
    loading ||
    (user && !userProfile) ||
    (shouldLoadAdminConfig && (!editedAccessControl || !editedPlans))
  ) {
    return <AdminLoadingShell />;
  }

  if (!hasAdminAccess) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden p-4 pb-20 font-sans md:p-8">

      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/4 blur-[100px]" />
      </div>

      <div className="container relative z-10 mx-auto max-w-screen-2xl">
        <div className={`${fadeInUp} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8`}>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
              <ShieldAlert className="h-8 w-8 text-red-600" />
              {tAdmin("header.title")}
            </h1>
            <p className="text-muted-foreground">{tAdmin("header.subtitle")}</p>
          </div>

          {hasAdminPermission("users", "write") && activeTab === 'users' && (
            <Button
              onClick={() => setShowNormalizeConfirm(true)}
              disabled={isNormalizing}
              variant="outline"
              className="w-full gap-2 rounded-xl border-amber-200 bg-amber-50/80 text-amber-700 shadow-sm transition-all hover:cursor-pointer hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:w-auto sm:hover:scale-105"
            >
              {isNormalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {tAdmin("header.normalizeLegacyData")}
            </Button>
          )}
        </div>

        {criticalMetricsAlerts.length > 0 && (
          <div className={`${fadeInUp} mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-900`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" />
              {tAdmin("header.criticalAlerts", { count: criticalMetricsAlerts.length })}
            </div>
            <p className="text-xs mt-1">
              {criticalMetricsAlerts[0]?.title}: {criticalMetricsAlerts[0]?.description}
            </p>
          </div>
        )}

        <div className={`${fadeInUp} delay-150 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start xl:grid-cols-[280px_minmax(0,1fr)]`}>
          <aside className="hidden lg:block">
            <div className="app-panel-subtle sticky top-24 rounded-3xl border border-color:var(--app-panel-border) p-3 shadow-xl shadow-primary/10">
              <div className="px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{tAdmin("header.sidebarEyebrow")}</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">{tAdmin("header.sidebarTitle")}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tAdmin("header.sidebarDescription")}</p>
              </div>
              <nav className="mt-2 space-y-1" aria-label={tAdmin("header.navAria")}>
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setActiveTabAndPersist(item.id)}
                      className={getAdminNavButtonClass(active)}
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors", active ? "border-primary/30 bg-primary text-primary-foreground" : "border-color:var(--app-panel-border) bg-background/70 text-muted-foreground group-hover:text-foreground")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{item.label}</span>
                          {item.badge ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0 space-y-6">
            <div className="lg:hidden">
              <div className="app-panel-subtle flex gap-2 overflow-x-auto rounded-2xl border border-color:var(--app-panel-border) p-1.5 shadow-sm no-scrollbar" aria-label={tAdmin("header.navAria")}>
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => setActiveTabAndPersist(item.id)}
                      className={cn(
                        "flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      {item.badge ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Admin Nav Item */}
            {activeAdminNavItem ? (
              <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {(() => {
                      const ActiveIcon = activeAdminNavItem.icon;
                      return <ActiveIcon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-foreground">{activeAdminNavItem.label}</h2>
                    <p className="text-sm text-muted-foreground">{activeAdminNavItem.description}</p>
                  </div>
                </div>
              </div>
            ) : null}

          {/* --- SUPPORT TAB --- */}
          {activeTab === "support" && hasAdminPermission("support", "read") && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                <CardHeader className="app-panel-subtle border-b border-border/70 px-4 py-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <HeadphonesIcon className="h-5 w-5 text-primary" /> {tAdmin("support.title")}
                  </CardTitle>
                  <CardDescription>
                    {userProfile?.role === 'admin'
                      ? tAdmin("support.descriptionAdmin")
                      : tAdmin("support.descriptionStaff")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 gap-3 border-b border-color:var(--app-panel-border) p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-4">
                    <div className="app-panel-subtle rounded-xl border border-color:var(--app-panel-border) p-3">
                      <p className="text-xs text-muted-foreground">{tAdmin("support.metrics.openQueue")}</p>
                      <p className="text-lg font-bold">{supportQueueMetrics.open}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
                      <p className="text-xs text-red-600">{tAdmin("support.metrics.slaBreached")}</p>
                      <p className="text-lg font-bold text-red-600">{supportQueueMetrics.overdue}</p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
                      <p className="text-xs text-orange-700">{tAdmin("support.metrics.highUrgent")}</p>
                      <p className="text-lg font-bold text-orange-700">{supportQueueMetrics.urgent}</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-accent p-3">
                      <p className="text-xs text-primary">{tAdmin("support.metrics.avgResolution")}</p>
                      <p className="text-lg font-bold text-primary">{tAdmin("support.metrics.minutes", { value: supportQueueMetrics.avgResolutionMinutes })}</p>
                    </div>
                  </div>
                  <div className="space-y-3 border-b border-color:var(--app-panel-border) p-4 md:p-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      <Input
                        value={supportSearch}
                        onChange={(e) => setSupportSearch(e.target.value)}
                        className="h-10 rounded-xl"
                        placeholder={tAdmin("support.searchPlaceholder")}
                      />
                      <Select value={supportTypeFilter} onValueChange={(value) => setSupportTypeFilter(value as "support" | "feature" | "all")}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder={tAdmin("support.filters.type")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{tAdmin("support.filters.allTypes")}</SelectItem>
                          <SelectItem value="support">{tAdmin("support.type.support")}</SelectItem>
                          <SelectItem value="feature">{tAdmin("support.type.featurePlural")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={supportStatusFilter} onValueChange={setSupportStatusFilter}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder={tAdmin("support.filters.status")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{tAdmin("support.filters.allStatuses")}</SelectItem>
                          <SelectItem value="pending">{tAdmin("support.status.pending")}</SelectItem>
                          <SelectItem value="in_progress">{tAdmin("support.status.inProgress")}</SelectItem>
                          <SelectItem value="resolved">{tAdmin("support.status.resolved")}</SelectItem>
                          <SelectItem value="rejected">{tAdmin("support.status.rejected")}</SelectItem>
                          <SelectItem value="under_review">{tAdmin("support.status.underReview")}</SelectItem>
                          <SelectItem value="approved">{tAdmin("support.status.approved")}</SelectItem>
                          <SelectItem value="implemented">{tAdmin("support.status.implemented")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={supportPriorityFilter} onValueChange={(value) => setSupportPriorityFilter(value as "low" | "medium" | "high" | "urgent" | "all")}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder={tAdmin("support.filters.priority")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{tAdmin("support.filters.allPriorities")}</SelectItem>
                          <SelectItem value="low">{tAdmin("support.priority.low")}</SelectItem>
                          <SelectItem value="medium">{tAdmin("support.priority.medium")}</SelectItem>
                          <SelectItem value="high">{tAdmin("support.priority.high")}</SelectItem>
                          <SelectItem value="urgent">{tAdmin("support.priority.urgent")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto" onClick={clearSupportFilters}>
                        <FilterX className="mr-2 h-4 w-4" /> {tAdmin("common.clearFilters")}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 w-full rounded-xl sm:w-auto"
                        onClick={() => void handleExportSupportCsv()}
                        disabled={isExportingCsv === "support"}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isExportingCsv === "support" ? tAdmin("common.exporting") : tAdmin("common.exportCsv")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 md:p-5 2xl:grid-cols-2">
                    {supportTicketsOrdered.length === 0 ? (
                      <div className="app-panel-subtle col-span-full flex h-32 items-center justify-center rounded-2xl border border-color:var(--app-panel-border) text-muted-foreground">
                        {tAdmin("support.empty")}
                      </div>
                    ) : (
                      supportTicketsOrdered.map((ticket) => {
                        const tone = getTicketStatusTone(ticket.status);
                        const dateStr = formatDateSafe(ticket.createdAt) ?? tAdmin("common.invalidDate");
                        const isUnseen = !Array.isArray(ticket.staffSeenBy) || (userProfile ? !ticket.staffSeenBy.includes(userProfile.uid) : false);

                        return (
                          <div
                            key={ticket.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewTicket(ticket)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setViewTicket(ticket);
                              }
                            }}
                            className={`app-panel-subtle cursor-pointer rounded-2xl border ${tone.border} p-4 space-y-3 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-500">{dateStr}</p>
                                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{ticket.name}</p>
                                <p className="text-xs text-zinc-500 truncate">{ticket.email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isUnseen && <Bell className="h-4 w-4 text-red-500" />}
                                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {ticket.type === 'feature' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                  <Lightbulb className="h-3 w-3" /> {tAdmin("support.type.feature")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 border-primary/20 bg-accent text-primary">
                                  <MessageSquare className="h-3 w-3" /> {tAdmin("support.type.support")}
                                </Badge>
                              )}
                              {ticket.supportKind === "account_restore" && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                  <ArchiveRestore className="h-3 w-3" /> {tAdmin("support.accountRestore")}
                                </Badge>
                              )}
                              <Badge className={tone.badge}>{formatTicketStatus(ticket.status)}</Badge>
                              <Badge className={getTicketPriorityTone(ticket.priority)}>
                                {tAdmin("support.priorityLabel", { priority: getTicketPriorityLabel(ticket.priority) })}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {tAdmin("support.protocolLabel", { protocol: ticket.protocol || `#${ticket.id.slice(0, 8)}` })}
                              </Badge>
                              {ticket.slaBreached && (
                                <Badge className="bg-red-600 text-white">{tAdmin("support.slaBreached")}</Badge>
                              )}
                            </div>

                            <button
                              type="button"
                              className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 hover:underline"
                              onClick={() => setViewTicket(ticket)}
                            >
                              {ticket.message}
                            </button>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="text-xs text-zinc-600" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                {userProfile?.role === 'admin' ? (
                                  <Select
                                    value={ticket.assignedTo || "unassigned"}
                                    onValueChange={(val) => handleAssignTicket(ticket.id, val)}
                                  >
                                    <SelectTrigger className="h-8 w-full max-w-full text-xs sm:w-[260px]">
                                      <SelectValue placeholder={tAdmin("support.assignPlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">-- {tAdmin("common.nobody")} --</SelectItem>
                                      {staffMembers.map(staff => (
                                        <SelectItem key={staff.uid} value={staff.uid}>
                                          {staff.displayName || staff.email} ({staff.role})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span>{ticket.assignedToName || (ticket.assignedTo ? tAdmin("common.staff") : tAdmin("common.nobody"))}</span>
                                )}
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setViewTicket(ticket);
                                }}
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                {tAdmin("support.detailsAction")}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="hidden overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-zinc-50 dark:bg-zinc-950">
                        <TableRow className="border-zinc-100 dark:border-zinc-800 hover:bg-transparent">
                          <TableHead className="pl-6 font-semibold">{tAdmin("common.date")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("common.requester")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("support.filters.type")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("common.message")}</TableHead>
                          <TableHead className="font-semibold text-center">{tAdmin("common.status")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("common.responsible")}</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">{tAdmin("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supportTicketsOrdered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                              {tAdmin("support.empty")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          supportTicketsOrdered.map(ticket => {
                            const isFinished = ticket.status === 'resolved' || ticket.status === 'implemented' || ticket.status === 'rejected';
                            const canEditStatus = userProfile?.role === 'admin' || !isFinished;
                            const dateStr = formatDateSafe(ticket.createdAt) ?? tAdmin("common.invalidDate");


                            return (
                              <TableRow key={ticket.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800">
                                <TableCell className="pl-6 text-xs text-zinc-500">
                                  {dateStr}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{ticket.name}</span>
                                    <span className="text-xs text-zinc-500">{ticket.email}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {ticket.type === 'feature' ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                      <Lightbulb className="h-3 w-3" /> {tAdmin("support.type.feature")}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 border-primary/20 bg-accent text-primary">
                                      <MessageSquare className="h-3 w-3" /> {tAdmin("support.type.support")}
                                    </Badge>
                                  )}
                                  {ticket.supportKind === "account_restore" && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                      <ArchiveRestore className="h-3 w-3" /> {tAdmin("support.accountRestore")}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer hover:underline" onClick={() => setViewTicket(ticket)}>
                                    {ticket.message}
                                  </p>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge className={`
                                                          ${ticket.status === 'resolved' || ticket.status === 'implemented' || ticket.status === 'approved' ? 'bg-emerald-500' : ''}
                                                          ${ticket.status === 'pending' || ticket.status === 'under_review' ? 'bg-amber-500' : ''}
                                                          ${ticket.status === 'in_progress' ? 'bg-blue-500' : ''}
                                                          ${ticket.status === 'rejected' ? 'bg-red-500' : ''}
                                                      `}>
                                      {formatTicketStatus(ticket.status)}
                                    </Badge>
                                    <Badge className={getTicketPriorityTone(ticket.priority)}>
                                      {getTicketPriorityLabel(ticket.priority)}
                                    </Badge>
                                    <p className="text-[10px] text-zinc-500">
                                      {ticket.protocol || `#${ticket.id.slice(0, 8)}`}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {userProfile?.role === 'admin' ? (
                                    <Select
                                      value={ticket.assignedTo || "unassigned"}
                                      onValueChange={(val) => handleAssignTicket(ticket.id, val)}
                                    >
                                      <SelectTrigger className="h-8 w-full max-w-full text-xs sm:w-[220px]">
                                        <SelectValue placeholder={tAdmin("support.assignPlaceholder")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned">-- {tAdmin("common.nobody")} --</SelectItem>
                                        {staffMembers.map(staff => (
                                          <SelectItem key={staff.uid} value={staff.uid}>
                                            {staff.displayName || staff.email} ({staff.role})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs font-medium text-zinc-600">
                                      {ticket.assignedToName || (ticket.assignedTo ? tAdmin("common.staff") : tAdmin("common.nobody"))}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                                        <MoreVertical className="h-4 w-4 text-zinc-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      side="top"
                                      sideOffset={8}
                                      className="w-48 max-h-[min(70vh,24rem)] rounded-xl border border-zinc-200/70 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
                                    >
                                      <DropdownMenuItem onClick={() => setViewTicket(ticket)}>
                                        <Eye className="mr-2 h-4 w-4" /> {tAdmin("support.viewDetails")}
                                      </DropdownMenuItem>

                                      {canEditStatus && (
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger
                                            className="rounded-lg font-medium text-zinc-700 dark:text-zinc-200"
                                          >
                                            <span className="flex items-center">
                                              <RefreshCcw className="mr-2 h-4 w-4 text-zinc-500" />
                                              {tAdmin("support.changeStatus")}
                                            </span>
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="w-56 max-h-[min(70vh,22rem)] rounded-xl border border-zinc-200/70 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                                            {ticket.type === 'support' && (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  {tAdmin("support.status.pending")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'in_progress')}
                                                  className="rounded-lg text-sm focus:bg-blue-50 focus:text-blue-900 dark:focus:bg-blue-950/30 dark:focus:text-blue-100"
                                                >
                                                  {tAdmin("support.status.inProgress")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'resolved')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  {tAdmin("support.status.resolved")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}
                                                  className="rounded-lg text-sm focus:bg-red-50 focus:text-red-900 dark:focus:bg-red-950/30 dark:focus:text-red-100"
                                                >
                                                  {tAdmin("support.status.rejected")}
                                                </DropdownMenuItem>
                                              </>
                                            )}

                                            {ticket.type === 'feature' && (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  {tAdmin("support.status.pending")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'under_review')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  {tAdmin("support.status.underReview")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'approved')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  {tAdmin("support.status.approved")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}
                                                  className="rounded-lg text-sm focus:bg-red-50 focus:text-red-900 dark:focus:bg-red-950/30 dark:focus:text-red-100"
                                                >
                                                  {tAdmin("support.status.rejected")}
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'implemented')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  {tAdmin("support.status.implemented")}
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                      )}

                                      {(userProfile?.role === "admin" || userProfile?.role === "moderator") && (
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger
                                            className="rounded-lg font-medium text-zinc-700 dark:text-zinc-200"
                                          >
                                            {tAdmin("common.priority")}
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="w-44 rounded-xl border border-zinc-200/70 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "low")}>{tAdmin("support.priority.low")}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "medium")}>{tAdmin("support.priority.medium")}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "high")}>{tAdmin("support.priority.high")}</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "urgent")}>{tAdmin("support.priority.urgent")}</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                      )}

                                      {canDeleteRecords && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => setTicketToDelete(ticket)}
                                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950 hover:cursor-pointer"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("common.delete")}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="app-panel-subtle flex flex-col gap-3 border-t border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {tAdmin("support.pageSummary", { page: supportPage, totalPages: supportTotalPages || 1, total: ticketsTotal })}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg"
                        disabled={supportPage === 1}
                        onClick={() => setSupportPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg"
                        disabled={supportPage === supportTotalPages || supportTotalPages === 0}
                        onClick={() => setSupportPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- AUDIT TAB --- */}
          {activeTab === "audit" && hasAdminPermission("audit", "read") && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                <CardHeader className="app-panel-subtle border-b border-border/70 px-4 py-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" /> {tAdmin("audit.title")}
                  </CardTitle>
                  <CardDescription>
                    {tAdmin("audit.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
                      <Input
                        value={auditSearch}
                        onChange={(e) => {
                          setAuditSearch(e.target.value);
                          setAuditPage(1);
                        }}
                        className="pl-10 h-10 rounded-xl"
                        placeholder={tAdmin("audit.searchPlaceholder")}
                      />
                    </div>
                    <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                      {tAdmin("audit.recordsLabel", { count: auditTotal })}
                    </Badge>
                    <Button
                      variant="outline"
                      className="h-10 w-full rounded-xl md:w-auto"
                      onClick={() => void handleExportAuditCsv()}
                      disabled={isExportingCsv === "audit"}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isExportingCsv === "audit" ? tAdmin("common.exporting") : tAdmin("common.exportCsv")}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    <Select
                      value={auditActionFilter}
                      onValueChange={(value) => {
                        setAuditActionFilter(value);
                        setAuditPage(1);
                      }}
                    >
                      <SelectTrigger className="rounded-xl h-10">
                        <SelectValue placeholder={tAdmin("audit.filters.action")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tAdmin("audit.filters.allActions")}</SelectItem>
                        <SelectItem value="admin.users.patch">{tAdmin("audit.actions.userPatch")}</SelectItem>
                        <SelectItem value="admin.users.normalize">{tAdmin("audit.actions.normalize")}</SelectItem>
                        <SelectItem value="admin.users.reset_financial_data">{tAdmin("audit.actions.resetFinancialData")}</SelectItem>
                        <SelectItem value="admin.users.soft_delete">{tAdmin("audit.actions.softDelete")}</SelectItem>
                        <SelectItem value="admin.users.restore">{tAdmin("audit.actions.restore")}</SelectItem>
                        <SelectItem value="admin.users.recount_transaction_count">{tAdmin("audit.actions.recountTransactions")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={auditActorUidFilter}
                      onChange={(e) => {
                        setAuditActorUidFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                      placeholder={tAdmin("audit.actorUidPlaceholder")}
                    />

                    <Input
                      value={auditTargetUidFilter}
                      onChange={(e) => {
                        setAuditTargetUidFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                      placeholder={tAdmin("audit.targetUidPlaceholder")}
                    />

                    <Input
                      type="date"
                      value={auditFromDate}
                      onChange={(e) => {
                        setAuditFromDate(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                    />

                    <Input
                      type="date"
                      value={auditToDate}
                      onChange={(e) => {
                        setAuditToDate(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-3">
                    {isLoadingAuditLogs ? (
                      <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {tAdmin("audit.loading")}
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-muted-foreground">
                        {tAdmin("audit.empty")}
                      </div>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="app-panel-subtle space-y-2 rounded-2xl border border-color:var(--app-panel-border) p-3 md:p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatAuditAction(log.action)}</p>
                            <Badge className="bg-zinc-800 text-white">{(log.method || "N/A").toUpperCase()}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                            <p><span className="font-semibold">{tAdmin("audit.fields.actor")}:</span> {log.actorUid || "-"}</p>
                            <p><span className="font-semibold">{tAdmin("audit.fields.target")}:</span> {log.targetUid || "-"}</p>
                            <p><span className="font-semibold">{tAdmin("audit.fields.when")}:</span> {formatDateSafe(log.createdAt) ?? tAdmin("common.invalidDate")}</p>
                            <p className="md:col-span-2 break-all"><span className="font-semibold">{tAdmin("audit.fields.route")}:</span> {log.route || "-"}</p>
                            <p className="break-all"><span className="font-semibold">{tAdmin("audit.fields.ip")}:</span> {log.ip || "-"}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="app-panel-subtle flex flex-col gap-3 border-t border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-zinc-500">
                      {tAdmin("audit.pageSummary", { page: auditPage, totalPages: Math.max(1, Math.ceil(auditTotal / auditPerPage)) })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((prev) => Math.max(prev - 1, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg"
                        disabled={auditPage >= Math.max(1, Math.ceil(auditTotal / auditPerPage))}
                        onClick={() =>
                          setAuditPage((prev) =>
                            Math.min(prev + 1, Math.max(1, Math.ceil(auditTotal / auditPerPage)))
                          )
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- METRICS TAB --- */}
          {activeTab === "metrics" && hasAdminPermission("metrics", "read") && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                <CardHeader className="app-panel-subtle border-b border-border/70 px-4 py-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Calculator className="h-5 w-5 text-primary" /> {tAdmin("metrics.title")}
                  </CardTitle>
                  <CardDescription>
                    {tAdmin("metrics.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Select value={metricsWindowMinutes} onValueChange={setMetricsWindowMinutes}>
                      <SelectTrigger className="rounded-xl h-10 w-full md:w-56">
                        <SelectValue placeholder={tAdmin("metrics.filters.window")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">{tAdmin("metrics.filters.last15Minutes")}</SelectItem>
                        <SelectItem value="60">{tAdmin("metrics.filters.lastHour")}</SelectItem>
                        <SelectItem value="180">{tAdmin("metrics.filters.last3Hours")}</SelectItem>
                        <SelectItem value="1440">{tAdmin("metrics.filters.last24Hours")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {healthData && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      <Card className={`rounded-2xl border ${healthData.dbHealthy ? "border-emerald-200" : "border-red-300"}`}>
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">{tAdmin("metrics.health.database")}</p>
                          <p className={`text-base font-bold ${healthData.dbHealthy ? "text-emerald-700" : "text-red-700"}`}>
                            {healthData.dbHealthy ? tAdmin("metrics.health.healthy") : tAdmin("metrics.health.failed")}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">{tAdmin("metrics.health.webhookDelay")}</p>
                          <p className="text-base font-bold">{tAdmin("support.metrics.minutes", { value: healthData.webhookDelayMinutes ?? "-" })}</p>
                        </CardContent>
                      </Card>
                      <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">{tAdmin("metrics.health.paymentFailures24h")}</p>
                          <p className="text-base font-bold">{healthData.failedPayments24h}</p>
                        </CardContent>
                      </Card>
                      <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">{tAdmin("metrics.health.pendingRecovery")}</p>
                          <p className="text-base font-bold">{healthData.pendingRecoveryUsers}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {!isLoadingMetrics && healthAlerts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {healthAlerts.map((alert, idx) => (
                        <div key={`${alert.code}-${idx}`} className={`rounded-2xl border px-4 py-3 ${getMetricsAlertTone(alert.level)}`}>
                          <p className="text-sm font-bold">{alert.title}</p>
                          <p className="text-xs mt-1">{alert.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isLoadingMetrics && metricsAlerts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {metricsAlerts.map((alert, idx) => (
                        <div
                          key={`${alert.code ?? alert.title}-${idx}`}
                          className={`rounded-2xl border px-4 py-3 ${getMetricsAlertTone(alert.level)}`}
                        >
                          <p className="text-sm font-bold">{alert.title}</p>
                          <p className="text-xs mt-1">{alert.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isLoadingMetrics ? (
                    <div className="app-panel-subtle flex h-24 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> {tAdmin("metrics.loading")}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                        <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">{tAdmin("metrics.summary.totalRequests")}</p>
                            <p className="text-xl font-bold">{metricsSummary?.total ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-red-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-red-600">{tAdmin("metrics.summary.serverErrors")}</p>
                            <p className="text-xl font-bold text-red-600">{metricsSummary?.errors ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-amber-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-amber-700">{tAdmin("metrics.summary.rateLimited")}</p>
                            <p className="text-xl font-bold text-amber-700">{metricsSummary?.rateLimited ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-primary/20 bg-accent">
                          <CardContent className="p-3">
                            <p className="text-xs text-primary">{tAdmin("metrics.summary.averageLatency")}</p>
                            <p className="text-xl font-bold text-primary">{tAdmin("metrics.summary.milliseconds", { value: metricsSummary?.avgDurationMs ?? 0 })}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-red-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-red-600">{tAdmin("metrics.summary.errorRate")}</p>
                            <p className="text-xl font-bold text-red-600">{metricsSummary?.errorRatePct ?? 0}%</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-amber-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-amber-700">{tAdmin("metrics.summary.rate429")}</p>
                            <p className="text-xl font-bold text-amber-700">{metricsSummary?.rateLimitedPct ?? 0}%</p>
                          </CardContent>
                        </Card>
                        <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">{tAdmin("metrics.summary.previousWindow")}</p>
                            <p className="text-xl font-bold">{metricsSummary?.previousTotal ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">{tAdmin("metrics.summary.trafficChange")}</p>
                            <p className={`text-xl font-bold ${(metricsSummary?.trafficDropPct ?? 0) > 0 ? "text-orange-700" : "text-emerald-700"}`}>
                              {(metricsSummary?.trafficDropPct ?? 0).toFixed(2)}%
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-color:var(--app-panel-border)">
                        <Table className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>{tAdmin("metrics.table.route")}</TableHead>
                              <TableHead>{tAdmin("metrics.table.total")}</TableHead>
                              <TableHead>{tAdmin("metrics.table.errors")}</TableHead>
                              <TableHead>429</TableHead>
                              <TableHead>{tAdmin("metrics.table.averageLatency")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metricsByRoute.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="h-20 text-center text-zinc-500">
                                  {tAdmin("metrics.table.empty")}
                                </TableCell>
                              </TableRow>
                            ) : (
                              metricsByRoute.map((row) => (
                                <TableRow key={row.route}>
                                  <TableCell className="max-w-[360px] font-medium">
                                    <span className="block truncate" title={row.route}>{row.route}</span>
                                  </TableCell>
                                  <TableCell>{row.total}</TableCell>
                                  <TableCell className="text-red-600">{row.errors}</TableCell>
                                  <TableCell className="text-amber-700">{row.rateLimited}</TableCell>
                                  <TableCell>{tAdmin("metrics.summary.milliseconds", { value: row.avgDurationMs })}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- USERS TAB --- */}
          {activeTab === "users" && hasAdminPermission("users", "read") && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              {/* Filtros e Busca */}
              <div className="space-y-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder={tAdmin("users.searchPlaceholder")}
                    className="h-11 rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg) pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {/* Filtro: Plano */}
                  <Select value={planFilter} onValueChange={(val) => setPlanFilter(val as UserPlan | "all")}>
                    <SelectTrigger className="h-11 w-full rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue placeholder={tAdmin("users.filters.plan")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tAdmin("users.filters.allPlans")}</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro: Cargo */}
                  <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as UserRole | "all")}>
                    <SelectTrigger className="h-11 w-full rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue placeholder={tAdmin("users.filters.role")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tAdmin("users.filters.allRoles")}</SelectItem>
                      {accessControlConfig.roles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filtro: Status */}
                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as UserStatus | "all")}>
                    <SelectTrigger className="h-11 w-full rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue placeholder={tAdmin("users.filters.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tAdmin("users.filters.allStatuses")}</SelectItem>
                      <SelectItem value="active">{tAdmin("users.status.active")}</SelectItem>
                      <SelectItem value="inactive">{tAdmin("users.status.inactive")}</SelectItem>
                      <SelectItem value="blocked">{tAdmin("users.status.blocked")}</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro: Pagamento */}
                  <Select value={paymentStatusFilter} onValueChange={(val) => setPaymentStatusFilter(val as PaymentFilterType)}>
                    <SelectTrigger className="h-11 w-full rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue placeholder={tAdmin("users.filters.payment")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tAdmin("users.filters.allPayments")}</SelectItem>
                      <SelectItem value="free">{tAdmin("users.payment.free")}</SelectItem>
                      <SelectItem value="paid">{tAdmin("users.payment.paid")}</SelectItem>
                      <SelectItem value="pending">{tAdmin("users.payment.pending")}</SelectItem>
                      <SelectItem value="not_paid">{tAdmin("users.payment.notPaid")}</SelectItem>
                      <SelectItem value="overdue">{tAdmin("users.payment.overdue")}</SelectItem>
                      <SelectItem value="canceled">{tAdmin("users.payment.canceled")}</SelectItem>
                      <SelectItem value="unpaid_group" className="text-red-500 font-medium">{tAdmin("users.filters.unpaidGroup")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-xl sm:w-auto"
                    onClick={clearUsersFilters}
                  >
                    <FilterX className="mr-2 h-4 w-4" /> {tAdmin("common.clearFilters")}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-xl sm:w-auto"
                    onClick={() => void handleExportUsersCsv()}
                    disabled={isExportingCsv === "users"}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingCsv === "users" ? tAdmin("common.exporting") : tAdmin("common.exportCsv")}
                  </Button>
                </div>
              </div>

              <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                <CardHeader className="border-b border-color:var(--app-panel-border) bg-accent/70 px-4 py-4 dark:bg-accent/20 sm:px-6">
                  <CardTitle className="text-lg font-semibold text-primary">{tAdmin("users.tableTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="md:hidden p-3 space-y-3">
                    {isLoadingUsers ? (
                      <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {tAdmin("users.loadingDatabase")}
                      </div>
                    ) : paginatedUsers.length === 0 ? (
                      <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-muted-foreground">
                        {tAdmin("users.empty")}
                      </div>
                    ) : (
                      paginatedUsers.map((u) => {
                        const isTargetAdminOrMod = hasBillingExemption(accessControlConfig, { uid: u.uid, role: u.role });
                        const canChangeRole = canEditRole(u);
                        const canChangePlan = canEditPlan(u);
                        const canEditThisUser = canEditUser(u);
                        const canResetThisUser = canResetUser(u);
                        const canDeleteThisUser = canDeleteUser(u);
                        const canChangePayment = canEditThisUser || (userProfile?.role === "admin" && u.uid === userProfile.uid);
                        return (
                          <div key={u.uid} className="app-panel-subtle space-y-3 rounded-2xl border border-color:var(--app-panel-border) p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{u.displayName}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{u.email}</p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                  {tAdmin("users.registrationLabel", { date: new Date(u.createdAt).toLocaleDateString() })}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100">
                                    <MoreVertical className="h-4 w-4 text-zinc-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl p-1 shadow-xl border-zinc-200 dark:border-zinc-800">
                                  <DropdownMenuLabel className="text-xs">{tAdmin("common.actions")}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {canImpersonateUsers && u.uid !== userProfile?.uid && (
                                    <DropdownMenuItem
                                      onClick={() => handleRequestImpersonation(u)}
                                      disabled={!canEditThisUser}
                                      className="cursor-pointer rounded-lg text-xs font-medium"
                                    >
                                      <User className="mr-2 h-4 w-4" /> {tAdmin("users.menu.impersonate")}
                                    </DropdownMenuItem>
                                  )}
                                  {canDeleteRecords && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => setUserToReset(u)}
                                        disabled={!canResetThisUser}
                                        className="cursor-pointer rounded-lg text-xs font-medium disabled:opacity-50"
                                      >
                                        <RefreshCcw className="mr-2 h-4 w-4" /> {tAdmin("users.menu.resetData")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setUserToDelete(u)}
                                        disabled={!canDeleteThisUser}
                                        className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg text-xs font-medium dark:focus:bg-red-900/20 disabled:opacity-50"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("users.menu.deleteAccount")}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">{tAdmin("common.plan")}</p>
                                {canChangePlan ? (
                                  <Select value={u.plan} onValueChange={(val) => handlePlanChange(u.uid, val)}>
                                    <SelectTrigger className="w-full h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="free">Free</SelectItem>
                                      <SelectItem value="premium">Premium</SelectItem>
                                      <SelectItem value="pro">Pro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary" className="mt-1">{u.plan.toUpperCase()}</Badge>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] text-zinc-400 uppercase">{tAdmin("users.role")}</p>
                                {canChangeRole ? (
                                  <Select value={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
                                    <SelectTrigger className="w-full h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {accessControlConfig.roles.map((role) => (
                                        <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary" className="mt-1">
                                    {accessControlConfig.roles.find((role) => role.key === u.role)?.name || u.role}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-zinc-200">
                                {tAdmin("users.recordsLabel", { count: Number.isNaN(u.transactionCount) ? "..." : (u.transactionCount ?? "...") })}
                              </Badge>
                              <Badge variant={u.status === "active" ? "default" : "destructive"} className={u.status === "active" ? "bg-emerald-500" : ""}>
                                {getUserStatusLabel(u.status)}
                              </Badge>
                            </div>

                            <div>
                              <p className="text-[10px] text-zinc-400 uppercase mb-1">{tAdmin("common.payment")}</p>
                              {isTargetAdminOrMod ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <ShieldCheck className="h-3 w-3 mr-1" /> {tAdmin("users.payment.exempt")}
                                </Badge>
                              ) : (
                                <Select
                                  value={u.paymentStatus || "free"}
                                  onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}
                                  disabled={!canChangePayment}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">{tAdmin("users.payment.free")}</SelectItem>
                                    <SelectItem value="paid">{tAdmin("users.payment.paid")}</SelectItem>
                                    <SelectItem value="pending">{tAdmin("users.payment.pending")}</SelectItem>
                                    <SelectItem value="not_paid">{tAdmin("users.payment.notPaid")}</SelectItem>
                                    <SelectItem value="overdue">{tAdmin("users.payment.overdue")}</SelectItem>
                                    <SelectItem value="canceled">{tAdmin("users.payment.canceled")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[1040px]">
                      <TableHeader className="bg-accent/70 dark:bg-accent/20">
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="pl-6 font-semibold">{tAdmin("common.user")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("users.createdAt")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("common.plan")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("users.role")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("users.records")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("users.paymentStatus")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("users.userStatus")}</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">{tAdmin("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoadingUsers ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center">
                              <div className="flex justify-center items-center gap-2 text-zinc-500">
                                <Loader2 className="h-5 w-5 animate-spin" /> {tAdmin("users.loadingDatabase")}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                              {tAdmin("users.empty")}
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.map((u) => {
                          const isTargetAdminOrMod = hasBillingExemption(accessControlConfig, { uid: u.uid, role: u.role });
                          const canChangeRole = canEditRole(u);
                          const canChangePlan = canEditPlan(u);
                          const canEditThisUser = canEditUser(u);
                          const canResetThisUser = canResetUser(u);
                          const canDeleteThisUser = canDeleteUser(u);
                          const canToggleStatusForUser = canToggleUserStatus(u);
                          const canChangePayment = canEditThisUser || (userProfile?.role === "admin" && u.uid === userProfile.uid);

                          return (
                              <TableRow key={u.uid} className="border-color:var(--app-panel-border) transition-colors hover:bg-accent/60">
                              <TableCell className="pl-6">
                                <div className="max-w-[260px]">
                                  <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100" title={u.displayName}>
                                    {u.displayName}
                                  </p>
                                  <p className="truncate text-xs text-zinc-500" title={u.email}>{u.email}</p>
                                </div>
                              </TableCell>

                              <TableCell className="text-zinc-500 text-xs font-medium">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </TableCell>

                              <TableCell>
                                {canChangePlan ? (
                                  <Select value={u.plan} onValueChange={(val) => handlePlanChange(u.uid, val)}>
                                    <SelectTrigger className="h-8 w-[120px] rounded-lg border-color:var(--app-field-border) bg-var(--app-field-bg) text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="free">Free</SelectItem>
                                      <SelectItem value="premium">Premium</SelectItem>
                                      <SelectItem value="pro">Pro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg w-fit cursor-not-allowed">
                                    <Lock className="h-3 w-3" /> {u.plan.toUpperCase()}
                                  </div>
                                )}
                              </TableCell>

                              <TableCell>
                                {canChangeRole ? (
                                  <Select value={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
                                    <SelectTrigger className="h-8 w-[110px] rounded-lg border-color:var(--app-field-border) bg-var(--app-field-bg) text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {accessControlConfig.roles.map((role) => (
                                        <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg w-fit cursor-not-allowed">
                                    <Lock className="h-3 w-3" /> {accessControlConfig.roles.find((role) => role.key === u.role)?.name || u.role}
                                  </div>
                                )}
                              </TableCell>

                              <TableCell className="text-center">
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400">
                                  {Number.isNaN(u.transactionCount) ? "..." : (u.transactionCount ?? "...")}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                {isTargetAdminOrMod ? (
                                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium pl-2 bg-emerald-50 dark:bg-emerald-900/20 py-1 px-2 rounded-lg w-fit" title={tAdmin("users.payment.exempt")}>
                                    <ShieldCheck className="h-3 w-3" />
                                    {tAdmin("users.payment.exempt")}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <Select
                                      value={u.paymentStatus || 'free'}
                                      onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}
                                      disabled={!canChangePayment}
                                    >
                                      <SelectTrigger className={`h-8 w-[110px] rounded-lg border-color:var(--app-field-border) bg-var(--app-field-bg) text-xs ${u.paymentStatus === 'overdue' || u.paymentStatus === 'not_paid' ? 'text-red-600 font-bold' :
                                        u.paymentStatus === 'paid' ? 'text-emerald-600 font-medium' : ''
                                        }`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="free">{tAdmin("users.payment.free")}</SelectItem>
                                        <SelectItem value="paid">{tAdmin("users.payment.paid")}</SelectItem>
                                        <SelectItem value="pending">{tAdmin("users.payment.pending")}</SelectItem>
                                        <SelectItem value="not_paid">{tAdmin("users.payment.notPaid")}</SelectItem>
                                        <SelectItem value="overdue">{tAdmin("users.payment.overdue")}</SelectItem>
                                        <SelectItem value="canceled">{tAdmin("users.payment.canceled")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-zinc-500 leading-none">
                                      {u.billing?.source === "mercadopago_webhook"
                                        ? tAdmin("users.billingSource.mercadoPagoWebhook")
                                        : u.billing?.source === "mercadopago_confirm"
                                          ? tAdmin("users.billingSource.mercadoPagoConfirm")
                                          : u.billing?.source === "mercadopago_cancel"
                                            ? tAdmin("users.billingSource.mercadoPagoCancel")
                                            : u.billing?.source === "system"
                                              ? tAdmin("users.billingSource.system")
                                              : tAdmin("users.billingSource.manual")}
                                    </p>
                                    {u.billing?.lastSyncAt && (
                                      <p className="text-[10px] text-zinc-400 leading-none">
                                        Sync: {new Date(u.billing.lastSyncAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={u.status === "active" ? "default" : "destructive"}
                                  className={u.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                                >
                                  {getUserStatusLabel(u.status)}
                                </Badge>
                              </TableCell>

                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end items-center gap-2">
                                  {/* Botão de Bloqueio/Desbloqueio */}
                                  {u.status === "active" ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canToggleStatusForUser}
                                      className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 hover:cursor-pointer dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title={tAdmin("users.tooltips.block")}
                                      onClick={() => handleStatusChange(u.uid, "blocked")}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canToggleStatusForUser}
                                      className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 hover:cursor-pointer dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                      title={tAdmin("users.tooltips.reactivate")}
                                      onClick={() => handleStatusChange(u.uid, "active")}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <MoreVertical className="h-4 w-4 text-zinc-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl p-1 shadow-xl border-zinc-200 dark:border-zinc-800">
                                      <DropdownMenuLabel className="text-xs">{tAdmin("common.actions")}</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {canImpersonateUsers && u.uid !== userProfile?.uid && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => handleRequestImpersonation(u)}
                                            disabled={!canEditThisUser}
                                            className="cursor-pointer rounded-lg text-xs font-medium"
                                          >
                                            <User className="mr-2 h-4 w-4" /> {tAdmin("users.menu.impersonate")}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {canDeleteRecords && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => setUserToReset(u)}
                                            disabled={!canResetThisUser}
                                            className="cursor-pointer rounded-lg text-xs font-medium disabled:opacity-50">
                                            <RefreshCcw className="mr-2 h-4 w-4" /> {tAdmin("users.menu.resetData")}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => setUserToDelete(u)}
                                            disabled={!canDeleteThisUser}
                                            className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg text-xs font-medium dark:focus:bg-red-900/20 disabled:opacity-50"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("users.menu.deleteAccount")}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {!canImpersonateUsers && <p className="p-2 text-xs text-zinc-400 italic">{tAdmin("users.adminOnly")}</p>}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="app-panel-subtle flex flex-col gap-3 border-t border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-500 font-medium">{tAdmin("common.pageSummary", { page: currentPage, totalPages: totalPages || 1 })}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- RESTORE TAB --- */}
          {activeTab === "restore" && canRestore && (
            <div className={`${fadeInUp} delay-200`}>
              <Card className="app-panel-soft overflow-hidden rounded-3xl border border-orange-200/70 shadow-lg shadow-orange-500/10 dark:border-orange-900/30">
                <CardHeader className="border-b border-orange-100 bg-orange-50/50 px-4 py-4 dark:border-orange-900/30 dark:bg-orange-900/10 sm:px-6">
                  <CardTitle className="text-lg font-semibold text-orange-600 flex items-center gap-2">
                    <ArchiveRestore className="h-5 w-5" /> {tAdmin("restore.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="md:hidden p-3 space-y-3">
                    {deletedUsers.length === 0 ? (
                      <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border border-color:var(--app-panel-border) text-sm text-muted-foreground">
                        {tAdmin("restore.empty")}
                      </div>
                    ) : (
                      deletedUsers.map((u) => (
                        <div key={u.uid} className="rounded-2xl border border-orange-200 bg-orange-50/30 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-900 truncate">{u.displayName}</p>
                              <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                              <p className="text-[11px] text-orange-700/80">
                                {tAdmin("restore.deadlineLabel", { date: getRestoreDeadlineLabel(u) })}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-100 rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl border-orange-100 dark:border-orange-900/30">
                                <DropdownMenuLabel className="text-orange-700 dark:text-orange-400">{tAdmin("restore.actionsLabel")}</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                <DropdownMenuItem onClick={() => setRestoreDetailsUser(u)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                  <Eye className="mr-2 h-4 w-4" /> {tAdmin("restore.viewDetails")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                <DropdownMenuItem disabled={isRestoreExpired(u)} onClick={() => handleRestoreUser(u, false)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                  <UserIcon className="mr-2 h-4 w-4" /> {tAdmin("restore.restoreAccountOnlyAction")}
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={isRestoreExpired(u)} onClick={() => handleRestoreUser(u, true)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                  <ArchiveRestore className="mr-2 h-4 w-4" /> {tAdmin("restore.restoreAccountAndData")}
                                </DropdownMenuItem>
                                {canDeleteRecords && (
                                  <DropdownMenuItem
                                    onClick={() => setUserToPermanentDelete(u)}
                                    className="cursor-pointer rounded-lg text-xs font-medium text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("restore.permanentDelete")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">
                              {tAdmin("restore.transactionsLabel", { count: u.transactionCount ?? "..." })}
                            </Badge>
                            <Badge variant="outline" className="border-zinc-200 text-zinc-600 bg-white">
                              {isRestoreExpired(u) ? tAdmin("restore.expired") : tAdmin("restore.availableUntilShort", { date: getRestoreDeadlineLabel(u) })}
                            </Badge>
                            <span className="uppercase text-xs font-bold text-zinc-500">{u.plan}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow className="border-orange-100 dark:border-orange-900/30 hover:bg-transparent">
                          <TableHead className="pl-6 font-semibold">{tAdmin("common.user")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("common.email")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("restore.deadline")}</TableHead>
                          <TableHead className="font-semibold">{tAdmin("restore.previousPlan")}</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">{tAdmin("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                              {tAdmin("restore.empty")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          deletedUsers.map((u) => (
                            <TableRow key={u.uid} className="bg-orange-50/10 border-orange-100/50 dark:border-orange-900/20 hover:bg-orange-50/30 dark:hover:bg-orange-900/20 transition-colors">
                              <TableCell className="pl-6 font-medium text-zinc-800 dark:text-zinc-200">
                                <span className="block max-w-[220px] truncate" title={u.displayName}>{u.displayName}</span>
                              </TableCell>
                              <TableCell className="text-zinc-500">
                                <div className="space-y-1">
                                  <p className="max-w-[260px] truncate" title={u.email}>{u.email}</p>
                                  <p className="text-[11px] text-zinc-500/80">
                                    {tAdmin("restore.archivedRecordsLabel", { count: Number.isNaN(u.transactionCount) ? "..." : (u.transactionCount ?? "...") })}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
                                  {isRestoreExpired(u) ? tAdmin("restore.expired") : tAdmin("restore.availableUntil", { date: getRestoreDeadlineLabel(u) })}
                                </Badge>
                              </TableCell>
                              <TableCell className="uppercase text-xs font-bold text-zinc-400">{u.plan}</TableCell>
                              <TableCell className="text-right pr-6">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl border-orange-100 dark:border-orange-900/30">
                                    <DropdownMenuLabel className="text-orange-700 dark:text-orange-400">{tAdmin("restore.actionsLabel")}</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                    <DropdownMenuItem onClick={() => setRestoreDetailsUser(u)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                      <Eye className="mr-2 h-4 w-4" /> {tAdmin("restore.viewDetails")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                    <DropdownMenuItem disabled={isRestoreExpired(u)} onClick={() => handleRestoreUser(u, false)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                      <UserIcon className="mr-2 h-4 w-4" /> {tAdmin("restore.restoreAccountOnlyAction")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={isRestoreExpired(u)} onClick={() => handleRestoreUser(u, true)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                      <ArchiveRestore className="mr-2 h-4 w-4" /> {tAdmin("restore.restoreAccountAndData")}
                                    </DropdownMenuItem>
                                    {canDeleteRecords && (
                                      <DropdownMenuItem
                                        onClick={() => setUserToPermanentDelete(u)}
                                        className="cursor-pointer rounded-lg text-xs font-medium text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("restore.permanentDelete")}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* --- PLANS TAB --- */}
          {activeTab === "plans" && canManageSensitive && editedPlans && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <div className="mb-4 flex justify-end">
                <Button
                  onClick={savePlans}
                  disabled={isSavingPlans}
                  className="w-full gap-2 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 sm:w-auto sm:hover:scale-105"
                >
                  {isSavingPlans ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {tAdmin("plans.saveChanges")}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                {/* FREE */}
                <Card className={`app-panel-soft rounded-3xl border-2 shadow-xl transition-shadow ${freePlanTone.border}`}>
                  <CardHeader className={`flex flex-col gap-3 rounded-t-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${freePlanTone.header}`}>
                    <div className="flex flex-col justify-center">
                      <CardTitle className={`${freePlanTone.headerTitle} font-bold text-lg`}>
                        {tAdmin("plans.planTier", { name: plans.free.name, tier: tAdmin("plans.tiers.bronze") })}
                      </CardTitle>
                      <CardDescription className={freePlanTone.headerDescription}>{tAdmin("plans.settings")}</CardDescription>
                    </div>
                    <Switch checked={editedPlans.free.active} onCheckedChange={(c) => handlePlanEdit("free", "active", c)} className={freePlanTone.switchChecked} />
                  </CardHeader>

                  <CardContent className={`space-y-4 p-4 sm:p-6 ${!editedPlans.free.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.name")}</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.free.name ?? ""} onChange={(e) => handlePlanEdit("free", "name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.description")}</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.free.description ?? ""} onChange={(e) => handlePlanEdit("free", "description", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.launchLimit")}</Label>
                      <Input className="rounded-xl h-10" type="number" value={editedPlans.free.limit ?? 0} onChange={(e) => handlePlanEdit("free", "limit", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.benefitsLineByLine")}</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.free.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("free", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* PREMIUM */}
                <Card className={`app-panel-soft rounded-3xl border-2 shadow-xl transition-shadow ${premiumPlanTone.border}`}>
                  <CardHeader className={`flex flex-col gap-3 rounded-t-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${premiumPlanTone.header}`}>
                    <div className="flex flex-col justify-center">
                      <CardTitle className={`${premiumPlanTone.headerTitle} font-bold text-lg`}>
                        {tAdmin("plans.planTier", { name: plans.premium.name, tier: tAdmin("plans.tiers.silver") })}
                      </CardTitle>
                      <CardDescription className={premiumPlanTone.headerDescription}>{tAdmin("plans.settings")}</CardDescription>
                    </div>
                    <Switch checked={editedPlans.premium.active} onCheckedChange={(c) => handlePlanEdit("premium", "active", c)} className={premiumPlanTone.switchChecked} />
                  </CardHeader>

                  <CardContent className={`space-y-4 p-4 sm:p-6 ${!editedPlans.premium.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.name")}</Label>
                        <Input className="rounded-xl h-10" value={editedPlans.premium.name ?? ""} onChange={(e) => handlePlanEdit("premium", "name", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.price")}</Label>
                        <Input className="rounded-xl h-10" type="number" value={editedPlans.premium.price ?? 0} onChange={(e) => handlePlanEdit("premium", "price", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.paymentLink")}</Label>
                      <Input className="rounded-xl h-10 font-mono text-xs text-emerald-600" value={editedPlans.premium.paymentLink ?? ""} onChange={(e) => handlePlanEdit("premium", "paymentLink", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.description")}</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.premium.description ?? ""} onChange={(e) => handlePlanEdit("premium", "description", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.benefits")}</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.premium.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("premium", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* PRO */}
                <Card className={`app-panel-soft rounded-3xl border-2 shadow-xl transition-shadow ${proPlanTone.border}`}>
                  <CardHeader className={`flex flex-col gap-3 rounded-t-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${proPlanTone.header}`}>
                    <div className="flex flex-col justify-center">
                      <CardTitle className={`${proPlanTone.headerTitle} font-bold text-lg`}>
                        {tAdmin("plans.planTier", { name: editedPlans.pro.name, tier: tAdmin("plans.tiers.gold") })}
                      </CardTitle>
                      <CardDescription className={proPlanTone.headerDescription}>{tAdmin("plans.settings")}</CardDescription>
                    </div>
                    <Switch checked={editedPlans.pro.active} onCheckedChange={(c) => handlePlanEdit("pro", "active", c)} className={proPlanTone.switchChecked} />
                  </CardHeader>

                  <CardContent className={`space-y-4 p-4 sm:p-6 ${!editedPlans.pro.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.name")}</Label>
                        <Input className="rounded-xl h-10" value={editedPlans.pro.name ?? ""} onChange={(e) => handlePlanEdit("pro", "name", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.price")}</Label>
                        <Input className="rounded-xl h-10" type="number" value={editedPlans.pro.price ?? 0} onChange={(e) => handlePlanEdit("pro", "price", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.paymentLink")}</Label>
                      <Input className="rounded-xl h-10 font-mono text-xs text-yellow-600" value={editedPlans.pro.paymentLink ?? ""} onChange={(e) => handlePlanEdit("pro", "paymentLink", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.description")}</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.pro.description ?? ""} onChange={(e) => handlePlanEdit("pro", "description", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">{tAdmin("plans.fields.benefits")}</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.pro.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("pro", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {plans && plans.pro.active && (
                  <div className="col-span-1 text-center text-xs italic text-zinc-500 xl:col-span-3">
                    {tAdmin("plans.proWarning")}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Access Control - Permissions */}
          {activeTab === "permissions" && canViewPermissions && editedAccessControl && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{tAdmin("access.title")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {tAdmin("access.description")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={handleAddAccessRole} disabled={!canManagePermissions}>
                    {tAdmin("access.addRole")}
                  </Button>
                  <Button
                    type="button"
                    onClick={saveAccessControl}
                    disabled={!canManagePermissions || isSavingAccessControl}
                    className="w-full rounded-xl sm:w-auto"
                  >
                    {isSavingAccessControl ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {tAdmin("access.savePermissions")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                  <CardHeader className="app-panel-subtle border-t border-b border-color:var(--app-panel-border) flex flex-col gap-3 p-4 sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Lock className="h-5 w-5 text-primary" /> {tAdmin("access.rolesTitle")}
                    </CardTitle>
                    <CardDescription>
                      {tAdmin("access.rolesDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {editedAccessControl.roles.map((role, index) => (
                      <Collapsible key={role.id} className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border)">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <CollapsibleTrigger asChild>
                            <button type="button" className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{role.name}</p>
                                <p className="truncate font-mono text-[11px] text-muted-foreground">{role.key}</p>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                            <Badge variant="secondary" className="rounded-full">{role.system ? tAdmin("access.systemRole") : tAdmin("access.customRole")}</Badge>
                            <Switch
                              checked={role.active}
                              onCheckedChange={(checked) => handleAccessRoleEdit(index, "active", checked)}
                              disabled={!canManagePermissions}
                            />
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="space-y-3 border-t border-color:var(--app-panel-border) p-4 pt-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">{tAdmin("access.fields.internalKey")}</Label>
                              <Input
                                value={role.key}
                                disabled={role.system || !canManagePermissions}
                                onChange={(event) => handleAccessRoleEdit(index, "key", event.target.value)}
                                className="h-10 rounded-xl font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">{tAdmin("access.fields.roleName")}</Label>
                              <Input
                                value={role.name}
                                disabled={!canManagePermissions}
                                onChange={(event) => handleAccessRoleEdit(index, "name", event.target.value)}
                                className="h-10 rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">{tAdmin("access.fields.description")}</Label>
                              <Input
                                value={role.description || ""}
                                disabled={!canManagePermissions}
                                onChange={(event) => handleAccessRoleEdit(index, "description", event.target.value)}
                                className="h-10 rounded-xl"
                              />
                            </div>
                            {!role.system && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canDeletePermissions}
                                className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                                onClick={() => handleRemoveAccessRole(role.key)}
                              >
                                {tAdmin("access.removeRole")}
                              </Button>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                    <CardHeader className="app-panel-subtle border-t border-b border-color:var(--app-panel-border) flex flex-col gap-3 p-4 sm:justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <ShieldCheck className="h-5 w-5 text-primary" /> {tAdmin("access.targetTitle")}
                      </CardTitle>
                      <CardDescription>
                        {tAdmin("access.targetDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-4 xl:grid-cols-[1fr_1.2fr]">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(ACCESS_SUBJECT_LABELS).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleAccessSubjectTypeChange(value as AccessSubjectType)}
                            className={cn(
                              "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                              accessSubjectType === value
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-color:var(--app-panel-border) bg-card/50 text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {tAdmin(label)}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">{tAdmin("access.configuredTarget")}</Label>
                        {accessSubjectType === "plan" ? (
                          <Select value={accessSubjectId} onValueChange={setAccessSubjectId}>
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : accessSubjectType === "role" ? (
                          <Select value={accessSubjectId} onValueChange={setAccessSubjectId}>
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {editedAccessControl.roles.map((role) => (
                                <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : accessSubjectType === "user" ? (
                          <Select value={accessSubjectId || undefined} onValueChange={setAccessSubjectId}>
                            <SelectTrigger className="h-11 rounded-xl">
                              <SelectValue placeholder={isLoadingUsers ? tAdmin("common.loadingUsers") : tAdmin("common.selectUser")} />
                            </SelectTrigger>
                            <SelectContent className="max-h-80">
                              {users.map((user) => (
                                <SelectItem key={user.uid} value={user.uid}>
                                  {user.displayName || user.email || user.uid}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={tAdmin("access.allUsers")} disabled className="h-11 rounded-xl" />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {ACCESS_SCREENS.map((screen) => {
                      const permissionView = getVisiblePermissionResources(screen);
                      return (
                      <Collapsible key={screen.id} className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="group flex w-full flex-col gap-3 app-panel-subtle px-5 py-4 text-left transition-colors hover:bg-accent/70 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 gap-3">
                              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CardTitle className="text-lg font-semibold text-foreground">{screen.label}</CardTitle>
                                  <Badge variant="secondary" className="rounded-full">{tAdmin("access.featuresCount", { count: permissionView.total })}</Badge>
                                </div>
                                <CardDescription className="mt-1">{screen.description}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="secondary" className="w-fit rounded-full font-mono text-[11px]">{screen.route}</Badge>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {permissionView.groupNames.length > 1 && (
                            <div className="border-t border-color:var(--app-panel-border) app-panel-subtle px-4 py-3">
                            <div className="w-full max-w-sm space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">{tAdmin("access.featureGroup")}</Label>
                                <Select
                                  value={permissionView.selectedGroup}
                                  onValueChange={(value) => setPermissionGroupByScreen((prev) => ({ ...prev, [screen.id]: value }))}
                                >
                                  <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {permissionView.groupNames.map((groupName) => (
                                      <SelectItem key={groupName} value={groupName}>
                                        {groupName} ({permissionView.groups[groupName].length})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          <CardContent className="divide-y divide-border p-0">
                            {permissionView.resources.map((resource) => {
                              const value = getAccessEditorLevel(resource.key);
                              const explicitRule = getAccessRuleForSelection(resource.key);
                              const inheritedLabel = ACCESS_RESOURCE_LABEL_BY_KEY[resource.key] || resource.label;
                              const isBillingExemption = resource.key === "billing.exempt";
                              const billingExemptionValue = value === "inherit" ? "inherit" : "exempt";
                              return (
                                <div key={resource.key} className="grid gap-3 p-4 xl:grid-cols-[1fr_190px] xl:items-center">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-foreground">{resource.label}</p>
                                      {isBillingExemption ? (
                                        billingExemptionValue === "inherit" ? (
                                          <Badge variant="secondary" className="rounded-full">{tAdmin("access.defaultBadge")}</Badge>
                                        ) : (
                                          <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">{tAdmin("access.noCharge")}</Badge>
                                        )
                                      ) : value === "inherit" ? (
                                        <Badge variant="secondary" className="rounded-full">{tAdmin("access.inheriting")}</Badge>
                                      ) : (
                                        <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{tAdmin(ACCESS_LEVEL_LABELS[value])}</Badge>
                                      )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
                                    {explicitRule?.label && (
                                      <p className="mt-1 text-xs text-muted-foreground">{tAdmin("access.ruleLabel", { label: explicitRule.label })}</p>
                                    )}
                                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{inheritedLabel}</p>
                                  </div>
                                  {isBillingExemption ? (
                                    <Select
                                      value={billingExemptionValue}
                                      disabled={!canManagePermissions}
                                      onValueChange={(nextValue) => handleBillingExemptionChange(nextValue as "inherit" | "exempt")}
                                    >
                                      <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="inherit">{tAdmin("access.defaultBadge")}</SelectItem>
                                        <SelectItem value="exempt">{tAdmin("access.noCharge")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Select
                                      value={value}
                                      disabled={!canManagePermissions}
                                      onValueChange={(nextValue) => handleAccessLevelChange(resource.key, nextValue as AccessEditorLevel)}
                                    >
                                      <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="inherit">{tAdmin("access.inherit")}</SelectItem>
                                        {Object.entries(ACCESS_LEVEL_LABELS).map(([level, label]) => (
                                          <SelectItem key={level} value={level}>{tAdmin(label)}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          </section>
        </div>
      </div>

      {/* Modal Genérico de Feedback */}
      <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => !open && setFeedbackModal({ ...feedbackModal, isOpen: false })}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} sm:max-w-[400px]`}>
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
            <Button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} className="w-full rounded-xl hover:cursor-pointer">{tAdmin("common.understood")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Normalização */}
      <Dialog open={showNormalizeConfirm} onOpenChange={setShowNormalizeConfirm}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Wrench className="h-5 w-5" /> {tAdmin("users.normalization.confirmTitle")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {tAdmin("users.normalization.confirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNormalizeConfirm(false)} className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button onClick={confirmNormalizeDB} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl hover:cursor-pointer">{tAdmin("users.normalization.start")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Restauração */}
      <Dialog open={!!userToRestore} onOpenChange={(open) => !open && setUserToRestore(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ArchiveRestore className="h-5 w-5" /> {tAdmin("restore.confirmTitle")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {tAdmin("restore.confirmDescription", { name: userToRestore?.user.displayName || "" })}
              <br /><br />
              <strong>{tAdmin("restore.selectedAction")}</strong> {userToRestore?.withData ? tAdmin("restore.restoreAccountWithData") : tAdmin("restore.restoreAccountOnly")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserToRestore(null)} className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button onClick={confirmRestoreUser} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl hover:cursor-pointer">{tAdmin("restore.confirmAction")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreDetailsUser} onOpenChange={(open) => !open && setRestoreDetailsUser(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} sm:max-w-[620px]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ArchiveRestore className="h-5 w-5" /> {tAdmin("restore.archivedDetailsTitle")}
            </DialogTitle>
            <DialogDescription>
              {tAdmin("restore.archivedDetailsDescription")}
            </DialogDescription>
          </DialogHeader>
          {restoreDetailsUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{tAdmin("common.user")}</p>
                  <p className="mt-2 wrap-break-words font-semibold text-foreground">{restoreDetailsUser.displayName}</p>
                </div>
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{tAdmin("common.email")}</p>
                  <p className="mt-2 wrap-break-words text-muted-foreground">{restoreDetailsUser.email}</p>
                </div>
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{tAdmin("restore.deadline")}</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {isRestoreExpired(restoreDetailsUser) ? tAdmin("restore.expired") : getRestoreDeadlineLabel(restoreDetailsUser)}
                  </p>
                </div>
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{tAdmin("restore.previousPlan")}</p>
                  <p className="mt-2 font-semibold uppercase text-foreground">{restoreDetailsUser.plan}</p>
                </div>
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{tAdmin("restore.archivedRecords")}</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {Number.isNaN(restoreDetailsUser.transactionCount) ? "..." : (restoreDetailsUser.transactionCount ?? "...")}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setRestoreDetailsUser(null)} className="rounded-xl hover:cursor-pointer">{tAdmin("common.close")}</Button>
            {restoreDetailsUser && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  disabled={isRestoreExpired(restoreDetailsUser)}
                  onClick={() => {
                    handleRestoreUser(restoreDetailsUser, false);
                    setRestoreDetailsUser(null);
                  }}
                  className="rounded-xl"
                >
                  {tAdmin("restore.restoreAccount")}
                </Button>
                <Button
                  disabled={isRestoreExpired(restoreDetailsUser)}
                  onClick={() => {
                    handleRestoreUser(restoreDetailsUser, true);
                    setRestoreDetailsUser(null);
                  }}
                  className="rounded-xl bg-orange-600 text-white hover:bg-orange-700"
                >
                  {tAdmin("restore.restoreAccountAndData")}
                </Button>
                {canDeleteRecords && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setUserToPermanentDelete(restoreDetailsUser);
                      setRestoreDetailsUser(null);
                    }}
                    className="rounded-xl"
                  >
                    {tAdmin("restore.permanentDelete")}
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resetar Dados */}
      <Dialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle>{tAdmin("dialogs.resetTitle")}</DialogTitle>
            <DialogDescription>{tAdmin("dialogs.resetDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToReset(null)} variant="ghost" className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button onClick={confirmResetData} variant="destructive" className="rounded-xl hover:cursor-pointer">{tAdmin("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle>{tAdmin("dialogs.deleteAccountTitle")}</DialogTitle>
            <DialogDescription>{tAdmin("dialogs.deleteAccountDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToDelete(null)} variant="ghost" className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button onClick={confirmDeleteUser} variant="destructive" className="rounded-xl hover:cursor-pointer">{tAdmin("dialogs.archiveAccount")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sucesso Exclusão */}
      <Dialog open={!!deletedUserData} onOpenChange={(open) => !open && setDeletedUserData(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full w-fit mb-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-center text-xl">{tAdmin("dialogs.userDeletedTitle")}</DialogTitle>
            <DialogDescription className="text-center">
              {tAdmin("dialogs.userDeletedDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="app-panel-subtle space-y-2 rounded-2xl border border-color:var(--app-panel-border) p-4">
            <p className="text-sm"><strong>{tAdmin("dialogs.name")}:</strong> {deletedUserData?.name}</p>
            <p className="text-sm"><strong>{tAdmin("common.email")}:</strong> {deletedUserData?.email}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeletedUserData(null)} className="w-full rounded-xl hover:cursor-pointer">{tAdmin("common.understood")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToPermanentDelete} onOpenChange={(open) => !open && setUserToPermanentDelete(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle className="text-red-600">{tAdmin("dialogs.permanentDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {tAdmin("dialogs.permanentDeleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToPermanentDelete(null)} variant="ghost" className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button onClick={confirmPermanentDeleteUser} variant="destructive" className="rounded-xl hover:cursor-pointer">{tAdmin("restore.permanentDelete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reativar */}
      <Dialog open={!!userToReactivate} onOpenChange={(open) => !open && cancelReactivateUser()}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5 mb-2" /> {tAdmin("dialogs.reactivateTitle")}
            </DialogTitle>
            <DialogDescription>
              {tAdmin("dialogs.reactivateDescription", { name: userToReactivate?.displayName || "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelReactivateUser} className="rounded-xl hover:cursor-pointer">{tAdmin("dialogs.keepBlocked")}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl hover:cursor-pointer" onClick={confirmReactivateUser}>{tAdmin("dialogs.reactivateConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Bloquear */}
      <Dialog open={!!userToBlock} onOpenChange={(open) => !open && cancelBlockUser()}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} max-w-[520px]`}>
          <DialogHeader>
            <DialogTitle>{tAdmin("block.title")}</DialogTitle>
            <DialogDescription>{tAdmin("block.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tAdmin("block.reasonLabel")}</Label>
              <Select onValueChange={setSelectedReason} value={selectedReason}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={tAdmin("block.reasonPlaceholder")} /></SelectTrigger>
                <SelectContent>{blockReasonOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {selectedReason === "Outros" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>{tAdmin("block.customReasonLabel")}</Label>
                <textarea className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelBlockUser} className="rounded-xl hover:cursor-pointer">{tAdmin("common.cancel")}</Button>
            <Button variant="destructive" onClick={confirmBlockUser} className="rounded-xl hover:cursor-pointer">{tAdmin("block.action")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes do Chamado */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} sm:max-w-[720px]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTicket?.type === 'feature' ? (
                <Lightbulb className="h-5 w-5 text-amber-600" />
              ) : (
                <HeadphonesIcon className="h-5 w-5 text-primary" />
              )}
              {tAdmin("support.detailsTitle")}
            </DialogTitle>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-semibold block">{tAdmin("common.requester")}:</span>
                  <span className="wrap-break-words text-muted-foreground">{viewTicket.name}</span>
                </div>
                <div>
                  <span className="font-semibold block">{tAdmin("common.email")}:</span>
                  <span className="wrap-break-words text-muted-foreground">{viewTicket.email}</span>
                </div>
                <div>
                  <span className="font-semibold block">{tAdmin("common.date")}:</span>
                  <span className="text-muted-foreground">
                    {formatDateSafe(viewTicket.createdAt) ?? tAdmin("common.invalidDate")}
                  </span>
                </div>
                <div>
                  <Label className="font-semibold">{tAdmin("common.currentStatus")}:</Label>
                  <Select
                    value={viewTicket.status}
                    onValueChange={(value) => void handleChangeTicketStatus(viewTicket.id, value as TicketStatus)}
                    disabled={!canEditTicketStatus(viewTicket)}
                  >
                    <SelectTrigger className="mt-1 h-10 rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(viewTicket.type === "feature" ? FEATURE_STATUS_OPTIONS : SUPPORT_STATUS_OPTIONS).map((option) => (
                        <SelectItem key={option.value} value={option.value}>{tAdmin(option.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="font-semibold block">{tAdmin("common.protocol")}:</span>
                  <span className="wrap-break-words text-muted-foreground">{viewTicket.protocol || `#${viewTicket.id.slice(0, 8)}`}</span>
                </div>
                <div>
                  <Label className="font-semibold">{tAdmin("common.priority")}:</Label>
                  <Select
                    value={viewTicket.priority || "low"}
                    onValueChange={(value) => void handleChangeTicketPriority(viewTicket.id, value as TicketPriority)}
                    disabled={!canEditTicketPriority}
                  >
                    <SelectTrigger className="mt-1 h-10 rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{tAdmin(option.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-semibold">{tAdmin("common.responsible")}:</Label>
                  {userProfile?.role === "admin" ? (
                    <Select
                      value={viewTicket.assignedTo || "unassigned"}
                      onValueChange={(value) => void handleAssignTicket(viewTicket.id, value)}
                    >
                      <SelectTrigger className="mt-1 h-10 rounded-xl border-color:var(--app-field-border) bg-var(--app-field-bg)">
                        <SelectValue placeholder={tAdmin("common.selectUser")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">-- {tAdmin("common.nobody")} --</SelectItem>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.uid} value={staff.uid}>
                            {staff.displayName || staff.email} ({staff.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      {viewTicket.assignedToName || (viewTicket.assignedTo ? tAdmin("common.staff") : tAdmin("common.nobody"))}
                    </p>
                  )}
                </div>
                {viewTicket.supportKind === "account_restore" && (
                  <div>
                    <span className="font-semibold block">{tAdmin("common.request")}:</span>
                    <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      {viewTicket.wantsData === false ? tAdmin("support.accountRestoreWithoutData") : tAdmin("support.accountRestoreWithData")}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                <span className="font-semibold block text-sm mb-2">{tAdmin("common.message")}:</span>
                <p className="whitespace-pre-wrap wrap-break-words text-sm leading-relaxed text-muted-foreground">
                  {viewTicket.message}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            {viewTicket && canDeleteRecords && (
              <Button
                variant="destructive"
                onClick={() => setTicketToDelete(viewTicket)}
                className="w-full rounded-xl hover:cursor-pointer sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tAdmin("common.delete")}
              </Button>
            )}
            <Button onClick={() => setViewTicket(null)} className="w-full rounded-xl hover:cursor-pointer sm:w-auto">{tAdmin("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Ticket */}
      <Dialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        <DialogContent className={`${ADMIN_DIALOG_CONTENT_CLASS} sm:max-w-[400px]`}>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> {tAdmin("support.deleteTitle")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {tAdmin("support.deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTicketToDelete(null)}>{tAdmin("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteTicket}>{tAdmin("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



