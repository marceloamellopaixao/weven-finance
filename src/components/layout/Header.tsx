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
import { Wallet, LogOut, ShieldAlert, LayoutDashboard, Settings, Home, UserCog, CreditCard, PiggyBank, Grid2X2 } from "lucide-react";
import Link from "next/link";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNotifications } from "@/hooks/useNotifications";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FLOW_ROUTES = new Set(["/login", "/register", "/forgot-password", "/first-access", "/verify-email", "/goodbye", "/blocked"]);

export function Header() {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isImpersonating, impersonationTargetUid, stopImpersonation } = useImpersonation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { items: notifications, unreadCount, markOneAsRead, markAllAsRead, clearAll } = useNotifications(isNotificationsOpen);
  const { status: onboardingStatus, completeStep, activeStep: onboardingActiveStep, isActive: isOnboardingActive } = useOnboarding();
  const { forceAccountMenuOpen, isPlatformTourActive } = usePlatformExperience();
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
  const isFlowRoute = FLOW_ROUTES.has(pathname || "") || (pathname || "").startsWith("/billing");

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
    setIsAccountMenuOpen(open);
    if (!open || onboardingStatus.steps.profileMenu) return;
    void completeStep("profileMenu");
  };

  useEffect(() => {
    setIsAccountMenuOpen(forceAccountMenuOpen);
  }, [forceAccountMenuOpen]);

  // Se não tiver usuário logado, mostra o header da landing page.
  if (!isAuthenticated) {
    return (
      <nav className={`${isFlowRoute ? "sticky" : "fixed"} top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md transition-all duration-300`}>
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              Weven<span className="text-primary">Finance</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="rounded-full font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full bg-primary px-5 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-xl sm:px-6">
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
    <nav className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl transition-all duration-300 md:px-8">
      <div className="flex items-center gap-3">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
          <span className="hidden text-xl font-bold tracking-tight text-foreground md:block">
            Weven<span className="text-primary">Finance</span>
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

        <DropdownMenu
          onOpenChange={(open) => {
            if (isPlatformTourActive) return;
            setIsNotificationsOpen(open);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-full border-[color:var(--app-panel-border)] bg-card/50" disabled={isPlatformTourActive}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] px-1 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="app-panel-soft w-[calc(100vw-2rem)] max-w-80 rounded-xl border-[color:var(--app-panel-border)] p-2 shadow-xl shadow-primary/10">
            <div className="flex items-center justify-between px-2 py-1">
              <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="text-[11px] text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
              >
                Limpar
              </button>
            </div>
            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">Sem notificações.</div>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className={`cursor-pointer rounded-lg flex-col items-start gap-1 ${item.isRead ? "opacity-70" : ""}`}
                  onClick={() => void handleNotificationClick(item.id, item.href)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {!item.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    <p className="text-xs font-semibold truncate">{item.title}</p>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.message}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Informações do Usuário (Desktop) */}
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold leading-none text-foreground">
            {displayName}
          </p>
          <div className="flex justify-end mt-1">
            <Badge
              variant="secondary"
              className={`text-[10px] uppercase border h-5 px-1.5 ${userProfile?.plan === "pro" || userProfile?.plan === "premium"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
                }`}
            >
              {userProfile?.plan || "Free"}
            </Badge>
          </div>
        </div>

        {/* Dropdown Menu do Usuário */}
        <DropdownMenu open={isAccountMenuOpen} onOpenChange={handleAccountMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <div id="tour-account-avatar" className="relative">
              <Avatar className={`h-9 w-9 cursor-pointer border-2 border-background shadow-sm ring-2 transition-all hover:ring-ring/35 md:h-10 md:w-10 ${
                isOnboardingActive && onboardingActiveStep === "profileMenu"
                  ? "ring-ring/70 animate-pulse"
                  : "ring-transparent"
              }`}>
                <AvatarImage src={displayPhoto} />
                <AvatarFallback className="bg-muted font-bold text-muted-foreground">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent id="tour-account-menu-panel" align="end" className="app-panel-soft w-[calc(100vw-2rem)] max-w-56 rounded-xl border-[color:var(--app-panel-border)] p-2 shadow-xl shadow-primary/10">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{displayName || "Minha Conta"}</p>
                <p className="truncate text-xs leading-none text-muted-foreground">{displayEmail}</p>
                {isOnboardingActive && onboardingActiveStep === "profileMenu" && (
                  <p className="text-[11px] font-medium text-primary">Abra este menu para concluir a etapa atual.</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <Link href="/" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <Home className="mr-2 h-4 w-4" />
                <span>Início</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/dashboard" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/cards" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Cartões</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/piggy-bank" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <PiggyBank className="mr-2 h-4 w-4" />
                <span>Porquinho</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/settings" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
            </Link>

            <Link href="/apps" className="cursor-pointer">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <Grid2X2 className="mr-2 h-4 w-4" />
                <span>Apps / Barra Rápida</span>
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
                        : "text-muted-foreground focus:bg-accent focus:text-foreground"
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


