"use client";

import Link from "next/link";
import { Compass, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NAVIGATION_APP_ITEMS } from "@/lib/navigation/apps";
import { DockSettingsPanel } from "@/components/navigation/DockSettingsPanel";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function AppsPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { startPlatformTour } = usePlatformExperience();
  const { resetTour, isActive: isOnboardingActive } = useOnboarding();

  const handleStartTour = async () => {
    await resetTour();
    startPlatformTour("dashboard");
    router.push("/dashboard?tour=1");
  };

  return (
    <div className="min-h-screen bg-zinc-50/40 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-4xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20">
          <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-8 md:py-10">
            <div className="space-y-4">
              <Badge className="rounded-full bg-violet-100 px-3 py-1 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                Navegacao rapida do app
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
                  Explore o WevenFinance como um app
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-500 md:text-base">
                  Veja o que cada area faz, personalize sua barra rapida e rode um tour completo pela plataforma para entender
                  onde acompanhar seus gastos, cartoes, metas e configuracoes.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => void handleStartTour()}
                  disabled={isOnboardingActive}
                  className="rounded-2xl bg-violet-600 text-white hover:bg-violet-700"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {isOnboardingActive ? "Conclua o inicio guiado primeiro" : "Iniciar tour guiado"}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="rounded-2xl">
                    Abrir dashboard
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-linear-to-br from-violet-50 to-white p-5 dark:border-zinc-800 dark:from-violet-950/30 dark:to-zinc-950">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/25">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conta atual</p>
                  <p className="text-xs text-zinc-500">
                    {userProfile?.displayName || "Usuario"} · plano {(userProfile?.plan || "free").toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-violet-200 bg-white/90 p-4 text-sm text-zinc-600 shadow-sm dark:border-violet-500/20 dark:bg-zinc-950/80 dark:text-zinc-300">
                Use esta tela sempre que quiser reorganizar os atalhos do app ou reaprender rapidamente onde cada coisa fica.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">O que existe na plataforma</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {NAVIGATION_APP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href}>
                  <Card className="h-full rounded-[28px] border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-500/40 dark:hover:shadow-black/30">
                    <CardContent className="p-5">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${item.accentClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 space-y-2">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</h3>
                        <p className="text-sm leading-6 text-zinc-500">{item.description}</p>
                      </div>
                      <div className="mt-5">
                        <Badge variant="outline" className="rounded-full border-violet-200 text-violet-700 dark:border-violet-500/30 dark:text-violet-300">
                          Abrir {item.shortLabel.toLowerCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Personalizar barra rapida e atalhos</h2>
            <p className="text-sm text-zinc-500">
              Esta e a tela oficial para configurar sua barra rapida no celular e no desktop.
            </p>
          </div>
          <DockSettingsPanel />
        </section>
      </div>
    </div>
  );
}
