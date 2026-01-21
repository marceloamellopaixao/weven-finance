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
  CheckCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { updateOwnProfile, deleteUserPermanently } from "@/services/userService";
import { getKeyFingerprint } from "@/lib/crypto";
import Link from "next/link";
import { usePlans } from "@/hooks/usePlans";
import { migrateCryptography } from "@/services/transactionService";

export default function SettingsPage() {
  const { user, userProfile, logout, privacyMode, togglePrivacyMode } = useAuth();
  const { plans } = usePlans();

  // State de Migração
  const [isMigrating, setIsMigrating] = useState(false);

  // State da Aba Ativa
  const [activeTab, setActiveTab] = useState("account");

  // States do Formulário
  const [displayName, setDisplayName] = useState("");
  const [completeName, setCompleteName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // States de Segurança
  const [keyFingerprint, setKeyFingerprint] = useState("Carregando identificador seguro...");

  // States de Modais
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
      setCompleteName(userProfile.completeName);
      setPhone(userProfile.phone);
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
      await updateOwnProfile(user.uid, { displayName, completeName, phone });
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

  // Handler de Migração
  const handleMigration = async () => {
    if (!user) return;
    setIsMigrating(true);
    try {
      const count = await migrateCryptography(user.uid);
      alert(`Sucesso! ${count} transações foram atualizadas para a nova segurança.`);
    } catch (e) {
      console.error(e);
      alert("Erro na migração.");
    } finally {
      setIsMigrating(false);
    }
  };

  const currentPlan = userProfile?.plan || "free";

  return (
    <div className="font-sans p-4 md:p-8 pb-20">
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
                    <h3 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{displayName || "Usuário"}</h3>
                    <p className="text-sm text-zinc-500 font-medium">{user?.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                      <Badge variant="secondary" className={`uppercase text-[10px] tracking-wider border ${currentPlan === 'free' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300'}`}>Plano {currentPlan}</Badge>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 gap-1"><CheckCircle2 className="h-3 w-3" /> Verificado</Badge>
                    </div>
                  </div>
                </div>
                <Separator className="bg-zinc-100 dark:bg-zinc-800" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Nome de Exibição (Apelido)</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-violet-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Nome Completo</Label>
                    <Input value={completeName} onChange={(e) => setCompleteName(e.target.value)} className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-violet-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">Celular</Label>
                    <Input value={phone ? phone.toString().replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : ""} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-violet-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-500">E-mail de Acesso</Label>
                    <Input defaultValue={user?.email || ""} disabled className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 opacity-70 cursor-not-allowed" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-zinc-50 dark:border-zinc-800/50 pt-6 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-3xl">
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-11 shadow-lg shadow-violet-500/20 transition-all active:scale-95">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* ABA PLANOS */}
          {activeTab === "billing" && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <Card
                className={`border-none shadow-xl rounded-3xl relative overflow-hidden text-white flex flex-col justify-center min-h-[10px]"
                  ${currentPlan === 'free'
                    ? 'bg-linear-to-br from-amber-700 to-amber-900 shadow-amber-700/30'
                    : currentPlan === 'premium'
                      ? 'bg-linear-to-br from-slate-600 to-slate-800 shadow-slate-500/30'
                      : 'bg-linear-to-br from-yellow-500 to-amber-600 shadow-yellow-500/30'
                  }`}
              >
                <div className="absolute top-0 right-0 p-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <CardHeader className="relative z-10 flex-1 flex items-center">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">

                    {/* BLOCO PRINCIPAL */}
                    <div className="space-y-3">
                      <CardTitle className="text-3xl font-bold flex items-center gap-3">
                        {currentPlan === 'free' && <Medal className="h-8 w-8 text-amber-400" />}
                        {currentPlan === 'premium' && <Medal className="h-8 w-8 text-slate-200" />}
                        {currentPlan === 'pro' && <Medal className="h-8 w-8 text-yellow-300" />}
                        <span>
                          Weven{' '}
                          <span className="opacity-90">
                            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                          </span>
                        </span>
                      </CardTitle>

                      <CardDescription className="text-base text-white/75 max-w-md leading-relaxed">
                        {currentPlan === 'free'
                          ? plans.free.description
                          : 'Obrigado por apoiar nosso desenvolvimento!'}
                      </CardDescription>
                    </div>

                    {/* FEATURES */}
                    {plans[currentPlan].features && (
                      <nav className="lg:pt-0">
                        <ul className="space-y-2 text-sm text-white/70">
                          {plans[currentPlan].features.map((feature, index) => (
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
                        {userProfile?.paymentStatus === 'paid' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-300" />
                            Pagamento Confirmado
                          </>
                        )}

                        {userProfile?.paymentStatus === 'pending' && (
                          <>
                            <Clock className="h-4 w-4 text-amber-300" />
                            Pagamento Pendente
                          </>
                        )}

                        {userProfile?.paymentStatus === 'overdue' && (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                            Pagamento Atrasado
                          </>
                        )}
                      </Badge>

                      {/* Plano ativo */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-white/70" />
                        Plano Ativo
                      </Badge>

                      {/* Renovação */}
                      <Badge className="bg-white/10 backdrop-blur-md text-white border-none flex gap-2 items-center px-3 py-1.5 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-white/70" />
                        Renovação Automática
                      </Badge>

                    </div>
                  </div>
                </CardHeader>
                <CardContent className="z-10 relative">{currentPlan === 'free' && (<div className="mt-4"><p className="text-sm text-zinc-300 mb-6">Faça o upgrade para remover limites e desbloquear todo o potencial.</p></div>)}</CardContent>
              </Card>
              {currentPlan !== 'pro' && (
                <div className="grid gap-6 md:grid-cols-2">
                  {currentPlan !== 'premium' && (
                    <Card className="border-2 border-slate-300/40 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all bg-white dark:bg-zinc-900 rounded-3xl group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-slate-400" />
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <Medal className="h-5 w-5 text-slate-500" /> Weven Premium
                          </span>
                          <span className="text-xl font-bold text-zinc-900 dark:text-white">
                            R$ {plans.premium.price.toFixed(2).toString().replace(".", ",")}
                          </span>
                        </CardTitle>
                        <CardDescription>
                          {plans.premium.description}
                        </CardDescription>
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
                      <CardFooter>
                        <Link href={plans.premium.paymentLink} target="_blank" className="w-full">
                          <Button className="w-full rounded-xl bg-slate-600 hover:bg-slate-700 text-white shadow-lg shadow-slate-500/20">
                            Fazer Upgrade Premium
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  )}
                  <Card className="border-2 border-yellow-300/40 dark:border-yellow-700/30 shadow-lg hover:shadow-xl transition-all bg-white dark:bg-zinc-900 rounded-3xl group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <Medal className="h-5 w-5 text-yellow-500" /> Weven Pro
                        </span>
                        <span className="text-xl font-bold text-zinc-900 dark:text-white">
                          R$ {plans.pro.price.toFixed(2).toString().replace(".", ",")}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {plans.pro.description}
                      </CardDescription>
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
                    <CardFooter>
                      <Link href={plans.pro.paymentLink} target="_blank" className="w-full">
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                        >
                          Fazer Upgrade Pro
                        </Button>
                      </Link>
                    </CardFooter>
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
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-violet-500" /><h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Segurança de Dados</h3></div>
                  <div className="p-5 rounded-2xl bg-zinc-950 text-zinc-400 font-mono text-xs break-all relative border border-zinc-800 shadow-inner">
                    <div className="absolute top-3 right-3"><Badge variant="outline" className="text-[10px] border-zinc-700 text-emerald-500 font-bold px-2 py-0.5">E2EE ATIVO</Badge></div>
                    <p className="mb-2 text-zinc-600 uppercase tracking-widest text-[10px] font-bold">Identificador Seguro (Hash)</p>
                    {/* Mostra o Fingerprint Real */}
                    {keyFingerprint}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">* Seus dados sensíveis são criptografados antes de sair do seu dispositivo. Nem mesmo os desenvolvedores da Weven Finance possuem acesso aos valores das suas transações.</p>
                  <Separator className="bg-zinc-300 dark:bg-zinc-800" />

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Manutenção de Dados
                    </h4>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400 mb-4">
                      Se você trocou de dispositivo e seus dados antigos aparecem como &quot;Dados Protegidos&quot; ou códigos estranhos, clique abaixo para tentar recuperá-los usando sua chave antiga e convertê-los para o novo padrão seguro.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleMigration}
                      disabled={isMigrating}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg w-full sm:w-auto"
                    >
                      {isMigrating ? "Migrando..." : "Corrigir/Migrar Criptografia"}
                    </Button>
                  </div>
                </div>
                <Separator className="bg-zinc-300 dark:bg-zinc-800" />
                <div className="space-y-4">
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