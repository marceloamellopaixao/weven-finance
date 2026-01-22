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
  deleteUserPermanently,
  updateUserPaymentStatus,
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
} from "lucide-react";

type UserWithCount = UserProfile & { transactionCount?: number };

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const { plans } = usePlans();
  const router = useRouter();

  // UI
  const [activeTab, setActiveTab] = useState<"users" | "plans">("users");

  // Users
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Block with reason
  const [userToBlock, setUserToBlock] = useState<UserProfile | null>(null);
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

  // --- Counts: attach counts after users arrive ---
  const attachCounts = useCallback(async (list: UserProfile[]) => {
    const withCounts = await Promise.all(
      list.map(async (u) => {
        try {
          const count = await getUserTransactionCount(u.uid);
          return { ...u, transactionCount: count } as UserWithCount;
        } catch {
          return { ...u, transactionCount: 0 } as UserWithCount;
        }
      })
    );
    setUsers(withCounts);
  }, []);

  // --- Users realtime subscription ---
  useEffect(() => {
    if (loading) return;
    if (!userProfile) return;

    if (userProfile.role !== "admin" && userProfile.role !== "moderator") return;

    setIsLoadingUsers(true);

    const unsubscribe = subscribeToAllUsers(
      (list) => {
        // lista básica do realtime (sem contagem)
        // evita travar UI com await dentro do onSnapshot
        attachCounts(list).finally(() => setIsLoadingUsers(false));
      },
      () => {
        setUsers([]);
        setIsLoadingUsers(false);
      }
    );

    return () => unsubscribe();
  }, [loading, userProfile, attachCounts]);

  // --- User handlers ---
  const handleStatusChange = async (uid: string, newStatus: string) => {
    const status = newStatus as UserStatus;
    if (status === "inactive") {
      const u = users.find((x) => x.uid === uid);
      if (u) {
        setUserToBlock(u);
        setSelectedReason("");
        setCustomReason("");
      }
      return;
    }
    await updateUserStatus(uid, status);
    // não precisa setUsers aqui — realtime atualiza sozinho
  };

  const confirmBlockUser = async () => {
    if (!userToBlock) return;
    const finalReason = selectedReason === "Outros" ? customReason : selectedReason;
    if (!finalReason) {
      alert("Por favor, informe um motivo para o bloqueio.");
      return;
    }
    await updateUserStatus(userToBlock.uid, "inactive", finalReason);
    setUserToBlock(null);
    setSelectedReason("");
    setCustomReason("");
    // realtime reflete
  };

  const handlePlanChange = async (uid: string, newPlan: string) => {
    await updateUserPlan(uid, newPlan as UserPlan);
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    await updateUserRole(uid, newRole as UserRole);
  };

  const handlePaymentStatusChange = async (uid: string, newStatus: string) => {
    await updateUserPaymentStatus(uid, newStatus as UserPaymentStatus);
  };

  const confirmResetData = async () => {
    if (!userToReset) return;
    await resetUserFinancialData(userToReset.uid);
    setUserToReset(null);
    alert("Dados resetados.");
    // contagem pode ficar desatualizada até o próximo attachCounts;
    // aqui forçamos recálculo só do usuário afetado:
    try {
      const count = await getUserTransactionCount(userToReset.uid);
      setUsers((prev) =>
        prev.map((u) => (u.uid === userToReset.uid ? { ...u, transactionCount: count } : u))
      );
    } catch {}
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    await deleteUserPermanently(userToDelete.uid);
    setUserToDelete(null);
    alert("Usuário excluído.");
    // realtime remove da lista automaticamente
  };

  // --- Plan handlers ---
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
      alert("Configurações salvas com sucesso!");
      // usePlans (realtime) atualiza automaticamente em todo o app
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setIsSavingPlans(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        (u.displayName?.toLowerCase() || "").includes(term) ||
        (u.email?.toLowerCase() || "").includes(term)
    );
  }, [users, searchTerm]);

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
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit grid grid-cols-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all ${
              activeTab === "users"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            }`}
          >
            <UserIcon className="h-4 w-4" /> Gerenciar Usuários
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all ${
              activeTab === "plans"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            }`}
          >
            <CreditCard className="h-4 w-4" /> Gerenciar Planos
          </button>
        </div>

        {/* --- USERS --- */}
        {activeTab === "users" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="relative w-full md:w-72 mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Buscar usuário..."
                className="pl-9 bg-white dark:bg-zinc-900 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                      ) : filteredUsers.map((u) => (
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
                            <Select defaultValue={u.plan} onValueChange={(val) => handlePlanChange(u.uid, val)}>
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
                            <Select defaultValue={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
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
                            <Select defaultValue={u.paymentStatus} onValueChange={(val) => handlePaymentStatusChange(u.uid, val)}>
                              <SelectTrigger className="w-[110px] h-8 text-xs border-zinc-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paid">Pago</SelectItem>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="overdue">Atrasado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={u.status === "active" ? "default" : "destructive"}
                              className={u.status === "active" ? "bg-emerald-500" : ""}
                            >
                              {u.status === "active" ? "Ativo" : "Bloqueado"}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end items-center gap-2">
                              {u.status === "active" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
                                  onClick={() => handleStatusChange(u.uid, "inactive")}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-500"
                                  onClick={() => handleStatusChange(u.uid, "active")}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {userProfile?.role === "admin" && (
                                    <DropdownMenuItem onClick={() => window.open(`/api/impersonate?uid=${u.uid}`, "_blank")}>
                                      <UserIcon className="mr-2 h-4 w-4" /> Impersonar
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setUserToReset(u)}>
                                    <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Dados
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setUserToDelete(u)} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir Conta
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- PLANS --- */}
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

      {/* Modals */}
      <Dialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <DialogContent>
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

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário?</DialogTitle>
            <DialogDescription>Confirme para remover permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setUserToDelete(null)} variant="ghost">Cancelar</Button>
            <Button onClick={confirmDeleteUser} variant="destructive">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToBlock} onOpenChange={(open) => !open && setUserToBlock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Usuário</DialogTitle>
            <DialogDescription>Você está suspendendo o acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select onValueChange={setSelectedReason} value={selectedReason}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {blockReasonOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReason === "Outros" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Descreva</Label>
                <textarea
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserToBlock(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmBlockUser}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
