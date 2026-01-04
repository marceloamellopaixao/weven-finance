"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  getAllUsers, 
  updateUserStatus, 
  updateUserPlan, 
  resetUserFinancialData, 
  deleteUserPermanently 
} from "@/services/userService";
import { UserProfile, UserStatus, UserPlan } from "@/types/user";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  ShieldAlert, UserX, CheckCircle2, Search, MoreVertical, 
  Trash2, RefreshCcw, FileWarning 
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Estados para Modais de Confirmação
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Proteção de Rota
  useEffect(() => {
    if (!loading) {
      if (userProfile?.role !== 'admin') {
        router.push("/");
      } else {
        loadUsers();
      }
    }
  }, [userProfile, loading, router]);

  const loadUsers = async () => {
    setIsLoadingData(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Erro ao carregar usuários", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleStatusChange = async (uid: string, newStatus: string) => {
    const status = newStatus as UserStatus;
    await updateUserStatus(uid, status);
    setUsers(users.map(u => u.uid === uid ? { ...u, status } : u));
  };

  const handlePlanChange = async (uid: string, newPlan: string) => {
    const plan = newPlan as UserPlan;
    await updateUserPlan(uid, plan);
    setUsers(users.map(u => u.uid === uid ? { ...u, plan } : u));
  };

  // Ação: Resetar Dados
  const confirmResetData = async () => {
    if (!userToReset) return;
    try {
      await resetUserFinancialData(userToReset.uid);
      alert(`Dados financeiros de ${userToReset.displayName} foram apagados.`);
    } catch (error) {
      console.error(error);
      alert("Erro ao resetar dados.");
    } finally {
      setUserToReset(null);
    }
  };

  // Ação: Excluir Usuário
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUserPermanently(userToDelete.uid);
      // Remove da lista local
      setUsers(users.filter(u => u.uid !== userToDelete.uid));
      alert(`Usuário ${userToDelete.displayName} removido do sistema.`);
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir usuário.");
    } finally {
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || userProfile?.role !== 'admin') return null;

  return (
    <div className="container mx-auto p-8 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-600" />
            Painel Administrativo
          </h1>
          <p className="text-zinc-500">Gerencie o acesso, planos e dados dos seus clientes.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Buscar por nome ou email..." 
            className="pl-9 bg-white dark:bg-zinc-900"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900">
        <CardHeader>
          <CardTitle>Base de Usuários ({users.length})</CardTitle>
          <CardDescription>Lista completa de clientes cadastrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead>Plano Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingData ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell></TableRow>
                ) : filteredUsers.map((userRow) => (
                  <TableRow key={userRow.uid}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{userRow.displayName}</p>
                        <p className="text-xs text-zinc-500">{userRow.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-xs">
                      {new Date(userRow.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select 
                        defaultValue={userRow.plan} 
                        onValueChange={(val) => handlePlanChange(userRow.uid, val)}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs border-zinc-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro 👑</SelectItem>
                          <SelectItem value="premium">Premium 💎</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={userRow.status === 'active' ? 'default' : 'destructive'} className={userRow.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                          {userRow.status === 'active' ? 'Ativo' : 'Bloqueado'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Botão Rápido de Status */}
                        {userRow.status === 'active' ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-zinc-400 hover:text-red-500"
                            title="Bloquear Acesso"
                            onClick={() => handleStatusChange(userRow.uid, 'inactive')}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                            title="Liberar Acesso"
                            onClick={() => handleStatusChange(userRow.uid, 'active')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Menu de Ações Avançadas */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Opções Avançadas</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-amber-600 focus:text-amber-700 cursor-pointer"
                              onClick={() => setUserToReset(userRow)}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" /> Resetar Financeiro
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-700 cursor-pointer"
                              onClick={() => setUserToDelete(userRow)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir Cadastro
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

      {/* --- MODAIS DE CONFIRMAÇÃO --- */}

      {/* Modal Resetar Dados */}
      <Dialog open={!!userToReset} onOpenChange={(open) => !open && setUserToReset(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RefreshCcw className="h-5 w-5" />
              Resetar Dados Financeiros
            </DialogTitle>
            <DialogDescription className="pt-2">
              Você está prestes a apagar <strong>TODAS</strong> as transações, receitas e despesas de:
              <br/>
              <span className="font-bold text-foreground block mt-1">{userToReset?.displayName}</span>
              <br/>
              Essa ação não pode ser desfeita. O usuário manterá o plano e o acesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserToReset(null)}>Cancelar</Button>
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={confirmResetData}>
              Confirmar Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Usuário */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <FileWarning className="h-5 w-5" />
              Excluir Usuário Definitivamente
            </DialogTitle>
            <DialogDescription className="pt-2">
              Isso apagará o cadastro e todos os dados de:
              <br/>
              <span className="font-bold text-foreground block mt-1">{userToDelete?.displayName}</span>
              <br/>
              O usuário perderá o acesso imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}