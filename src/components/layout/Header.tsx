"use client";

import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function Header() {
  const { user, userProfile, logout } = useAuth();

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
            {user?.displayName || "Usuário"}
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
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600">
              {user?.displayName?.charAt(0) || "U"}
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