"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, HelpCircle, Map, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { openSupportReporter } from "@/lib/support/client-events";
import { PLATFORM_TOUR_ROUTE_HREFS } from "@/lib/platform-tour/config";
import { ALL_PLATFORM_TOUR_ROUTES } from "@/types/navigation";

export function QuickActionsMenu() {
  const router = useRouter();
  const { privacyMode, togglePrivacyMode } = useAuth();
  const { resetTour } = useOnboarding();
  const { startPlatformTour, isPlatformTourActive, cancelPlatformTour } = usePlatformExperience();
  const [open, setOpen] = useState(false);
  const [startingTour, setStartingTour] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const run = (action: () => void | Promise<void>) => {
    setOpen(false);
    void action();
  };

  const restartTour = async () => {
    setStartingTour(true);
    try {
      if (isPlatformTourActive) cancelPlatformTour();
      await resetTour();
      const firstRoute = ALL_PLATFORM_TOUR_ROUTES[0];
      startPlatformTour(firstRoute, [...ALL_PLATFORM_TOUR_ROUTES]);
      router.push(PLATFORM_TOUR_ROUTE_HREFS[firstRoute]);
    } finally {
      setStartingTour(false);
    }
  };

  const actions = [
    { label: "Pedir ajuda ou relatar problema", icon: HelpCircle, action: openSupportReporter },
    { label: "Reiniciar guia da plataforma", icon: Map, action: restartTour, disabled: startingTour },
    { label: privacyMode ? "Desativar modo privacidade" : "Ativar modo privacidade", icon: privacyMode ? Eye : EyeOff, action: togglePrivacyMode },
  ];

  return (
    <div ref={menuRef} className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-40 md:right-6 md:bottom-6">
      <div className="relative h-14 w-14">
        {actions.map((item, index) => {
          const Icon = item.icon;
          const count = actions.length;
          const angle = -90 + (360 / count) * index;
          const radius = 88;
          const x = count <= 3 ? 0 : Math.cos((angle * Math.PI) / 180) * radius;
          const y = count <= 3 ? -(index + 1) * 60 : Math.sin((angle * Math.PI) / 180) * radius;
          return (
            <Button
              key={item.label}
              type="button"
              size="icon"
              variant="secondary"
              title={item.label}
              aria-label={item.label}
              aria-hidden={!open}
              tabIndex={open ? 0 : -1}
              disabled={item.disabled}
              onClick={() => run(item.action)}
              className="absolute left-1 top-1 h-12 w-12 rounded-full border border-border/70 shadow-lg transition-all duration-200"
              style={{
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transform: open ? `translate(${x}px, ${y}px) scale(1)` : "translate(0, 0) scale(.6)",
                transitionDelay: open ? `${index * 35}ms` : "0ms",
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </Button>
          );
        })}
        <Button
          type="button"
          size="icon"
          aria-expanded={open}
          aria-label={open ? "Fechar funções rápidas" : "Abrir funções rápidas"}
          title={open ? "Fechar funções" : "Funções rápidas"}
          onClick={() => setOpen((current) => !current)}
          className="relative z-10 h-14 w-14 rounded-full shadow-xl shadow-primary/25"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
