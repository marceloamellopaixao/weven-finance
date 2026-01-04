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
import { 
  User, Lock, CreditCard, ShieldCheck, 
  LogOut, Wallet, Crown, CheckCircle2, AlertTriangle, EyeOff
} from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [activeTab, setActiveTab] = useState("account");

  // Simulação de Plano Atual
  const currentPlan = "Pro"; 

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Configurações</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Gerencie sua conta, privacidade e assinatura.</p>
          </div>
          <Button variant="destructive" onClick={logout} className="gap-2 rounded-xl">
            <LogOut className="h-4 w-4" /> Sair da Conta
          </Button>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 h-auto grid grid-cols-3 w-full md:w-[450px]">
            <button
              onClick={() => setActiveTab("account")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === "account" 
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
            >
              <User className="h-4 w-4" /> Geral
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === "billing" 
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
            >
              <CreditCard className="h-4 w-4" /> Planos
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === "security" 
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
            >
              <ShieldCheck className="h-4 w-4" /> Privacidade
            </button>
          </div>

          {/* ABA GERAL */}
          {activeTab === "account" && (
            <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-violet-500" /> Perfil do Usuário
                </CardTitle>
                <CardDescription>Suas informações pessoais visíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-4 border-zinc-50 dark:border-zinc-800 shadow-md">
                    <AvatarImage src={user?.photoURL || ""} />
                    <AvatarFallback className="text-xl">U</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{user?.displayName || "Usuário Weven"}</h3>
                    <p className="text-sm text-zinc-500">{user?.email}</p>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200">
                        Membro {currentPlan}
                      </Badge>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Verificado
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input defaultValue={user?.displayName || ""} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input defaultValue={user?.email || ""} disabled className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 opacity-70" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">Salvar Alterações</Button>
              </CardFooter>
            </Card>
          )}

          {/* ABA PLANOS & FATURAMENTO */}
          {activeTab === "billing" && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-linear-to-br from-violet-600 to-indigo-700 text-white rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Crown className="h-6 w-6 text-yellow-300 fill-yellow-300" />
                        Weven {currentPlan}
                      </CardTitle>
                      <CardDescription className="text-violet-100">
                        Sua assinatura renova em 15/02/2026.
                      </CardDescription>
                    </div>
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-none flex gap-1 items-center">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold">R$ 19,90</span>
                    <span className="text-violet-200 mb-1">/mês</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" className="w-full sm:w-auto rounded-xl bg-white text-violet-700 hover:bg-violet-50">Gerenciar Assinatura</Button>
                </CardFooter>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                 <Card className="border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-2xl">
                   <CardHeader>
                     <CardTitle className="text-base flex items-center gap-2">
                       <Wallet className="h-4 w-4 text-zinc-500" />
                       Histórico de Pagamentos
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-sm text-zinc-500">Nenhuma fatura pendente.</div>
                   </CardContent>
                 </Card>
                 
                 <Card className="border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-2xl">
                   <CardHeader>
                     <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-zinc-500" />
                        Método de Pagamento
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-sm text-zinc-500">Mastercard final 8842</div>
                   </CardContent>
                 </Card>
              </div>
            </div>
          )}

          {/* ABA PRIVACIDADE E SEGURANÇA */}
          {activeTab === "security" && (
            <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Privacidade de Dados
                </CardTitle>
                <CardDescription>
                  Controle como seus dados são exibidos e armazenados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Toggle de Privacidade Visual */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4 text-zinc-500" />
                      <Label className="text-base">Modo Discreto</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Oculta valores na tela inicial para maior privacidade em locais públicos.</p>
                  </div>
                  <Switch checked={isPrivacyMode} onCheckedChange={setIsPrivacyMode} />
                </div>

                {/* Área de Criptografia */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-500" />
                    <h3 className="font-medium text-sm">Criptografia Ponta-a-Ponta (E2EE)</h3>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900 text-zinc-400 font-mono text-xs break-all relative border border-zinc-800">
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-emerald-500">ATIVO</Badge>
                    </div>
                    <p className="mb-2 text-zinc-500 uppercase tracking-widest text-[10px]">Sua Chave Pública (Simulação)</p>
                    0x4f9a2b3c8d7e6f5a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
                  </div>
                  <p className="text-xs text-zinc-500">
                    * Seus dados sensíveis são criptografados antes de sair do seu dispositivo. Nem mesmo os desenvolvedores da Weven Finance possuem acesso aos valores das suas transações.
                  </p>
                </div>

                <Separator />

                <div className="pt-2">
                  <h3 className="text-red-600 font-medium text-sm flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" /> Zona de Perigo
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">A exclusão da conta é irreversível e removerá todos os seus dados criptografados.</p>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 w-full sm:w-auto rounded-xl">
                    Solicitar Exclusão de Dados
                  </Button>
                </div>

              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}