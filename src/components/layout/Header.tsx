"use client";

import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function Header() {
  const { user, userProfile, logout } = useAuth();

  // Considera logado se houver usuário OU se o perfil já foi carregado (caso de usuário inativo/bloqueado)
  const isAuthenticated = !!user || !!userProfile;

  // SE NÃO TIVER USUÁRIO LOGADO, MOSTRA O HEADER DA LANDING PAGE
  if (!isAuthenticated) {
    return (
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 dark:bg-black/50 dark:border-white/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-200 dark:shadow-[0_0_15px_rgba(124,58,237,0.5)]">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <Link href="/" className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Weven<span className="text-violet-600">Finance</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="rounded-full font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 font-medium px-6 shadow-xl shadow-zinc-200 hover:shadow-2xl transition-all hover:scale-105 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // SE ESTIVER LOGADO (OU BLOQUEADO), MOSTRA O HEADER DO DASHBOARD
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 backdrop-blur-xl px-4 md:px-8 h-16 flex items-center justify-between dark:bg-zinc-950/80 supports-backdrop-filter:bg-white/60">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="bg-linear-to-tr from-violet-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-violet-500/20">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-zinc-800 dark:text-zinc-100">
            Weven<span className="text-violet-600">Finance</span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Botão Admin (Só aparece se for admin) */}
        {userProfile?.role === 'admin' && (
          <Link href="/admin">
            <Button variant="outline" size="sm" className="hidden md:flex gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              <ShieldAlert className="h-4 w-4" /> Painel Admin
            </Button>
          </Link>
        )}

        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-100">
            {/* Usa o displayName do perfil se o objeto user não estiver disponível */}
            {user?.displayName || userProfile?.displayName || "Usuário"}
          </p>
          <div className="flex justify-end mt-1">
             <Badge variant="secondary" className={`text-[10px] uppercase border ${
               userProfile?.plan === 'pro' || userProfile?.plan === 'premium' 
               ? 'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400' 
               : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
             }`}>
               {userProfile?.plan || "Free"}
             </Badge>
          </div>
        </div>
        
        <Link href="/settings">
          <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-white dark:border-zinc-800 shadow-sm ring-2 ring-transparent hover:ring-violet-200 transition-all cursor-pointer">
            <AvatarImage src={user?.photoURL || userProfile?.photoURL || ""} />
            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600">
              {(user?.displayName || userProfile?.displayName || "U").charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <Button variant="ghost" size="icon" onClick={logout} className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  );
}