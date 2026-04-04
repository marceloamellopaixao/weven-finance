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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, ShieldAlert, LayoutDashboard, Settings, Home, UserCog, CreditCard, PiggyBank } from "lucide-react";
import Link from "next/link";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNotifications } from "@/hooks/useNotifications";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function Header() {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isImpersonating, impersonationTargetUid, stopImpersonation } = useImpersonation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { items: notifications, unreadCount, markOneAsRead, markAllAsRead, clearAll } = useNotifications(isNotificationsOpen);
  const { status: onboardingStatus, completeStep } = useOnboarding();
  const isAuthenticated = !!user || !!userProfile;
  const displayName = isImpersonating
    ? (userProfile?.displayName || "Usuário")
    : (userProfile?.displayName || user?.displayName || "Usuário");
  const displayEmail = isImpersonating
    ? (userProfile?.email || impersonationTargetUid || "")
    : (userProfile?.email || user?.email || "");
  const displayPhoto = isImpersonating
    ? (userProfile?.photoURL || "")
    : (userProfile?.photoURL || user?.photoURL || "");

  const handleStopImpersonation = () => {
    stopImpersonation();
    window.location.href = "/admin";
  };

  const resolveNotificationHref = (href: string | null) => {
    if (!href) return null;
    let value = href.trim();
    if (!value) return null;

    if (value.startsWith("http://") || value.startsWith("https://")) {
      try {
        const parsed = new URL(value);
        if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
          value = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } else {
          return value;
        }
      } catch {
        return null;
      }
    }

    if (value.startsWith("?")) {
      value = `${pathname}${value}`;
    }
    if (!value.startsWith("/")) {
      value = `/${value.replace(/^\/+/, "")}`;
    }

    const role = userProfile?.role;
    const isStaff = role === "admin" || role === "moderator" || role === "support";
    if (value.startsWith("/admin") && !isStaff) return "/dashboard";
    if (value.startsWith("/settings") && !user) return "/login";
    return value;
  };

  const handleNotificationClick = async (id: string, href: string | null) => {
    try {
      await markOneAsRead(id);
    } finally {
      const target = resolveNotificationHref(href);
      if (!target) return;
      if (target.startsWith("http://") || target.startsWith("https://")) {
        window.location.assign(target);
        return;
      }
      router.push(target);
    }
  };

  const handleAccountMenuOpenChange = (open: boolean) => {
    if (!open || onboardingStatus.steps.profileMenu) return;
    void completeStep("profileMenu");
  };

  // Se não tiver usuário logado, mostra o header da landing page.
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

  // Se estiver logado (ou bloqueado), mostra o header da aplicação.
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
        {isImpersonating && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden h-9 w-9 rounded-full border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:cursor-pointer"
              onClick={handleStopImpersonation}
              title="Encerrar impersonação"
            >
              <UserCog className="h-4 w-4" />
            </Button>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              <UserCog className="h-3.5 w-3.5" />
              <span>Impersonando {displayEmail || impersonationTargetUid}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-amber-700 hover:bg-amber-100 hover:cursor-pointer"
                onClick={handleStopImpersonation}
              >
                Encerrar
              </Button>
            </div>
          </>
        )}

        <DropdownMenu onOpenChange={setIsNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-full border-zinc-200 dark:border-zinc-800">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] px-1 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 rounded-xl p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="text-[11px] text-violet-600 hover:underline"
              >
                Marcar todas como lidas
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                className="text-[11px] text-zinc-500 hover:underline"
              >
                Limpar
              </button>
            </div>
            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-zinc-500">Sem notificações no momento.</div>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className={`cursor-pointer rounded-lg flex-col items-start gap-1 ${item.isRead ? "opacity-70" : ""}`}
                  onClick={() => void handleNotificationClick(item.id, item.href)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!item.isRead && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                    <p className="text-xs font-semibold truncate">{item.title}</p>
                  </div>
                  <p className="text-[11px] text-zinc-500 line-clamp-2">{item.message}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Informações do Usuário (Desktop) */}
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold leading-none text-zinc-900 dark:text-zinc-100">
            {displayName}
          </p>
          <div className="flex justify-end mt-1">
            <Badge
              variant="secondary"
              className={`text-[10px] uppercase border h-5 px-1.5 ${userProfile?.plan === "pro" || userProfile?.plan === "premium"
                ? "bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
            >
              {userProfile?.plan || "Free"}
            </Badge>
          </div>
        </div>

        {/* Dropdown Menu do Usuário */}
        <DropdownMenu onOpenChange={handleAccountMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <div className="relative">
              <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-white dark:border-zinc-800 shadow-sm ring-2 ring-transparent transition-all cursor-pointer hover:ring-violet-200">
                <AvatarImage src={displayPhoto} />
                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 font-bold">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-zinc-200 dark:border-zinc-800 p-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{displayName || "Minha Conta"}</p>
                <p className="text-xs leading-none text-zinc-500 truncate">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <Link href="/" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <Home className="mr-2 h-4 w-4" />
                <span>Início</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/dashboard" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/cards" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Cartões</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/piggy-bank" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <PiggyBank className="mr-2 h-4 w-4" />
                <span>Porquinho</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/settings" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-zinc-100 dark:focus:bg-zinc-800">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
            </Link>

            {(userProfile?.role === "admin" || userProfile?.role === "moderator" || userProfile?.role === "support") && (
              <>
                <DropdownMenuSeparator />
                <Link href="/admin" className="cursor-pointer">
                  <DropdownMenuItem
                    className={`cursor-pointer rounded-lg font-medium ${userProfile.role === "admin"
                      ? "text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/10"
                      : userProfile.role === "moderator"
                        ? "text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-900/10"
                        : "text-zinc-600 focus:text-zinc-700 focus:bg-zinc-100 dark:focus:bg-zinc-800"
                      }`}
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    <span>Painel {userProfile.role === "admin" ? "Admin" : userProfile.role === "moderator" ? "Moderador" : "Funcionário"}</span>
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


