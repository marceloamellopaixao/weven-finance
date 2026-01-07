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
  LogOut, Wallet, Crown, CheckCircle2, AlertTriangle, EyeOff, Loader2, Sparkles, Star
} from "lucide-react";
import { useState, useEffect } from "react";
import { updateOwnProfile, deleteUserPermanently } from "@/services/userService";
import { getKeyFingerprint } from "@/lib/crypto"; // Importação nova
import Link from "next/link";

const MERCADO_PAGO_LINKS = {
  pro: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10",
  premium: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e"
};

export default function SettingsPage() {
  const { user, userProfile, logout, privacyMode, togglePrivacyMode } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  // States do Formulário
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // States de Segurança
  const [keyFingerprint, setKeyFingerprint] = useState("Carregando identificador seguro...");

  // States de Modais
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.displayName);
    }
  }, [userProfile]);

  // Carregar Fingerprint real da chave
  useEffect(() => {
    if (user?.uid) {
      getKeyFingerprint(user.uid).then(setKeyFingerprint);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateOwnProfile(user.uid, { displayName: name });
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteUserPermanently(user.uid);
      await logout();
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  };

  const currentPlan = userProfile?.plan || "free";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans p-4 md:p-8 pb-20">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Configurações</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Gerencie sua conta, privacidade e assinatura.</p>
          </div>
          <Button variant="destructive" onClick={logout} className="gap-2 rounded-xl shadow-sm hover:shadow-red-500/20 transition-all">
            <LogOut className="h-4 w-4" /> Sair da Conta
          </Button>
        </div>

        {/* Navegação de Abas Personalizada */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-3 w-full md:w-[480px] shadow-sm">
            <button onClick={() => setActiveTab("account")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${activeTab === "account" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <User className="h-4 w-4" /> Geral
            </button>
            <button onClick={() => setActiveTab("billing")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${activeTab === "billing" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <CreditCard className="h-4 w-4" /> Planos
            </button>
            <button onClick={() => setActiveTab("security")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${activeTab === "security" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
              <ShieldCheck className="h-4 w-4" /> Privacidade
            </button>
          </div>

          {/* ABA GERAL */}
          {activeTab === "account" && (
            <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-3xl animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-full"><User className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div> Perfil do Usuário
                </CardTitle>
                <CardDescription>Suas informações pessoais visíveis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-zinc-50 dark:border-zinc-800 shadow-xl">
                      <AvatarImage src={user?.photoURL || ""} />
                      <AvatarFallback className="text-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 p-1.5 bg-green-500 border-4 border-white dark:border-zinc-900 rounded-full" title="Online"></div>
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{name || "Usuário"}</h3>
                    <p className="text-sm text-zinc-500 font-medium">{user?.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                      <Badge variant="secondary" className={`uppercase text-[10px] tracking-wider border ${currentPlan === 'free' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300'}`}>Plano {currentPlan}</Badge>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 gap-1"><CheckCircle2 className="h-3 w-3" /> Verificado</Badge>
                    </div>
                  </div>
                </div>
                <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2"><Label className="text-zinc-500">Nome de Exibição</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-violet-500" /></div>
                  <div className="space-y-2"><Label className="text-zinc-500">E-mail de Acesso</Label><Input defaultValue={user?.email || ""} disabled className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 opacity-70 cursor-not-allowed" /><p className="text-[10px] text-zinc-400">O e-mail não pode ser alterado por segurança.</p></div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-zinc-50 dark:border-zinc-800/50 pt-6 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-3xl">
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-11 shadow-lg shadow-violet-500/20 transition-all active:scale-95">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alterações"}</Button>
              </CardFooter>
            </Card>
          )}

          {/* ABA PLANOS */}
          {activeTab === "billing" && (
             <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <Card className={`border-none shadow-xl rounded-3xl relative overflow-hidden text-white ${currentPlan === 'free' ? 'bg-zinc-800 dark:bg-zinc-900' : 'bg-linear-to-br from-violet-600 to-indigo-700 shadow-violet-500/20'}`}>
                <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <CardHeader>
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <CardTitle className="text-3xl flex items-center gap-2 font-bold">{currentPlan === 'free' ? <Wallet className="h-8 w-8 text-zinc-400" /> : <Crown className="h-8 w-8 text-yellow-300 fill-yellow-300" />} Weven {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</CardTitle>
                      <CardDescription className={`mt-2 text-lg ${currentPlan === 'free' ? 'text-zinc-400' : 'text-violet-100'}`}>{currentPlan === 'free' ? "Você está utilizando a versão básica." : "Obrigado por apoiar nosso desenvolvimento!"}</CardDescription>
                    </div>
                    <Badge className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border-none flex gap-1.5 items-center px-3 py-1.5 text-sm"><CheckCircle2 className="h-4 w-4" /> Plano Ativo</Badge>
                  </div>
                </CardHeader>
                <CardContent className="z-10 relative">{currentPlan === 'free' && (<div className="mt-4"><p className="text-sm text-zinc-300 mb-6">Faça o upgrade para remover limites e desbloquear todo o potencial.</p></div>)}</CardContent>
              </Card>
              {currentPlan !== 'premium' && (
                <div className="grid gap-6 md:grid-cols-2">
                   {currentPlan !== 'pro' && (
                     <Card className="border-2 border-violet-100 dark:border-violet-900/30 shadow-lg hover:shadow-xl hover:border-violet-300 transition-all bg-white dark:bg-zinc-900 rounded-3xl group cursor-pointer relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-violet-500" />
                       <CardHeader><CardTitle className="flex justify-between items-center"><span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-500" /> Weven Pro</span><span className="text-xl font-bold text-zinc-900 dark:text-white">R$ 19,90</span></CardTitle><CardDescription>Transações ilimitadas + Controle de Streaming.</CardDescription></CardHeader>
                       <CardFooter><Link href={MERCADO_PAGO_LINKS.pro} target="_blank" className="w-full"><Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 group-hover:scale-[1.02] transition-transform">Fazer Upgrade Pro</Button></Link></CardFooter>
                     </Card>
                   )}
                   <Card className="border-2 border-emerald-100 dark:border-emerald-900/30 shadow-lg hover:shadow-xl hover:border-emerald-300 transition-all bg-white dark:bg-zinc-900 rounded-3xl group cursor-pointer relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                     <CardHeader><CardTitle className="flex justify-between items-center"><span className="flex items-center gap-2"><Star className="h-5 w-5 text-emerald-500" /> Weven Premium</span><span className="text-xl font-bold text-zinc-900 dark:text-white">R$ 49,90</span></CardTitle><CardDescription>Tudo do Pro + Criptografia Exclusiva + Suporte VIP.</CardDescription></CardHeader>
                     <CardFooter><Link href={MERCADO_PAGO_LINKS.premium} target="_blank" className="w-full"><Button variant="outline" className="w-full rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 group-hover:scale-[1.02] transition-transform">Fazer Upgrade Premium</Button></Link></CardFooter>
                   </Card>
                </div>
              )}
            </div>
          )}

          {/* ABA SEGURANÇA */}
          {activeTab === "security" && (
            <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-3xl animate-in fade-in zoom-in-95 duration-300">
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
                
                {/* Toggle Privacidade */}
                <div className="flex items-center justify-between p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><EyeOff className="h-5 w-5 text-zinc-600 dark:text-zinc-400" /><Label className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Modo Discreto (Blur)</Label></div>
                    <p className="text-sm text-zinc-500">Oculta valores monetários no Dashboard para privacidade.</p>
                  </div>
                  {/* Usa togglePrivacyMode do hook para persistir globalmente */}
                  <Switch checked={privacyMode} onCheckedChange={togglePrivacyMode} className="data-[state=checked]:bg-violet-600" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-violet-500" /><h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Segurança de Dados</h3></div>
                  <div className="p-5 rounded-2xl bg-zinc-950 text-zinc-400 font-mono text-xs break-all relative border border-zinc-800 shadow-inner">
                    <div className="absolute top-3 right-3"><Badge variant="outline" className="text-[10px] border-zinc-700 text-emerald-500 font-bold px-2 py-0.5">E2EE ATIVO</Badge></div>
                    <p className="mb-2 text-zinc-600 uppercase tracking-widest text-[10px] font-bold">Identificador Seguro (Hash)</p>
                    {/* Mostra o Fingerprint Real */}
                    {keyFingerprint}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">* Seus dados sensíveis são criptografados antes de sair do seu dispositivo. Nem mesmo os desenvolvedores da Weven Finance possuem acesso aos valores das suas transações.</p>
                </div>
                <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                <div className="pt-2">
                  <h3 className="text-red-600 font-bold text-sm flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4" /> Zona de Perigo</h3>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 rounded-2xl">
                    <p className="text-xs text-red-600/80 dark:text-red-400">A exclusão da conta é <strong>irreversível</strong>. Todos os dados serão apagados.</p>
                    <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 dark:hover:bg-red-900/40 dark:border-red-900 whitespace-nowrap rounded-xl">Excluir Minha Conta</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modal de Confirmação de Exclusão */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Tem certeza absoluta?</DialogTitle><DialogDescription className="pt-3">Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-4"><Button variant="outline" onClick={() => setShowDeleteModal(false)} className="rounded-xl h-10 w-full sm:w-auto">Cancelar</Button><Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting} className="rounded-xl h-10 w-full sm:w-auto bg-red-600 hover:bg-red-700">{isDeleting ? "Excluindo..." : "Sim, excluir conta"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}