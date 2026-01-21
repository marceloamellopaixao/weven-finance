"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  children: ReactNode;
}

/**
 * Rotas permitidas quando o usuário está bloqueado.
 * Ajuste aqui conforme sua estrutura.
 */
const ALLOWED_WHEN_BLOCKED = ["/blocked", "/settings"];

export function BlockedGuard({ children }: Props) {
  const { userProfile, loading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Se não estiver logado, não aplica regra de bloqueio aqui
    if (!user) return;

    if (userProfile?.status === "inactive") {
      const allowed = ALLOWED_WHEN_BLOCKED.some((p) => pathname.startsWith(p));
      if (!allowed) {
        router.replace("/blocked");
      }
    }
  }, [loading, user, userProfile, pathname, router]);

  // Evita flash de tela antes do estado estar pronto
  if (loading) return null;

  return <>{children}</>;
}
