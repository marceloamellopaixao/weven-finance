"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAllUsers, updateUserStatus, updateUserPlan } from "@/services/userService";
import { UserProfile, UserStatus, UserPlan } from "@/types/user";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, UserX, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

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
    // Tipagem segura: convertemos a string para o tipo UserStatus
    const status = newStatus as UserStatus;
    await updateUserStatus(uid, status);
    setUsers(users.map(u => u.uid === uid ? { ...u, status } : u));
  };

  const handlePlanChange = async (uid: string, newPlan: string) => {
    // Tipagem segura: convertemos a string para o tipo UserPlan
    const plan = newPlan as UserPlan;
    await updateUserPlan(uid, plan);
    setUsers(users.map(u => u.uid === uid ? { ...u, plan } : u));
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
          <p className="text-zinc-500">Gerencie o acesso e planos dos seus clientes.</p>
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
                  <TableHead>Status Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingData ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell></TableRow>
                ) : filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select 
                        defaultValue={user.plan} 
                        onValueChange={(val) => handlePlanChange(user.uid, val)}
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
                        <Badge variant={user.status === 'active' ? 'default' : 'destructive'} className={user.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                          {user.status === 'active' ? 'Ativo' : 'Bloqueado'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.status === 'active' ? (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="h-8 text-xs"
                          onClick={() => handleStatusChange(user.uid, 'inactive')}
                        >
                          <UserX className="h-3 w-3 mr-1" /> Bloquear
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleStatusChange(user.uid, 'active')}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Liberar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}