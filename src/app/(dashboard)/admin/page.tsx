"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlans } from "@/hooks/usePlans";
import {
  subscribeToAllUsers,
  updateUserStatus,
  updateUserPlan,
  updateUserRole,
  getUserTransactionCount,
  resetUserFinancialData,
  softDeleteUser,
  updateUserPaymentStatus,
  normalizeDatabaseUsers,
  restoreUserAccount,
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
import { useRouter } from "next/navigation";
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
  History,
  AlertTriangle,
  Info,
} from "lucide-react";

type UserWithCount = UserProfile & { transactionCount?: number };
type DeletionSuccessData = { name: string; email: string } | null;
type PaymentFilterType = UserPaymentStatus | "unpaid_group" | "all";

type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const { plans } = usePlans();
  const router = useRouter();

  // UI - Abas
  const [activeTab, setActiveTab] = useState<string>("users");

  // Users Data
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isNormalizing, setIsNormalizing] = useState(false);

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [planFilter, setPlanFilter] = useState<UserPlan | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentFilterType>("all");
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // --- MODAIS DE AÇÃO ---
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletedUserData, setDeletedUserData] = useState<DeletionSuccessData>(null);
  const [userToReactivate, setUserToReactivate] = useState<UserProfile | null>(null);
  const [userToBlock, setUserToBlock] = useState<UserProfile | null>(null);
  
  // Modal de Restauração (Substitui confirm)
  const [userToRestore, setUserToRestore] = useState<{ user: UserProfile, withData: boolean } | null>(null);
  
  // Modal de Normalização (Substitui confirm)
  const [showNormalizeConfirm, setShowNormalizeConfirm] = useState(false);

  // Modal de Feedback Genérico (Substitui alerts)
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });

  const [pendingPaymentChange, setPendingPaymentChange] = useState<{ uid: string; status: UserPaymentStatus } | null>(null);

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

  // --- PERMISSÕES ---
  const canManageSensitive = userProfile?.role === "admin";
  const canRestore = userProfile?.role === "admin" || userProfile?.role === "moderator";

  const canViewRole = useCallback((targetRole: UserRole) => {
    if (userProfile?.role === "admin") return true;
    if (userProfile?.role === "moderator") return targetRole === "client";
    return false;
  }, [userProfile?.role]);

  // --- Guards ---
  useEffect(() => {
    if (!loading) {
      if (userProfile?.role !== "admin" && userProfile?.role !== "moderator") {
        router.push("/");
      }
    }
  }, [userProfile, loading, router]);

  useEffect(() => {
    if (plans) setEditedPlans(plans);
  }, [plans]);

  // --- Contagem ---
  const attachCounts = useCallback(async (list: UserProfile[]) => {
    const withCounts = await Promise.all(
      list.map(async (u) => {
        try {
          const realCount = await getUserTransactionCount(u.uid);
          return { ...u, transactionCount: realCount };
        } catch {
          return { ...u, transactionCount: NaN };
        }
      })
    );
    setUsers(withCounts);
  }, []);

  // --- Users realtime ---
  useEffect(() => {
    if (loading) return;
    if (!userProfile) return;
    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;

    setIsLoadingUsers(true);

    const unsubscribe = subscribeToAllUsers(
      (list) => {
        attachCounts(list).finally(() => setIsLoadingUsers(false));
      },
      () => {
        setUsers([]);
        setIsLoadingUsers(false);
      }
    );

    return () => unsubscribe();
  }, [loading, userProfile, attachCounts]);

  // --- Helper para Feedback ---
  const showFeedback = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setFeedbackModal({ isOpen: true, type, title, message });
  };

  // --- HANDLERS ---

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

  // Prepara restauração (Abre Modal)
  const handleRestoreUser = (u: UserProfile, restoreData: boolean) => {
    setUserToRestore({ user: u, withData: restoreData });
  };

  // Confirma Restauração
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
      // Substituído alert por feedback modal
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
    // Substituído alert por feedback
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
    const list = users.filter((u) => {
      if (u.status === 'deleted') return false;

      const matchesSearch = (u.displayName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesPlan = planFilter === "all" || u.plan === planFilter;

      let matchesPayment = true;
      if (paymentStatusFilter !== "all") {
        if (paymentStatusFilter === "unpaid_group") {
          const safeStatus = u.paymentStatus || 'free';
          matchesPayment = safeStatus !== "paid" && safeStatus !== "free";
        } else {
          matchesPayment = u.paymentStatus === paymentStatusFilter;
        }
      }

      const isVisible = canViewRole(u.role);
      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = u.status === statusFilter;
      }

      return matchesSearch && matchesRole && matchesPlan && matchesPayment && isVisible && matchesStatus;
    });

    const rolePriority: Record<UserRole, number> = { admin: 1, moderator: 2, client: 3 };
    return list.sort((a, b) => rolePriority[a.role] - rolePriority[b.role]);
  }, [users, searchTerm, roleFilter, planFilter, paymentStatusFilter, statusFilter, canViewRole]);

  const deletedUsers = useMemo(() => {
    return users.filter(u => u.status === 'deleted');
  }, [users]);

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, planFilter, paymentStatusFilter, statusFilter]);

  if (
    loading ||
    (userProfile?.role !== "admin" && userProfile?.role !== "moderator") ||
    !editedPlans
  )
    return null;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-600" />
            Administração
          </h1>
          <p className="text-zinc-500">Controle total da plataforma.</p>
        </div>

        {canManageSensitive && (
          <Button
            onClick={() => setShowNormalizeConfirm(true)}
            disabled={isNormalizing}
            variant="outline"
            className="bg-white dark:bg-zinc-900 border-amber-200 text-amber-700 hover:bg-amber-50 gap-2"
          >
            {isNormalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Corrigir/Normalizar Dados Antigos
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Navegação de Abas */}
        <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit grid grid-cols-3">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all ${activeTab === "users"
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
          >
            <UserIcon className="h-4 w-4" /> Gerenciar Usuários
          </button>

          {/* Aba Restore - Visível apenas para Admin e Moderator */}
          {canRestore && (
            <button
              onClick={() => setActiveTab("restore")}
              className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all ${activeTab === "restore"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
            >
              <History className="h-4 w-4" /> Restaurar Dados
            </button>
          )}

          <button
            onClick={() => setActiveTab("plans")}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all ${activeTab === "plans"
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
          >
            <CreditCard className="h-4 w-4" /> Gerenciar Planos
          </button>
        </div>

        {/* --- USERS TAB --- */}
        {activeTab === "users" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-2">
              {/* Busca */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar usuário (nome ou email)..."
                  className="pl-9 rounded-xl bg-zinc-100 dark:bg-zinc-800"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtros em Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Filtro: Plano */}
                <Select value={planFilter} onValueChange={(val) => setPlanFilter(val as UserPlan | "all")}>
                  <SelectTrigger className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium 💎</SelectItem>
                    <SelectItem value="pro">Pro 👑</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro: Cargo */}
                <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as UserRole | "all")}>
                  <SelectTrigger className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800">
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
                  <SelectTrigger className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                    {/* Removido Deleted daqui pois tem aba própria */}
                  </SelectContent>
                </Select>

                {/* Filtro: Pagamento */}
                <Select value={paymentStatusFilter} onValueChange={(val) => setPaymentStatusFilter(val as PaymentFilterType)}>
                  <SelectTrigger className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800">
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
                    <SelectItem value="unpaid_group" className="text-red-500 font-medium">⚠️ Inadimplentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border-none shadow-sm shadow-violet-600/50 dark:shadow-violet-600/20 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
              <CardHeader className="h-12 flex items-center border-zinc-100 dark:border-zinc-800 bg-zinc-300/50 dark:bg-zinc-900/50">
                <CardTitle className="text-violet-600">Base de Usuários</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Usuário</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Registros</TableHead>
                        <TableHead>Sts. Pagamento</TableHead>
                        <TableHead>Sts. Usuário</TableHead>
                        <TableHead className="text-right pr-6">Ações</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoadingUsers ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : paginatedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-zinc-500">
                            Nenhum usuário ativo ou inativo encontrado.
                          </TableCell>
                        </TableRow>
                      ) : paginatedUsers.map((u) => {
                        const isAdminOrMod = u.role === 'admin' || u.role === 'moderator';

                        return (
                          <TableRow key={u.uid}>
                            <TableCell className="pl-6">
                              <div>
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {u.displayName}
                                </p>
                                <p className="text-xs text-zinc-500">{u.email}</p>
                              </div>
                            </TableCell>

                            <TableCell className="text-zinc-500 text-xs">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </TableCell>

                            <TableCell>
                              <Select value={u.plan} onValueChange={(val) => handlePlanChange(u.uid, val)}>
                                <SelectTrigger className="w-[120px] h-8 text-xs border-zinc-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="premium">Premium 💎</SelectItem>
                                  <SelectItem value="pro">Pro 👑</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell>
                              <Select value={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
                                <SelectTrigger className="w-[110px] h-8 text-xs border-zinc-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="client">Cliente</SelectItem>
                                  <SelectItem value="moderator">Moderador</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-zinc-200">
                                {Number.isNaN(u.transactionCount) ? "..." : u.transactionCount ?? "..."}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {isAdminOrMod ? (
                                <div className="flex items-center gap-1 text-xs text-zinc-500 italic pl-2" title="Isento de pagamento">
                                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                  Isento
                                </div>
                              ) : (
                                <Select
                                  value={u.paymentStatus || 'free'}
                                  onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}
                                >
                                  <SelectTrigger className={`w-[110px] h-8 text-xs border-zinc-200 ${u.paymentStatus === 'overdue' || u.paymentStatus === 'not_paid' ? 'text-red-600 font-medium' :
                                    u.paymentStatus === 'paid' ? 'text-emerald-600' : ''
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
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={u.status === "active" ? "default" : "destructive"}
                                className={u.status === "active" ? "bg-emerald-500" : ""}
                              >
                                {u.status === "active" ? "Ativo" : u.status === "blocked" ? "Bloqueado" : "Inativo"}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end items-center gap-2">
                                {u.status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-400 hover:text-red-500"
                                    title="Bloquear Usuário"
                                    onClick={() => handleStatusChange(u.uid, "blocked")}
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-500"
                                    title="Reativar Usuário"
                                    onClick={() => handleStatusChange(u.uid, "active")}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {canManageSensitive && (
                                      <>
                                        <DropdownMenuItem onClick={() => window.open(`/api/impersonate?uid=${u.uid}`, "_blank")}>
                                          <User className="mr-2 h-4 w-4" /> Impersonar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setUserToReset(u)}>
                                          <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Dados
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setUserToDelete(u)} className="text-red-600">
                                          <Trash2 className="mr-2 h-4 w-4" /> Excluir Conta
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {!canManageSensitive && <p className="p-2 text-xs text-zinc-400 italic">Somente administradores.</p>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500">Página {currentPage} de {totalPages || 1}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "restore" && canRestore && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <Card className="border-none shadow-sm shadow-orange-600/50 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
              <CardHeader className="h-12 flex items-center border-orange-100 bg-orange-50 dark:bg-orange-900/10">
                <CardTitle className="text-orange-600 flex items-center gap-2">
                  <ArchiveRestore className="h-5 w-5" /> Usuários Excluídos & Arquivados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Usuário</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Dados Arquivados</TableHead>
                        <TableHead>Plano Anterior</TableHead>
                        <TableHead className="text-right pr-6">Ação</TableHead>
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
                          <TableRow key={u.uid} className="bg-orange-50/20">
                            <TableCell className="pl-6 font-medium">{u.displayName}</TableCell>
                            <TableCell className="text-zinc-500">{u.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">
                                {u.transactionCount} Transações
                              </Badge>
                            </TableCell>
                            <TableCell className="uppercase text-xs font-bold text-zinc-400">{u.plan}</TableCell>
                            <TableCell className="text-right pr-6">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-100">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Ações de Restauração</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleRestoreUser(u, false)}>
                                    <UserIcon className="mr-2 h-4 w-4" /> Restaurar Somente a Conta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRestoreUser(u, true)}>
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
        {activeTab === "plans" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-end mb-4">
              <Button
                onClick={savePlans}
                disabled={isSavingPlans}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl shadow-lg shadow-emerald-500/20"
              >
                {isSavingPlans ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Alterações
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* FREE */}
              <Card className="border-2 border-amber-700/30 rounded-2xl bg-white dark:bg-zinc-900 shadow-md shadow-amber-700/10">
                <CardHeader className="bg-amber-50 dark:bg-amber-900/10 rounded-t-2xl p-4 flex flex-row items-center justify-between">
                  <div className="flex flex-col justify-center">
                    <CardTitle className="text-amber-700 font-bold">
                      Plano {plans.free.name} · Bronze
                    </CardTitle>
                    <CardDescription>Configurações.</CardDescription>
                  </div>
                  <Switch checked={editedPlans.free.active} onCheckedChange={(c) => handlePlanEdit("free", "active", c)} />
                </CardHeader>

                <CardContent className={`space-y-4 ${!editedPlans.free.active ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editedPlans.free.name ?? ""} onChange={(e) => handlePlanEdit("free", "name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input value={editedPlans.free.description ?? ""} onChange={(e) => handlePlanEdit("free", "description", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite Lançamentos</Label>
                    <Input type="number" value={editedPlans.free.limit ?? 0} onChange={(e) => handlePlanEdit("free", "limit", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Benefícios (linha a linha)</Label>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background
                      placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                      value={editedPlans.free.features?.join("\n") ?? ""}
                      onChange={(e) => handleFeaturesEdit("free", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PREMIUM */}
              <Card className="border-2 border-slate-400/40 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl shadow-slate-400/10">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/20 rounded-t-2xl p-4 flex flex-row items-center justify-between">
                  <div className="flex flex-col justify-center">
                    <CardTitle className="text-slate-600 font-bold">
                      Plano {plans.premium.name} · Prata
                    </CardTitle>
                    <CardDescription>Configurações.</CardDescription>
                  </div>
                  <Switch checked={editedPlans.premium.active} onCheckedChange={(c) => handlePlanEdit("premium", "active", c)} />
                </CardHeader>

                <CardContent className={`space-y-4 ${!editedPlans.premium.active ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={editedPlans.premium.name ?? ""} onChange={(e) => handlePlanEdit("premium", "name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço</Label>
                      <Input type="number" value={editedPlans.premium.price ?? 0} onChange={(e) => handlePlanEdit("premium", "price", Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Link Pagamento</Label>
                    <Input className="font-mono text-xs text-emerald-600" value={editedPlans.premium.paymentLink ?? ""} onChange={(e) => handlePlanEdit("premium", "paymentLink", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input value={editedPlans.premium.description ?? ""} onChange={(e) => handlePlanEdit("premium", "description", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Benefícios</Label>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background
                      placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                      value={editedPlans.premium.features?.join("\n") ?? ""}
                      onChange={(e) => handleFeaturesEdit("premium", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PRO */}
              <Card className="border-2 border-yellow-500/40 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl shadow-yellow-500/20">
                <CardHeader className="bg-yellow-100 dark:bg-yellow-900/20 p-4 flex flex-row items-center justify-between">
                  <div className="flex flex-col justify-center">
                    <CardTitle className="text-yellow-600 font-bold">
                      Plano {editedPlans.pro.name} · Ouro
                    </CardTitle>
                    <CardDescription className="text-yellow-500">Configurações.</CardDescription>
                  </div>
                  <Switch checked={editedPlans.pro.active} onCheckedChange={(c) => handlePlanEdit("pro", "active", c)} />
                </CardHeader>

                <CardContent className={`space-y-4 ${!editedPlans.pro.active ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={editedPlans.pro.name ?? ""} onChange={(e) => handlePlanEdit("pro", "name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço</Label>
                      <Input type="number" value={editedPlans.pro.price ?? 0} onChange={(e) => handlePlanEdit("pro", "price", Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Link Pagamento</Label>
                    <Input className="font-mono text-xs text-yellow-600" value={editedPlans.pro.paymentLink ?? ""} onChange={(e) => handlePlanEdit("pro", "paymentLink", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input value={editedPlans.pro.description ?? ""} onChange={(e) => handlePlanEdit("pro", "description", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Benefícios</Label>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background
                      placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                      value={editedPlans.pro.features?.join("\n") ?? ""}
                      onChange={(e) => handleFeaturesEdit("pro", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {plans && plans.pro.active && (
                <div className="col-span-1 md:col-span-3 text-xs text-zinc-500 italic text-center">
                  👑 O Plano Pro oferece benefícios exclusivos. Certifique-se de configurar corretamente o link de pagamento.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Genérico de Feedback (Sucesso/Erro) */}
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
            <Button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} className="w-full rounded-xl">Entendido</Button>
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
            <Button variant="ghost" onClick={() => setShowNormalizeConfirm(false)}>Cancelar</Button>
            <Button onClick={confirmNormalizeDB} className="bg-amber-600 hover:bg-amber-700 text-white">Iniciar Normalização</Button>
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
            <Button variant="ghost" onClick={() => setUserToRestore(null)}>Cancelar</Button>
            <Button onClick={confirmRestoreUser} className="bg-orange-600 hover:bg-orange-700 text-white">Confirmar Restauração</Button>
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
            <Button onClick={() => setUserToReset(null)} variant="ghost">Cancelar</Button>
            <Button onClick={confirmResetData} variant="destructive">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Excluir Usuário?</DialogTitle>
            <DialogDescription>Confirme para remover permanentemente (Soft Delete).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToDelete(null)} variant="ghost">Cancelar</Button>
            <Button onClick={confirmDeleteUser} variant="destructive">Confirmar</Button>
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
            <DialogTitle className="text-center text-xl">Usuário Inativado</DialogTitle>
            <DialogDescription className="text-center">
              A conta foi marcada como <strong>deletada</strong> e o acesso revogado.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl space-y-2 border border-zinc-100 dark:border-zinc-800">
            <p className="text-sm"><strong>Nome:</strong> {deletedUserData?.name}</p>
            <p className="text-sm"><strong>E-mail:</strong> {deletedUserData?.email}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeletedUserData(null)} className="w-full rounded-xl">Entendido</Button>
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
            <Button variant="ghost" onClick={cancelReactivateUser}>Manter Bloqueado</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmReactivateUser}>Sim, Reativar</Button>
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
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{blockReasonOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {selectedReason === "Outros" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Descreva</Label>
                <textarea className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelBlockUser}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmBlockUser}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}