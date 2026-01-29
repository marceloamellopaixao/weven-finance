"use client";

import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, ShieldAlert, LayoutDashboard, Settings, Home } from "lucide-react";
import Link from "next/link";

export function Header() {
  const { user, userProfile, logout } = useAuth();

  // Considera logado se houver usuário OU se o perfil já foi carregado
  const isAuthenticated = !!user || !!userProfile;

  // SE NÃO TIVER USUÁRIO LOGADO, MOSTRA O HEADER DA LANDING PAGE
  if (!isAuthenticated) {
    return (
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 dark:bg-zinc-950/80 dark:border-zinc-800 transition-all duration-300">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-200 dark:shadow-violet-900/20 group-hover:scale-105 transition-transform">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Weven<span className="text-violet-600">Finance</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="rounded-full font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 font-medium px-6 shadow-lg shadow-zinc-200/50 hover:shadow-xl transition-all hover:scale-105 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // SE ESTIVER LOGADO (OU BLOQUEADO), MOSTRA O HEADER DA APLICAÇÃO
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 backdrop-blur-xl px-4 md:px-8 h-16 flex items-center justify-between dark:bg-zinc-950/80 transition-all duration-300">
      <div className="flex items-center gap-3">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="bg-linear-to-tr from-violet-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-violet-500/20">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-zinc-800 dark:text-zinc-100 hidden md:block">
            Weven<span className="text-violet-600">Finance</span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">

        {/* Informações do Usuário (Desktop) */}
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-100">
            {user?.displayName || userProfile?.displayName || "Usuário"}
          </p>
          <div className="flex justify-end mt-1">
            <Badge variant="secondary" className={`text-[10px] uppercase border h-5 px-1.5 ${userProfile?.plan === 'pro' || userProfile?.plan === 'premium'
                ? 'bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
              {userProfile?.plan || "Free"}
            </Badge>
          </div>
        </div>

        {/* Dropdown Menu do Usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-white dark:border-zinc-800 shadow-sm ring-2 ring-transparent hover:ring-violet-200 transition-all cursor-pointer">
              <AvatarImage src={user?.photoURL || userProfile?.photoURL || ""} />
              <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 font-bold">
                {(user?.displayName || userProfile?.displayName || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-zinc-200 dark:border-zinc-800 p-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{user?.displayName || "Minha Conta"}</p>
                <p className="text-xs leading-none text-zinc-500 truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <Link href="/" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <Home className="mr-2 h-4 w-4" />
                <span>Inicio</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/dashboard" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/settings" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
            </Link>

            {/* Item Condicional de Admin */}
            {(userProfile?.role === 'admin' || userProfile?.role === 'moderator') && (
              <>
                <DropdownMenuSeparator />
                <Link href="/admin" className="cursor-pointer">
                  <DropdownMenuItem className={`cursor-pointer rounded-lg font-medium ${userProfile.role === 'admin'
                      ? "text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/10"
                      : "text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-900/10"
                    }`}>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    <span>Painel {userProfile.role === 'admin' ? 'Admin' : 'Moderador'}</span>
                  </DropdownMenuItem>
                </Link>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 rounded-lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair da Conta</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}