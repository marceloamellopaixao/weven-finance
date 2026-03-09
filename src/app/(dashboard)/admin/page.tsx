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
  getStaffUsers,
  downloadAdminCsv,
} from "@/services/userService";
import { updatePlansConfig } from "@/services/systemService";
import {
  UserProfile,
  UserStatus,
  UserPlan,
  UserRole,
  UserPaymentStatus,
} from "@/types/user";
import { PlansConfig, PlanDetails } from "@/types/system";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { deleteTicket, fetchSupportTicketsPage, markSupportTicketsAsSeen, SupportRequestStatus, SupportTicket, updateTicket } from "@/hooks/supportService";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@radix-ui/react-dropdown-menu";
import {
  activateImpersonation,
  getMyImpersonationStatus,
  requestImpersonationAccess,
} from "@/services/impersonationService";

type UserWithCount = UserProfile & { transactionCount?: number };
type DeletionSuccessData = { name: string; email: string } | null;
type PaymentFilterType = UserPaymentStatus | "unpaid_group" | "all";

type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

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
  return "Data invalida";
}

// Dono Supremo (Hardcoded para segurança extra na UI)
const CREATOR_SUPREME = "Z3ciyXudWuZZywhojA6iWJTurH52";
const ADMIN_USERS_FILTERS_STORAGE_KEY = "wevenfinance:admin:users-filters:v1";
const ADMIN_SUPPORT_FILTERS_STORAGE_KEY = "wevenfinance:admin:support-filters:v1";
const ADMIN_AUDIT_FILTERS_STORAGE_KEY = "wevenfinance:admin:audit-filters:v1";

export default function AdminPage() {
  const { user, userProfile, loading } = useAuth();
  const { plans } = usePlans();
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

  // --- MODAIS DE A?O ---
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
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

  const blockReasonOptions = [
    "Falta de Pagamento",
    "Violação dos Termos de Uso",
    "Solicitação do Usuário",
    "Outros",
  ];

  // Plans
  const [editedPlans, setEditedPlans] = useState<PlansConfig | null>(null);
  const [isSavingPlans, setIsSavingPlans] = useState(false);

  // --- PERMISS?ES ---
  const canManageSensitive = userProfile?.role === "admin";
  const canRestore = userProfile?.role === "admin" || userProfile?.role === "moderator";
  const canImpersonateUsers =
    userProfile?.role === "admin" || userProfile?.role === "moderator" || userProfile?.role === "support";

  const unseenSupportTickets = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role !== "admin" && userProfile.role !== "moderator" && userProfile.role !== "support") return [];
    return tickets.filter((ticket) => !Array.isArray(ticket.staffSeenBy) || !ticket.staffSeenBy.includes(userProfile.uid));
  }, [tickets, userProfile]);

  const unseenSupportCount = supportUnseenCount || unseenSupportTickets.length;

  const allowedTabs = useMemo(() => {
    if (!userProfile) return ["users", "support", "audit"];
    const tabs = ["support", "audit"];
    if (userProfile.role === "admin" || userProfile.role === "moderator") {
      tabs.unshift("users");
      tabs.push("restore");
      tabs.push("metrics");
    }
    if (userProfile.role === "admin") {
      tabs.push("plans");
    }
    return tabs;
  }, [userProfile]);

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
    if (userProfile.role === "admin") return true;

    // Moderador vê Cliente e Suporte
    if (userProfile.role === "moderator") {
      return targetRole === "client" || targetRole === "support";
    };

    // Suporte não tem acesso à tabela de usuários
    return false;
  }, [userProfile]);

  // Permissão de Edição de Cargo
  const canEditRole = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;
    if (targetUser.uid === userProfile.uid) return false; // Não edita a si mesmo
    if (targetUser.uid === CREATOR_SUPREME) return false; // Não edita o Criador Supremo

    if (userProfile.role === 'admin') {
      if (userProfile.uid === CREATOR_SUPREME) return true; // Criador edita tudo
      if (targetUser.role === 'admin') return false; // Admin comum não edita outro admin
      return true;
    }

    if (userProfile.role === 'moderator') {
      if (targetUser.role === 'admin' || targetUser.role === 'moderator') return false;
      return true; // Moderador edita apenas Clientes e Suporte
    };

    return false;
  }, [userProfile]);

  // Permissão de Edição de Plano/Status
  const canEditPlan = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;

    const hierarchy = { admin: 3, moderator: 2, support: 1, client: 0 };
    const myRank = hierarchy[userProfile.role];
    const targetRank = hierarchy[targetUser.role];

    // Só pode editar se tiver hierarquia maior e não for o Criador Supremo
    if (userProfile.uid === CREATOR_SUPREME) return true;

    return myRank > targetRank;
  }, [userProfile]);

  // PERMISSÕES no usuário (Bloquear, Resetar, Deletar)
  const canEditUser = useCallback((targetUser: UserProfile) => {
    if (!userProfile) return false;

    // Ninguém edita a si mesmo nestas ações
    if (targetUser.uid === userProfile.uid) return false;

    const hierarchy: Record<UserRole, number> = { admin: 3, moderator: 2, support: 1, client: 0 };
    const myRank = hierarchy[userProfile.role];
    const targetRank = hierarchy[targetUser.role];

    // Criador supremo edita todos
    if (userProfile.uid === CREATOR_SUPREME) return true;

    // Regra geral: Só edita quem está abaixo na hierarquia
    return myRank > targetRank;
  }, [userProfile]);

  // --- Guards ---
  useEffect(() => {
    if (!loading) {
      if (userProfile?.role !== "admin" && userProfile?.role !== "moderator" && userProfile?.role !== "support") {
        router.push("/");
      }
    }
  }, [userProfile, loading, router]);

  useEffect(() => {
    if (plans) setEditedPlans(plans);
  }, [plans]);

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
    if (activeTab !== "users" && activeTab !== "restore") return;

    let cancelled = false;
    const loadUsers = async () => {
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
    const interval = setInterval(() => void loadUsers(), 15000);
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
    const interval = setInterval(() => void loadTickets(), 10000);
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
      pending: "Pendente",
      in_progress: "Em Progresso",
      resolved: "Resolvido",
      rejected: "Rejeitado",
      under_review: "Em Análise",
      approved: "Aprovado",
      implemented: "Implementado",
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
    if (priority === "urgent") return "Urgente";
    if (priority === "high") return "Alta";
    if (priority === "medium") return "Média";
    return "Baixa";
  };

  const getTicketPriorityTone = (priority?: string) => {
    if (priority === "urgent") return "bg-red-600 text-white";
    if (priority === "high") return "bg-orange-500 text-white";
    if (priority === "medium") return "bg-amber-500 text-white";
    return "bg-zinc-500 text-white";
  };

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
        ? "Já existe uma solicitação pendente para este usuário."
        : "Solicitação enviada. Aguarde o usuário aprovar no modal.";
      showFeedback("info", "Impersonação", message);
    } catch {
      showFeedback("error", "Erro", "Não foi possível iniciar a solicitação de impersonação.");
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
          showFeedback("success", "Impersonação ativa", "Aprovação recebida. Entrando na tela do usuário.");
          router.push("/dashboard");
          return;
        }

        const requestStatus = status.request?.status;
        if (requestStatus === "rejected" || requestStatus === "revoked" || requestStatus === "expired") {
          setImpersonationPollingTargetUid(null);
          showFeedback("info", "Solicitação finalizada", "O usuário não aprovou o acesso.");
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setImpersonationPollingTargetUid(null);
          showFeedback("info", "Tempo esgotado", "O usuário ainda não aprovou a solicitação de acesso.");
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
  }, [impersonationPollingTargetUid, router]);

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
          throw new Error(payload.error || "Não foi possível carregar a auditoria.");
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
    const interval = setInterval(() => void loadAuditLogs(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, auditPage, auditPerPage, auditSearch, auditActionFilter, auditActorUidFilter, auditTargetUidFilter, auditFromDate, auditToDate, user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (activeTab !== "metrics") return;

    let cancelled = false;

    const loadMetrics = async () => {
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
          throw new Error(payload.error || "Não foi possível carregar as métricas.");
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
    const interval = setInterval(() => void loadMetrics(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, metricsWindowMinutes, onlyCriticalAlerts, user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;

    let cancelled = false;

    const loadCriticalAlerts = async () => {
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
    const timer = setInterval(() => void loadCriticalAlerts(), 30000);
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
    const timer = setInterval(() => void loadHealth(), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, userProfile]);

  const handleAssignTicket = async (ticketId: string, staffUid: string) => {
    const staff = staffMembers.find(s => s.uid === staffUid);
    try {
      await updateTicket(ticketId, {
        assignedTo: staffUid,
        assignedToName: staff?.displayName || "Staff"
      });
      showFeedback('success', 'Atribuído', 'Chamado atribuído com sucesso.');
    } catch {
      showFeedback('error', 'Erro', 'Falha ao atribuir chamado.');
    }
  };

  const handleChangeTicketStatus = async (ticketId: string, status: string) => {
    try {
      await updateTicket(ticketId, { status: status as SupportRequestStatus });
    } catch {
      showFeedback('error', 'Erro', 'Falha ao atualizar status.');
    }
  };

  const handleChangeTicketPriority = async (
    ticketId: string,
    priority: "low" | "medium" | "high" | "urgent"
  ) => {
    try {
      await updateTicket(ticketId, { priority } as Partial<SupportTicket>);
    } catch {
      showFeedback('error', 'Erro', 'Falha ao atualizar prioridade.');
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      await deleteTicket(ticketToDelete.id);
      showFeedback('success', 'Excluído', 'O chamado foi removido permanentemente.');
    } catch {
      showFeedback('error', 'Erro', 'Falha ao excluir chamado.');
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
      showFeedback('success', 'Normalização Concluída', `${count} usuários foram verificados e atualizados.`);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro', 'Falha ao normalizar dados do banco.');
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
    try {
      await restoreUserAccount(userToRestore.user.uid, userToRestore.withData);
      showFeedback('success', 'Conta Restaurada', `O usuário ${userToRestore.user.displayName} foi movido para a lista ativa.`);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro', 'Não foi possível restaurar o usuário.');
    } finally {
      setUserToRestore(null);
    }
  };

  const confirmBlockUser = async () => {
    if (!userToBlock) return;
    const finalReason = selectedReason === "Outros" ? customReason : selectedReason;
    if (!finalReason) {
      showFeedback('error', 'Campo Obrigatório', 'Por favor, informe um motivo para o bloqueio.');
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
      setCustomReason("Cancelamento de Assinatura");
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
    await resetUserFinancialData(userToReset.uid);
    setUserToReset(null);
    showFeedback('success', 'Dados Resetados', 'Todas as transações do usuário foram apagadas permanentemente.');

    try {
      const count = await getUserTransactionCount(userToReset.uid);
      setUsers((prev) =>
        prev.map((u) => (u.uid === userToReset.uid ? { ...u, transactionCount: count } : u))
      );
    } catch { }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const data = { name: userToDelete.displayName, email: userToDelete.email };
      await softDeleteUser(userToDelete.uid);
      setDeletedUserData(data);
      setUserToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      showFeedback('error', 'Erro', 'Falha ao excluir usuário.');
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

  const savePlans = async () => {
    if (!editedPlans) return;
    setIsSavingPlans(true);
    try {
      await updatePlansConfig(editedPlans);
      showFeedback('success', 'Planos Atualizados', 'As configurações foram salvas com sucesso.');
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao Salvar', 'Não foi possível atualizar os planos.');
    } finally {
      setIsSavingPlans(false);
    }
  };

  // --- FILTRAGEM ---
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => u.status !== "deleted" && canViewRole(u.role));

    const rolePriority: Record<UserRole, number> = {
      admin: 1, moderator: 2, support: 3, client: 4
    };
    return list.sort((a, b) => rolePriority[a.role] - rolePriority[b.role]);
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
      showFeedback("error", "Exportação falhou", "Não foi possível exportar os usuários agora.");
    } finally {
      setIsExportingCsv(null);
    }
  }, [searchTerm, roleFilter, planFilter, statusFilter, paymentStatusFilter]);

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
      showFeedback("error", "Exportação falhou", "Não foi possível exportar os chamados agora.");
    } finally {
      setIsExportingCsv(null);
    }
  }, [supportSearch, supportTypeFilter, supportStatusFilter, supportPriorityFilter]);

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
      showFeedback("error", "Exportação falhou", "Não foi possível exportar a auditoria agora.");
    } finally {
      setIsExportingCsv(null);
    }
  }, [auditSearch, auditActionFilter, auditActorUidFilter, auditTargetUidFilter, auditFromDate, auditToDate]);

  const deletedUsers = useMemo(() => {
    return users.filter(u => u.status === 'deleted');
  }, [users]);

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

  if (
    loading ||
    (userProfile?.role !== "admin" && userProfile?.role !== "moderator" && userProfile?.role !== "support") ||
    !editedPlans
  )
    return null;

  return (
    <div className="font-sans min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 pb-20 relative overflow-hidden">

      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        <div className={`${fadeInUp} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8`}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-red-600" />
              Administração
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">Controle total da plataforma.</p>
          </div>

          {canManageSensitive && activeTab === 'users' && (
            <Button
              onClick={() => setShowNormalizeConfirm(true)}
              disabled={isNormalizing}
              variant="outline"
              className="bg-white dark:bg-zinc-900 border-amber-200 text-amber-700 hover:bg-amber-50 gap-2 rounded-xl shadow-sm hover:scale-105 hover:cursor-pointer transition-all"
            >
              {isNormalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Corrigir/Normalizar Dados Antigos
            </Button>
          )}
        </div>

        {criticalMetricsAlerts.length > 0 && (
          <div className={`${fadeInUp} mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-900`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" />
              {criticalMetricsAlerts.length} alerta(s) crítico(s) ativo(s)
            </div>
            <p className="text-xs mt-1">
              {criticalMetricsAlerts[0]?.title}: {criticalMetricsAlerts[0]?.description}
            </p>
          </div>
        )}

        <div className={`${fadeInUp} delay-150 space-y-6`}>
          {/* Navegação de Abas Moderna */}
          <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit grid grid-cols-2 md:grid-flow-col gap-1 shadow-sm">
            {/* Aba Usuários: Apenas Admin e Moderator */}
            {(userProfile?.role === 'admin' || userProfile?.role === 'moderator') && (
              <button onClick={() => setActiveTabAndPersist("users")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "users" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                <UserIcon className="h-4 w-4" /> Gerenciar Usuários
              </button>
            )}

            {/* Aba Suporte: Todos da Equipe */}
            <button onClick={() => setActiveTabAndPersist("support")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "support" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <HeadphonesIcon className="h-4 w-4" /> Suporte & Ideias
              {unseenSupportCount > 0 && (
                <span className="ml-1 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unseenSupportCount > 99 ? "99+" : unseenSupportCount}
                </span>
              )}
            </button>

            <button onClick={() => setActiveTabAndPersist("audit")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "audit" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <ShieldCheck className="h-4 w-4" /> Auditoria
            </button>

            {canRestore && (
              <button onClick={() => setActiveTabAndPersist("restore")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "restore" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                <History className="h-4 w-4" /> Restaurar Dados
              </button>
            )}

            {(userProfile?.role === "admin" || userProfile?.role === "moderator") && (
              <button onClick={() => setActiveTabAndPersist("metrics")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "metrics" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                <Calculator className="h-4 w-4" /> Métricas
                {criticalMetricsAlerts.length > 0 && (
                  <span className="ml-1 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {criticalMetricsAlerts.length > 99 ? "99+" : criticalMetricsAlerts.length}
                  </span>
                )}
              </button>
            )}

            {canManageSensitive && (
              <button onClick={() => setActiveTabAndPersist("plans")} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:cursor-pointer ${activeTab === "plans" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                <CreditCard className="h-4 w-4" /> Gerenciar Planos
              </button>
            )}
          </div>

          {/* --- SUPORTE TAB --- */}
          {activeTab === "support" && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <HeadphonesIcon className="h-5 w-5 text-violet-600" /> Central de Atendimento
                  </CardTitle>
                  <CardDescription>
                    {userProfile?.role === 'admin'
                      ? "Gerencie a atribuição e status dos chamados de toda a plataforma."
                      : "Visualize e atenda os chamados atribuídos a você."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-4 md:p-5 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-500">Fila aberta</p>
                      <p className="text-lg font-bold">{supportQueueMetrics.open}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-600">SLA estourado</p>
                      <p className="text-lg font-bold text-red-600">{supportQueueMetrics.overdue}</p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                      <p className="text-xs text-orange-700">Alta/Urgente</p>
                      <p className="text-lg font-bold text-orange-700">{supportQueueMetrics.urgent}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs text-blue-700">TMA resolução</p>
                      <p className="text-lg font-bold text-blue-700">{supportQueueMetrics.avgResolutionMinutes} min</p>
                    </div>
                  </div>
                  <div className="p-4 md:p-5 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input
                        value={supportSearch}
                        onChange={(e) => setSupportSearch(e.target.value)}
                        className="h-10 rounded-xl"
                        placeholder="Buscar chamado por protocolo, nome ou email"
                      />
                      <Select value={supportTypeFilter} onValueChange={(value) => setSupportTypeFilter(value as "support" | "feature" | "all")}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os tipos</SelectItem>
                          <SelectItem value="support">Suporte</SelectItem>
                          <SelectItem value="feature">Ideias</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={supportStatusFilter} onValueChange={setSupportStatusFilter}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em Progresso</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                          <SelectItem value="under_review">Em Análise</SelectItem>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="implemented">Implementado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={supportPriorityFilter} onValueChange={(value) => setSupportPriorityFilter(value as "low" | "medium" | "high" | "urgent" | "all")}>
                        <SelectTrigger className="h-10 rounded-xl">
                          <SelectValue placeholder="Prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas prioridades</SelectItem>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="h-10 rounded-xl" onClick={clearSupportFilters}>
                        <FilterX className="mr-2 h-4 w-4" /> Limpar filtros
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={() => void handleExportSupportCsv()}
                        disabled={isExportingCsv === "support"}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isExportingCsv === "support" ? "Exportando..." : "Exportar CSV"}
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 md:p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {supportTicketsOrdered.length === 0 ? (
                      <div className="col-span-full h-32 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/30">
                        Nenhum chamado encontrado.
                      </div>
                    ) : (
                      supportTicketsOrdered.map((ticket) => {
                        const isFinished = ticket.status === 'resolved' || ticket.status === 'implemented' || ticket.status === 'rejected';
                        const canEditStatus = userProfile?.role === 'admin' || !isFinished;
                        const tone = getTicketStatusTone(ticket.status);
                        const dateStr = formatDateSafe(ticket.createdAt);
                        const isUnseen = !Array.isArray(ticket.staffSeenBy) || (userProfile ? !ticket.staffSeenBy.includes(userProfile.uid) : false);

                        return (
                          <div key={ticket.id} className={`rounded-2xl border ${tone.border} bg-white dark:bg-zinc-950/50 p-4 space-y-3`}>
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
                                  <Lightbulb className="h-3 w-3" /> Ideia
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                  <MessageSquare className="h-3 w-3" /> Suporte
                                </Badge>
                              )}
                              <Badge className={tone.badge}>{formatTicketStatus(ticket.status)}</Badge>
                              <Badge className={getTicketPriorityTone(ticket.priority)}>
                                Prioridade: {getTicketPriorityLabel(ticket.priority)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                Protocolo {ticket.protocol || `#${ticket.id.slice(0, 8)}`}
                              </Badge>
                              {ticket.slaBreached && (
                                <Badge className="bg-red-600 text-white">SLA estourado</Badge>
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
                              <div className="text-xs text-zinc-600">
                                {userProfile?.role === 'admin' ? (
                                  <Select
                                    value={ticket.assignedTo || "unassigned"}
                                    onValueChange={(val) => handleAssignTicket(ticket.id, val)}
                                  >
                                    <SelectTrigger className="w-[220px] h-8 text-xs">
                                      <SelectValue placeholder="Atribuir" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">-- Ninguém --</SelectItem>
                                      {staffMembers.map(staff => (
                                        <SelectItem key={staff.uid} value={staff.uid}>
                                          {staff.displayName || staff.email} ({staff.role})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span>{ticket.assignedToName || (ticket.assignedTo ? "Staff" : "Ninguém")}</span>
                                )}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                                    <MoreVertical className="h-4 w-4 text-zinc-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                  <DropdownMenuItem onClick={() => setViewTicket(ticket)}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                                  </DropdownMenuItem>

                                  {canEditStatus && (
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800">
                                        <span className="flex items-center">
                                          <RefreshCcw className="mr-2 h-4 w-4 text-zinc-500" />
                                          Alterar Status
                                        </span>
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-56 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                        {ticket.type === 'support' && (
                                          <>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}>Pendente</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'in_progress')}>Em Progresso</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'resolved')}>Resolvido</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}>Rejeitado</DropdownMenuItem>
                                          </>
                                        )}
                                        {ticket.type === 'feature' && (
                                          <>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}>Pendente</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'under_review')}>Em Análise</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'approved')}>Aprovado</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}>Rejeitado</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketStatus(ticket.id, 'implemented')}>Implementado</DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )}

                                  {(userProfile?.role === "admin" || userProfile?.role === "moderator") && (
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800">
                                        Prioridade
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-44 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                        <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "low")}>Baixa</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "medium")}>Média</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "high")}>Alta</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "urgent")}>Urgente</DropdownMenuItem>
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )}

                                  {userProfile?.role === 'admin' && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setTicketToDelete(ticket)}
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950 hover:cursor-pointer"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                          <TableHead className="pl-6 font-semibold">Data</TableHead>
                          <TableHead className="font-semibold">Solicitante</TableHead>
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="font-semibold">Mensagem (Resumo)</TableHead>
                          <TableHead className="font-semibold text-center">Status</TableHead>
                          <TableHead className="font-semibold">Responsável</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supportTicketsOrdered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                              Nenhum chamado encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          supportTicketsOrdered.map(ticket => {
                            const isFinished = ticket.status === 'resolved' || ticket.status === 'implemented' || ticket.status === 'rejected';
                            const canEditStatus = userProfile?.role === 'admin' || !isFinished;
                            const dateStr = formatDateSafe(ticket.createdAt);


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
                                      <Lightbulb className="h-3 w-3" /> Ideia
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1">
                                      <MessageSquare className="h-3 w-3" /> Suporte
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
                                      <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <SelectValue placeholder="Atribuir" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned">-- Ninguém --</SelectItem>
                                        {staffMembers.map(staff => (
                                          <SelectItem key={staff.uid} value={staff.uid}>
                                            {staff.displayName || staff.email} ({staff.role})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs font-medium text-zinc-600">
                                      {ticket.assignedToName || (ticket.assignedTo ? "Staff" : "Ninguém")}
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
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                      <DropdownMenuItem onClick={() => setViewTicket(ticket)}>
                                        <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                                      </DropdownMenuItem>

                                      {canEditStatus && (
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger
                                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800"
                                          >
                                            <span className="flex items-center">
                                              <RefreshCcw className="mr-2 h-4 w-4 text-zinc-500" />
                                              Alterar Status
                                            </span>
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="w-56 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                            {ticket.type === 'support' && (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  Pendente
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'in_progress')}
                                                  className="rounded-lg text-sm focus:bg-blue-50 focus:text-blue-900 dark:focus:bg-blue-950/30 dark:focus:text-blue-100"
                                                >
                                                  Em Progresso
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'resolved')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  Resolvido
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}
                                                  className="rounded-lg text-sm focus:bg-red-50 focus:text-red-900 dark:focus:bg-red-950/30 dark:focus:text-red-100"
                                                >
                                                  Rejeitado
                                                </DropdownMenuItem>
                                              </>
                                            )}

                                            {ticket.type === 'feature' && (
                                              <>
                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'pending')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  Pendente
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'under_review')}
                                                  className="rounded-lg text-sm focus:bg-amber-50 focus:text-amber-900 dark:focus:bg-amber-950/30 dark:focus:text-amber-100"
                                                >
                                                  Em Análise
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'approved')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  Aprovado
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'rejected')}
                                                  className="rounded-lg text-sm focus:bg-red-50 focus:text-red-900 dark:focus:bg-red-950/30 dark:focus:text-red-100"
                                                >
                                                  Rejeitado
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                  onClick={() => handleChangeTicketStatus(ticket.id, 'implemented')}
                                                  className="rounded-lg text-sm focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/30 dark:focus:text-emerald-100"
                                                >
                                                  Implementado
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                      )}

                                      {(userProfile?.role === "admin" || userProfile?.role === "moderator") && (
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger
                                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800"
                                          >
                                            Prioridade
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="w-44 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1 shadow-xl">
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "low")}>Baixa</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "medium")}>Média</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "high")}>Alta</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleChangeTicketPriority(ticket.id, "urgent")}>Urgente</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                      )}

                                      {userProfile?.role === 'admin' && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => setTicketToDelete(ticket)}
                                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950 hover:cursor-pointer"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
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
                  <div className="px-4 md:px-6 pb-4 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500 font-medium">
                      Página {supportPage} de {supportTotalPages || 1} • {ticketsTotal} chamado(s)
                    </p>
                    <div className="flex gap-2">
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

          {/* --- USERS TAB --- */}
          {activeTab === "audit" && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" /> Auditoria Operacional
                  </CardTitle>
                  <CardDescription>
                    Histórico das alterações administrativas e ações sensíveis no sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
                      <Input
                        value={auditSearch}
                        onChange={(e) => {
                          setAuditSearch(e.target.value);
                          setAuditPage(1);
                        }}
                        className="pl-10 h-10 rounded-xl"
                        placeholder="Buscar por ação, rota, ator, alvo..."
                      />
                    </div>
                    <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                      {auditTotal} registros
                    </Badge>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={() => void handleExportAuditCsv()}
                      disabled={isExportingCsv === "audit"}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isExportingCsv === "audit" ? "Exportando..." : "Exportar CSV"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <Select
                      value={auditActionFilter}
                      onValueChange={(value) => {
                        setAuditActionFilter(value);
                        setAuditPage(1);
                      }}
                    >
                      <SelectTrigger className="rounded-xl h-10">
                        <SelectValue placeholder="Ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas ações</SelectItem>
                        <SelectItem value="admin.users.patch">Atualização de usuário</SelectItem>
                        <SelectItem value="admin.users.normalize">Normalização</SelectItem>
                        <SelectItem value="admin.users.reset_financial_data">Reset financeiro</SelectItem>
                        <SelectItem value="admin.users.soft_delete">Exclusão de usuário</SelectItem>
                        <SelectItem value="admin.users.restore">Restauração de usuário</SelectItem>
                        <SelectItem value="admin.users.recount_transaction_count">Recontagem de transações</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={auditActorUidFilter}
                      onChange={(e) => {
                        setAuditActorUidFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                      placeholder="UID do ator"
                    />

                    <Input
                      value={auditTargetUidFilter}
                      onChange={(e) => {
                        setAuditTargetUidFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-10 rounded-xl"
                      placeholder="UID do alvo"
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
                      <div className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando auditoria...
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500">
                        Nenhum registro encontrado.
                      </div>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 md:p-4 space-y-2 bg-white dark:bg-zinc-950/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatAuditAction(log.action)}</p>
                            <Badge className="bg-zinc-800 text-white">{(log.method || "N/A").toUpperCase()}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                            <p><span className="font-semibold">Ator:</span> {log.actorUid || "-"}</p>
                            <p><span className="font-semibold">Alvo:</span> {log.targetUid || "-"}</p>
                            <p><span className="font-semibold">Quando:</span> {formatDateSafe(log.createdAt)}</p>
                            <p className="md:col-span-2 break-all"><span className="font-semibold">Rota:</span> {log.route || "-"}</p>
                            <p className="break-all"><span className="font-semibold">IP:</span> {log.ip || "-"}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-zinc-500">
                      Página {auditPage} de {Math.max(1, Math.ceil(auditTotal / auditPerPage))}
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

          {activeTab === "metrics" && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" /> Métricas Operacionais
                  </CardTitle>
                  <CardDescription>
                    Tráfego, erros, rate limit e latência das APIs monitoradas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <Select value={metricsWindowMinutes} onValueChange={setMetricsWindowMinutes}>
                      <SelectTrigger className="rounded-xl h-10 w-full md:w-56">
                        <SelectValue placeholder="Janela" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Últimos 15 minutos</SelectItem>
                        <SelectItem value="60">Última 1 hora</SelectItem>
                        <SelectItem value="180">Últimas 3 horas</SelectItem>
                        <SelectItem value="1440">Últimas 24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {healthData && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <Card className={`rounded-2xl border ${healthData.dbHealthy ? "border-emerald-200" : "border-red-300"}`}>
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">Banco</p>
                          <p className={`text-base font-bold ${healthData.dbHealthy ? "text-emerald-700" : "text-red-700"}`}>
                            {healthData.dbHealthy ? "Saudável" : "Falha"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border border-zinc-200">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">Webhook MP (min)</p>
                          <p className="text-base font-bold">{healthData.webhookDelayMinutes ?? "-"} min</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border border-zinc-200">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">Falhas pagamento 24h</p>
                          <p className="text-base font-bold">{healthData.failedPayments24h}</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-2xl border border-zinc-200">
                        <CardContent className="p-3">
                          <p className="text-xs text-zinc-500">Recuperação pendente</p>
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
                    <div className="h-24 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando métricas...
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-8 gap-3">
                        <Card className="rounded-2xl border border-zinc-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">Total Requests</p>
                            <p className="text-xl font-bold">{metricsSummary?.total ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-red-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-red-600">Erros 5xx</p>
                            <p className="text-xl font-bold text-red-600">{metricsSummary?.errors ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-amber-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-amber-700">Rate Limited (429)</p>
                            <p className="text-xl font-bold text-amber-700">{metricsSummary?.rateLimited ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-blue-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-blue-700">Latência Média</p>
                            <p className="text-xl font-bold text-blue-700">{metricsSummary?.avgDurationMs ?? 0} ms</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-red-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-red-600">Taxa de Erro</p>
                            <p className="text-xl font-bold text-red-600">{metricsSummary?.errorRatePct ?? 0}%</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-amber-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-amber-700">Taxa 429</p>
                            <p className="text-xl font-bold text-amber-700">{metricsSummary?.rateLimitedPct ?? 0}%</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-zinc-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">Janela Anterior</p>
                            <p className="text-xl font-bold">{metricsSummary?.previousTotal ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border border-zinc-200">
                          <CardContent className="p-3">
                            <p className="text-xs text-zinc-500">Variação Tráfego</p>
                            <p className={`text-xl font-bold ${(metricsSummary?.trafficDropPct ?? 0) > 0 ? "text-orange-700" : "text-emerald-700"}`}>
                              {(metricsSummary?.trafficDropPct ?? 0).toFixed(2)}%
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rota</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Erros</TableHead>
                              <TableHead>429</TableHead>
                              <TableHead>Latência Média</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metricsByRoute.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="h-20 text-center text-zinc-500">
                                  Sem dados de métricas para o período.
                                </TableCell>
                              </TableRow>
                            ) : (
                              metricsByRoute.map((row) => (
                                <TableRow key={row.route}>
                                  <TableCell className="font-medium">{row.route}</TableCell>
                                  <TableCell>{row.total}</TableCell>
                                  <TableCell className="text-red-600">{row.errors}</TableCell>
                                  <TableCell className="text-amber-700">{row.rateLimited}</TableCell>
                                  <TableCell>{row.avgDurationMs} ms</TableCell>
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

          {activeTab === "users" && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              {/* Filtros e Busca */}
              <div className="space-y-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Buscar usuário (nome ou email)..."
                    className="pl-9 h-11 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Filtro: Plano */}
                  <Select value={planFilter} onValueChange={(val) => setPlanFilter(val as UserPlan | "all")}>
                    <SelectTrigger className="w-full h-11 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Planos</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro: Cargo */}
                  <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as UserRole | "all")}>
                    <SelectTrigger className="w-full h-11 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Cargos</SelectItem>
                      <SelectItem value="admin">Administradores</SelectItem>
                      <SelectItem value="moderator">Moderadores</SelectItem>
                      <SelectItem value="client">Clientes</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro: Status */}
                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as UserStatus | "all")}>
                    <SelectTrigger className="w-full h-11 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro: Pagamento */}
                  <Select value={paymentStatusFilter} onValueChange={(val) => setPaymentStatusFilter(val as PaymentFilterType)}>
                    <SelectTrigger className="w-full h-11 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Pagamentos</SelectItem>
                      <SelectItem value="free">Grátis</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="not_paid">Não Pago</SelectItem>
                      <SelectItem value="overdue">Atrasado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                      <SelectItem value="unpaid_group" className="text-red-500 font-medium">Inadimplentes (Geral)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={clearUsersFilters}
                  >
                    <FilterX className="mr-2 h-4 w-4" /> Limpar filtros
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => void handleExportUsersCsv()}
                    disabled={isExportingCsv === "users"}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingCsv === "users" ? "Exportando..." : "Exportar CSV"}
                  </Button>
                </div>
              </div>

              <Card className="border-none shadow-xl shadow-violet-400/50 dark:shadow-black/20 bg-white dark:bg-violet-900 rounded-3xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-violet-200/50 dark:bg-violet-900/50">
                  <CardTitle className="text-lg font-semibold text-violet-600 dark:text-violet-400">Base de Usuários</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="md:hidden p-3 space-y-3">
                    {isLoadingUsers ? (
                      <div className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando base de dados...
                      </div>
                    ) : paginatedUsers.length === 0 ? (
                      <div className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500 text-sm">
                        Nenhum usuário encontrado com os filtros atuais.
                      </div>
                    ) : (
                      paginatedUsers.map((u) => {
                        const isTargetAdminOrMod = u.role === "admin" || u.role === "moderator";
                        const canChangeRole = canEditRole(u);
                        const canChangePlan = canEditPlan(u);
                        const canEditThisUser = canEditUser(u);
                        return (
                          <div key={u.uid} className="rounded-2xl border border-zinc-200 bg-white p-3 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-900 truncate">{u.displayName}</p>
                                <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  Cadastro: {new Date(u.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100">
                                    <MoreVertical className="h-4 w-4 text-zinc-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl p-1 shadow-xl border-zinc-200 dark:border-zinc-800">
                                  <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {canImpersonateUsers && (
                                    <DropdownMenuItem
                                      onClick={() => handleRequestImpersonation(u)}
                                      disabled={!canEditThisUser}
                                      className="cursor-pointer rounded-lg text-xs font-medium"
                                    >
                                      <User className="mr-2 h-4 w-4" /> Impersonar
                                    </DropdownMenuItem>
                                  )}
                                  {canManageSensitive && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => setUserToReset(u)}
                                        disabled={!canEditThisUser}
                                        className="cursor-pointer rounded-lg text-xs font-medium disabled:opacity-50"
                                      >
                                        <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Dados
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setUserToDelete(u)}
                                        disabled={!canEditThisUser}
                                        className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg text-xs font-medium dark:focus:bg-red-900/20 disabled:opacity-50"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir Conta
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] text-zinc-400 uppercase">Plano</p>
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
                                <p className="text-[10px] text-zinc-400 uppercase">Função</p>
                                {canChangeRole ? (
                                  <Select value={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
                                    <SelectTrigger className="w-full h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="client">Cliente</SelectItem>
                                      <SelectItem value="support">Suporte</SelectItem>
                                      <SelectItem value="moderator">Moderador</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary" className="mt-1">
                                    {u.role === 'client' ? 'Cliente' : u.role === 'support' ? 'Suporte' : u.role === 'moderator' ? 'Moderador' : 'Admin'}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-zinc-200">
                                Registros: {Number.isNaN(u.transactionCount) ? "..." : (u.transactionCount ?? "...")}
                              </Badge>
                              <Badge variant={u.status === "active" ? "default" : "destructive"} className={u.status === "active" ? "bg-emerald-500" : ""}>
                                {u.status === "active" ? "Ativo" : u.status === "blocked" ? "Bloqueado" : "Inativo"}
                              </Badge>
                            </div>

                            <div>
                              <p className="text-[10px] text-zinc-400 uppercase mb-1">Pagamento</p>
                              {isTargetAdminOrMod ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <ShieldCheck className="h-3 w-3 mr-1" /> Isento
                                </Badge>
                              ) : (
                                <Select
                                  value={u.paymentStatus || "free"}
                                  onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}
                                  disabled={!canEditThisUser}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">Grátis</SelectItem>
                                    <SelectItem value="paid">Pago</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="not_paid">Não Pago</SelectItem>
                                    <SelectItem value="overdue">Atrasado</SelectItem>
                                    <SelectItem value="canceled">Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-violet-100 dark:bg-violet-950">
                        <TableRow className="border-violet-100 dark:border-violet-800 hover:bg-transparent">
                          <TableHead className="pl-6 font-semibold">Usuário</TableHead>
                          <TableHead className="font-semibold">Cadastro</TableHead>
                          <TableHead className="font-semibold">Plano</TableHead>
                          <TableHead className="font-semibold">Função</TableHead>
                          <TableHead className="font-semibold">Registros</TableHead>
                          <TableHead className="font-semibold">Sts. Pagamento</TableHead>
                          <TableHead className="font-semibold">Sts. Usuário</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">Ações</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoadingUsers ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center">
                              <div className="flex justify-center items-center gap-2 text-zinc-500">
                                <Loader2 className="h-5 w-5 animate-spin" /> Carregando base de dados...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                              Nenhum usuário encontrado com os filtros atuais.
                            </TableCell>
                          </TableRow>
                        ) : paginatedUsers.map((u) => {
                          const isTargetAdminOrMod = u.role === 'admin' || u.role === 'moderator';
                          const canChangeRole = canEditRole(u);
                          const canChangePlan = canEditPlan(u);
                          const canEditThisUser = canEditUser(u);

                          return (
                            <TableRow key={u.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 transition-colors">
                              <TableCell className="pl-6">
                                <div>
                                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {u.displayName}
                                  </p>
                                  <p className="text-xs text-zinc-500">{u.email}</p>
                                </div>
                              </TableCell>

                              <TableCell className="text-zinc-500 text-xs font-medium">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </TableCell>

                              <TableCell>
                                {canChangePlan ? (
                                  <Select value={u.plan} onValueChange={(val) => handlePlanChange(u.uid, val)}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg">
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
                                    <SelectTrigger className="w-[110px] h-8 text-xs border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="client">Cliente</SelectItem>
                                      <SelectItem value="support">Suporte</SelectItem>
                                      <SelectItem value="moderator">Moderador</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg w-fit cursor-not-allowed">
                                    <Lock className="h-3 w-3" /> {u.role === 'client' ? 'Cliente' : u.role === 'support' ? 'Suporte' : u.role === 'moderator' ? 'Moderador' : 'Admin'}
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
                                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium pl-2 bg-emerald-50 dark:bg-emerald-900/20 py-1 px-2 rounded-lg w-fit" title="Isento de pagamento">
                                    <ShieldCheck className="h-3 w-3" />
                                    Isento
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                  <Select
                                    value={u.paymentStatus || 'free'}
                                    onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}
                                    disabled={!canEditThisUser}
                                  >
                                    <SelectTrigger className={`w-[110px] h-8 text-xs border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg ${u.paymentStatus === 'overdue' || u.paymentStatus === 'not_paid' ? 'text-red-600 font-bold' :
                                      u.paymentStatus === 'paid' ? 'text-emerald-600 font-medium' : ''
                                      }`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="free">Grátis</SelectItem>
                                      <SelectItem value="paid">Pago</SelectItem>
                                      <SelectItem value="pending">Pendente</SelectItem>
                                      <SelectItem value="not_paid">Não Pago</SelectItem>
                                      <SelectItem value="overdue">Atrasado</SelectItem>
                                      <SelectItem value="canceled">Cancelado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-[10px] text-zinc-500 leading-none">
                                    {u.billing?.source === "mercadopago_webhook" ? "Fonte: Webhook MP" : "Fonte: Manual"}
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
                                  {u.status === "active" ? "Ativo" : u.status === "blocked" ? "Bloqueado" : "Inativo"}
                                </Badge>
                              </TableCell>

                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end items-center gap-2">
                                  {/* Botão de Bloqueio/Desbloqueio */}
                                  {u.status === "active" ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditThisUser}
                                      className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Bloquear Usuário"
                                      onClick={() => handleStatusChange(u.uid, "blocked")}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditThisUser}
                                      className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                      title="Reativar Usuário"
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
                                      <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {canImpersonateUsers && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => handleRequestImpersonation(u)}
                                            disabled={!canEditThisUser}
                                            className="cursor-pointer rounded-lg text-xs font-medium"
                                          >
                                            <User className="mr-2 h-4 w-4" /> Impersonar
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {canManageSensitive && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => setUserToReset(u)}
                                            disabled={!canEditThisUser}
                                            className="cursor-pointer rounded-lg text-xs font-medium disabled:opacity-50">
                                            <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Dados
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => setUserToDelete(u)}
                                            disabled={!canEditThisUser}
                                            className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-lg text-xs font-medium dark:focus:bg-red-900/20 disabled:opacity-50"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" /> Excluir Conta
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                      {!canImpersonateUsers && <p className="p-2 text-xs text-zinc-400 italic">Somente administradores.</p>}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <p className="text-xs text-zinc-500 font-medium">Página {currentPage} de {totalPages || 1}</p>
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
              <Card className="border-none shadow-lg shadow-orange-500/10 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-orange-100 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10">
                  <CardTitle className="text-lg font-semibold text-orange-600 flex items-center gap-2">
                    <ArchiveRestore className="h-5 w-5" /> Usuários Excluídos & Arquivados
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="md:hidden p-3 space-y-3">
                    {deletedUsers.length === 0 ? (
                      <div className="h-28 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-500 text-sm">
                        Nenhum usuário excluído encontrado.
                      </div>
                    ) : (
                      deletedUsers.map((u) => (
                        <div key={u.uid} className="rounded-2xl border border-orange-200 bg-orange-50/30 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-900 truncate">{u.displayName}</p>
                              <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-100 rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl border-orange-100 dark:border-orange-900/30">
                                <DropdownMenuLabel className="text-orange-700 dark:text-orange-400">Ações de Restauração</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                <DropdownMenuItem onClick={() => handleRestoreUser(u, false)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                  <UserIcon className="mr-2 h-4 w-4" /> Restaurar Somente a Conta
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRestoreUser(u, true)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar Conta e Dados
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">
                              {u.transactionCount} Transações
                            </Badge>
                            <span className="uppercase text-xs font-bold text-zinc-500">{u.plan}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-orange-100 dark:border-orange-900/30 hover:bg-transparent">
                          <TableHead className="pl-6 font-semibold">Usuário</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Dados Arquivados</TableHead>
                          <TableHead className="font-semibold">Plano Anterior</TableHead>
                          <TableHead className="text-right pr-6 font-semibold">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                              Nenhum usuário excluído encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          deletedUsers.map((u) => (
                            <TableRow key={u.uid} className="bg-orange-50/10 border-orange-100/50 dark:border-orange-900/20 hover:bg-orange-50/30 dark:hover:bg-orange-900/20 transition-colors">
                              <TableCell className="pl-6 font-medium text-zinc-800 dark:text-zinc-200">{u.displayName}</TableCell>
                              <TableCell className="text-zinc-500">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
                                  {u.transactionCount} Transações
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
                                    <DropdownMenuLabel className="text-orange-700 dark:text-orange-400">Ações de Restauração</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-orange-100 dark:bg-orange-900/30" />
                                    <DropdownMenuItem onClick={() => handleRestoreUser(u, false)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                      <UserIcon className="mr-2 h-4 w-4" /> Restaurar Somente a Conta
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRestoreUser(u, true)} className="cursor-pointer rounded-lg text-xs font-medium focus:bg-orange-50 dark:focus:bg-orange-900/20">
                                      <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar Conta e Dados
                                    </DropdownMenuItem>
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
          {activeTab === "plans" && canManageSensitive && (
            <div className={`${fadeInUp} delay-200 space-y-4`}>
              <div className="flex justify-end mb-4">
                <Button
                  onClick={savePlans}
                  disabled={isSavingPlans}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
                >
                  {isSavingPlans ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Alterações
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* FREE */}
                <Card className="border-2 border-amber-700/30 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl shadow-amber-700/5 hover:shadow-amber-700/10 transition-shadow">
                  <CardHeader className="bg-amber-50 dark:bg-amber-900/10 rounded-t-3xl p-6 flex flex-row items-center justify-between border-b border-amber-100/50 dark:border-amber-900/20">
                    <div className="flex flex-col justify-center">
                      <CardTitle className="text-amber-700 font-bold text-lg">
                        Plano {plans.free.name} · Bronze
                      </CardTitle>
                      <CardDescription className="text-amber-600/70">Configurações.</CardDescription>
                    </div>
                    <Switch checked={editedPlans.free.active} onCheckedChange={(c) => handlePlanEdit("free", "active", c)} className="data-[state=checked]:bg-amber-600" />
                  </CardHeader>

                  <CardContent className={`p-6 space-y-4 ${!editedPlans.free.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Nome</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.free.name ?? ""} onChange={(e) => handlePlanEdit("free", "name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Descrição</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.free.description ?? ""} onChange={(e) => handlePlanEdit("free", "description", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Limite Lançamentos</Label>
                      <Input className="rounded-xl h-10" type="number" value={editedPlans.free.limit ?? 0} onChange={(e) => handlePlanEdit("free", "limit", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Benefícios (linha a linha)</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.free.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("free", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* PREMIUM */}
                <Card className="border-2 border-slate-400/40 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl shadow-slate-400/5 hover:shadow-slate-400/10 transition-shadow">
                  <CardHeader className="bg-slate-50 dark:bg-slate-900/20 rounded-t-3xl p-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col justify-center">
                      <CardTitle className="text-slate-600 dark:text-slate-400 font-bold text-lg">
                        Plano {plans.premium.name} · Prata
                      </CardTitle>
                      <CardDescription className="text-slate-500/70">Configurações.</CardDescription>
                    </div>
                    <Switch checked={editedPlans.premium.active} onCheckedChange={(c) => handlePlanEdit("premium", "active", c)} className="data-[state=checked]:bg-slate-600" />
                  </CardHeader>

                  <CardContent className={`p-6 space-y-4 ${!editedPlans.premium.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">Nome</Label>
                        <Input className="rounded-xl h-10" value={editedPlans.premium.name ?? ""} onChange={(e) => handlePlanEdit("premium", "name", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">Preço</Label>
                        <Input className="rounded-xl h-10" type="number" value={editedPlans.premium.price ?? 0} onChange={(e) => handlePlanEdit("premium", "price", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Link Pagamento</Label>
                      <Input className="rounded-xl h-10 font-mono text-xs text-emerald-600" value={editedPlans.premium.paymentLink ?? ""} onChange={(e) => handlePlanEdit("premium", "paymentLink", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Descrição</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.premium.description ?? ""} onChange={(e) => handlePlanEdit("premium", "description", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Benefícios</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.premium.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("premium", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* PRO */}
                <Card className="border-2 border-yellow-500/40 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl shadow-yellow-500/10 hover:shadow-yellow-500/20 transition-shadow">
                  <CardHeader className="bg-yellow-100 dark:bg-yellow-900/20 rounded-t-3xl p-6 flex flex-row items-center justify-between border-b border-yellow-200 dark:border-yellow-900/30">
                    <div className="flex flex-col justify-center">
                      <CardTitle className="text-yellow-600 font-bold text-lg">
                        Plano {editedPlans.pro.name} · Ouro
                      </CardTitle>
                      <CardDescription className="text-yellow-600/70">Configurações.</CardDescription>
                    </div>
                    <Switch checked={editedPlans.pro.active} onCheckedChange={(c) => handlePlanEdit("pro", "active", c)} className="data-[state=checked]:bg-yellow-500" />
                  </CardHeader>

                  <CardContent className={`p-6 space-y-4 ${!editedPlans.pro.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">Nome</Label>
                        <Input className="rounded-xl h-10" value={editedPlans.pro.name ?? ""} onChange={(e) => handlePlanEdit("pro", "name", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">Preço</Label>
                        <Input className="rounded-xl h-10" type="number" value={editedPlans.pro.price ?? 0} onChange={(e) => handlePlanEdit("pro", "price", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Link Pagamento</Label>
                      <Input className="rounded-xl h-10 font-mono text-xs text-yellow-600" value={editedPlans.pro.paymentLink ?? ""} onChange={(e) => handlePlanEdit("pro", "paymentLink", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Descrição</Label>
                      <Input className="rounded-xl h-10" value={editedPlans.pro.description ?? ""} onChange={(e) => handlePlanEdit("pro", "description", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-400">Benefícios</Label>
                      <textarea
                        className="flex min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs resize-none"
                        value={editedPlans.pro.features?.join("\n") ?? ""}
                        onChange={(e) => handleFeaturesEdit("pro", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {plans && plans.pro.active && (
                  <div className="col-span-1 md:col-span-3 text-xs text-zinc-500 italic text-center">
                    O Plano Pro oferece benefícios exclusivos. Certifique-se de configurar corretamente o link de pagamento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
            <Button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} className="w-full rounded-xl hover:cursor-pointer">Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Normalização */}
      <Dialog open={showNormalizeConfirm} onOpenChange={setShowNormalizeConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Wrench className="h-5 w-5" /> Normalizar Banco de Dados?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Isso irá verificar <strong>todos os usuários</strong> e adicionar campos ausentes (telefone, nome completo, etc.) com valores padrão.
              <br /><br />
              Essa operação pode levar alguns segundos se houver muitos usuários.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNormalizeConfirm(false)} className="rounded-xl hover:cursor-pointer">Cancelar</Button>
            <Button onClick={confirmNormalizeDB} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl hover:cursor-pointer">Iniciar Normalização</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação Restauração */}
      <Dialog open={!!userToRestore} onOpenChange={(open) => !open && setUserToRestore(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ArchiveRestore className="h-5 w-5" /> Confirmar Restauração
            </DialogTitle>
            <DialogDescription className="pt-2">
              Você está prestes a restaurar a conta de <strong>{userToRestore?.user.displayName}</strong>.
              <br /><br />
              <strong>Ação Escolhida:</strong> {userToRestore?.withData ? "Restaurar Conta + Dados Financeiros" : "Restaurar Apenas Conta (Sem Dados)"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserToRestore(null)} className="rounded-xl hover:cursor-pointer">Cancelar</Button>
            <Button onClick={confirmRestoreUser} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl hover:cursor-pointer">Confirmar Restauração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resetar Dados */}
      <Dialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Resetar Dados?</DialogTitle>
            <DialogDescription>Confirme para apagar todas as transações.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToReset(null)} variant="ghost" className="rounded-xl hover:cursor-pointer">Cancelar</Button>
            <Button onClick={confirmResetData} variant="destructive" className="rounded-xl hover:cursor-pointer">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir Usuário?</DialogTitle>
            <DialogDescription>Confirme para remover permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToDelete(null)} variant="ghost" className="rounded-xl hover:cursor-pointer">Cancelar</Button>
            <Button onClick={confirmDeleteUser} variant="destructive" className="rounded-xl hover:cursor-pointer">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sucesso Exclusão */}
      <Dialog open={!!deletedUserData} onOpenChange={(open) => !open && setDeletedUserData(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full w-fit mb-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-center text-xl">Usuário Excluído</DialogTitle>
            <DialogDescription className="text-center">
              A conta foi marcada como <strong>deletada</strong> e o acesso revogado.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl space-y-2 border border-zinc-100 dark:border-zinc-800">
            <p className="text-sm"><strong>Nome:</strong> {deletedUserData?.name}</p>
            <p className="text-sm"><strong>E-mail:</strong> {deletedUserData?.email}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeletedUserData(null)} className="w-full rounded-xl hover:cursor-pointer">Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reativar */}
      <Dialog open={!!userToReactivate} onOpenChange={(open) => !open && cancelReactivateUser()}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5 mb-2" /> Reativar Acesso?
            </DialogTitle>
            <DialogDescription>
              O pagamento foi identificado. Deseja reativar o acesso de <strong>{userToReactivate?.displayName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelReactivateUser} className="rounded-xl hover:cursor-pointer">Manter Bloqueado</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl hover:cursor-pointer" onClick={confirmReactivateUser}>Sim, Reativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Bloquear */}
      <Dialog open={!!userToBlock} onOpenChange={(open) => !open && cancelBlockUser()}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bloquear Usuário</DialogTitle>
            <DialogDescription>Você está suspendendo o acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select onValueChange={setSelectedReason} value={selectedReason}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{blockReasonOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {selectedReason === "Outros" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Descreva</Label>
                <textarea className="flex min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelBlockUser} className="rounded-xl hover:cursor-pointer">Cancelar</Button>
            <Button variant="destructive" onClick={confirmBlockUser} className="rounded-xl hover:cursor-pointer">Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes do Chamado */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTicket?.type === 'feature' ? (
                <Lightbulb className="h-5 w-5 text-amber-600" />
              ) : (
                <HeadphonesIcon className="h-5 w-5 text-violet-600" />
              )}
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold block">Solicitante:</span>
                  <span className="text-zinc-600">{viewTicket.name}</span>
                </div>
                <div>
                  <span className="font-semibold block">Email:</span>
                  <span className="text-zinc-600">{viewTicket.email}</span>
                </div>
                <div>
                  <span className="font-semibold block">Data:</span>
                  <span className="text-zinc-600">
                    {formatDateSafe(viewTicket.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="font-semibold block">Status Atual:</span>
                  <Badge variant="secondary" className="mt-1">{formatTicketStatus(viewTicket.status)}</Badge>
                </div>
                <div>
                  <span className="font-semibold block">Protocolo:</span>
                  <span className="text-zinc-600">{viewTicket.protocol || `#${viewTicket.id.slice(0, 8)}`}</span>
                </div>
                <div>
                  <span className="font-semibold block">Prioridade:</span>
                  <Badge className={`mt-1 ${getTicketPriorityTone(viewTicket.priority)}`}>
                    {getTicketPriorityLabel(viewTicket.priority)}
                  </Badge>
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="font-semibold block text-sm mb-2">Mensagem:</span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {viewTicket.message}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewTicket(null)} className="w-full rounded-xl hover:cursor-pointer">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Ticket */}
      <Dialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        <DialogContent className="rounded-2xl sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Excluir Chamado
            </DialogTitle>
            <DialogDescription className="pt-2">
              Tem certeza que deseja apagar este registro de suporte? Essa ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTicketToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteTicket}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



