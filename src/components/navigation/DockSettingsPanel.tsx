"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Laptop,
  MonitorSmartphone,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NAVIGATION_APP_ITEMS, normalizeNavigationPreferences } from "@/lib/navigation/apps";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { NavigationDockBar } from "@/components/navigation/NavigationDockBar";
import {
  DEFAULT_NAVIGATION_PREFERENCES,
  MAX_DOCK_SHORTCUTS,
  NavigationAppId,
  NavigationDockBehavior,
  NavigationDockAccent,
  NavigationDockDensity,
  NavigationDockLabels,
  NavigationDockPosition,
  NavigationDockSurface,
  NavigationDockTheme,
  NavigationPreferences,
} from "@/types/navigation";

const POSITION_OPTIONS: Array<{
  value: NavigationDockPosition;
  label: string;
  description: string;
}> = [
    { value: "left", label: "Esquerda", description: "Vira uma barra lateral fixa no lado esquerdo." },
    { value: "center", label: "Centro", description: "Mantém a barra central do jeito clássico." },
    { value: "right", label: "Direita", description: "Vira uma barra lateral fixa no lado direito." },
  ];

const BEHAVIOR_OPTIONS: Array<{
  value: NavigationDockBehavior;
  label: string;
  description: string;
}> = [
    { value: "fixed", label: "Sempre visível", description: "Fixa na tela e não se oculta." },
    { value: "auto-hide", label: "Ocultar automaticamente", description: "Oculta sozinha até você precisar dela." },
  ];

const THEME_OPTIONS: Array<{
  value: NavigationDockTheme;
  label: string;
  description: string;
}> = [
    { value: "dark", label: "Escuro", description: "Visual roxo escuro com mais contraste." },
    { value: "light", label: "Claro", description: "Visual claro com destaque roxo mais leve." },
  ];

const DENSITY_OPTIONS: Array<{
  value: NavigationDockDensity;
  label: string;
  description: string;
}> = [
    { value: "compact", label: "Compacta", description: "Ocupa menos espaço e fica mais enxuta." },
    { value: "comfortable", label: "Confortável", description: "Mais respiro para tocar e ler melhor." },
  ];

const LABEL_OPTIONS: Array<{
  value: NavigationDockLabels;
  label: string;
  description: string;
}> = [
    { value: "always", label: "Com nomes", description: "Mostra o nome de cada atalho na barra." },
    { value: "icons-only", label: "Somente ícones", description: "Deixa a barra mais limpa e minimalista." },
  ];

const SURFACE_OPTIONS: Array<{
  value: NavigationDockSurface;
  label: string;
  description: string;
}> = [
    { value: "glass", label: "Translucida", description: "Fundo translucido com brilho suave." },
    { value: "solid", label: "Solida", description: "Fundo mais fechado e contraste mais forte." },
  ];

const ACCENT_OPTIONS: Array<{
  value: NavigationDockAccent;
  label: string;
  description: string;
  swatchClass?: string;
}> = [
    { value: "app", label: "Cor do app", description: "Acompanha a cor escolhida em ConfiguraÃ§Ãµes.", swatchClass: "bg-primary" },
    { value: "violet", label: "Violet", description: "A cor principal da marca e do app.", swatchClass: "bg-linear-to-br from-violet-500 to-fuchsia-500" },
    { value: "indigo", label: "Indigo", description: "Uma variação fria e mais executiva." },
    { value: "fuchsia", label: "Fuchsia", description: "Mais vibrante, mantendo o DNA premium." },
    { value: "emerald", label: "Emerald", description: "Derivação limpa para um visual mais fresco." },
    { value: "amber", label: "Amber", description: "Quente e chamativa, sem fugir do sistema." },
  ];

const OPTION_SWATCH_CLASSES: Partial<Record<string, string>> = {
  app: "bg-primary",
  violet: "bg-linear-to-br from-violet-500 to-fuchsia-500",
  indigo: "bg-linear-to-br from-indigo-500 to-blue-500",
  fuchsia: "bg-linear-to-br from-fuchsia-500 to-pink-500",
  emerald: "bg-linear-to-br from-emerald-500 to-teal-500",
  amber: "bg-linear-to-br from-amber-500 to-orange-500",
};

type DockSettingsPanelProps = {
  compact?: boolean;
};

type ChoiceCardGroupProps<T extends string> = {
  title?: string;
  options: Array<{ value: T; label: string; description: string; swatchClass?: string }>;
  value: T;
  onChange: (value: T) => void;
  columns?: string;
};

function ChoiceCardGroup<T extends string>({
  title,
  options,
  value,
  onChange,
  columns = "lg:grid-cols-3",
}: ChoiceCardGroupProps<T>) {
  return (
    <div className="space-y-3">
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      ) : null}
      <div className={cn("grid gap-3", columns)}>
        {options.map((option) => {
          const swatchClass = option.swatchClass || OPTION_SWATCH_CLASSES[option.value];
          const description =
            option.value === "app"
              ? "Acompanha a cor escolhida em Configura\u00e7\u00f5es."
              : option.description;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-3xl border p-4 text-left transition-all",
                value === option.value
                  ? "border-primary/40 bg-accent shadow-sm ring-2 ring-ring/20"
                  : "app-panel-subtle border-[color:var(--app-panel-border)] hover:border-primary/25 hover:bg-accent/60"
              )}
            >
              <div className="flex items-start gap-3">
                {swatchClass ? (
                  <span
                    className={cn(
                      "h-10 w-10 shrink-0 rounded-2xl border border-white/20 shadow-inner",
                      swatchClass
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type PreferenceSectionProps = {
  title: string;
  description: string;
  summary: string[];
  defaultOpen?: boolean;
  children: ReactNode;
};

function PreferenceSection({
  title,
  description,
  summary,
  defaultOpen = false,
  children,
}: PreferenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="app-panel-soft rounded-3xl border border-[color:var(--app-panel-border)] p-4 shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {title}
                </p>
                {summary.map((item) => (
                  <Badge
                    key={`${title}-${item}`}
                    variant="outline"
                    className="rounded-full border-primary/20 bg-accent px-2.5 py-0.5 text-[11px] text-primary"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            <div
              className={cn(
                "app-panel-subtle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-panel-border)] text-muted-foreground transition-all",
                open && "rotate-180 border-primary/25 bg-accent text-primary"
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-5 space-y-5 border-t border-[color:var(--app-panel-border)] pt-5">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PreviewSurface({
  preferences,
}: {
  preferences: NavigationPreferences;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const isSidebar = device === "desktop" && preferences.position !== "center";

  return (
    <div className="rounded-4xl border border-violet-200 bg-linear-to-br from-violet-950 via-fuchsia-950 to-zinc-950 p-5 text-white shadow-2xl shadow-violet-300/20 dark:border-violet-500/20 dark:shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="rounded-full bg-violet-400/15 px-3 py-1 text-violet-100 hover:bg-violet-400/15">Preview</Badge>
          <h3 className="mt-3 text-xl font-semibold">Como sua barra rápida vai ficar?</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-violet-100/80">
            Está é uma prévia. A barra real só muda depois que você salvar.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-violet-200/15 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              device === "mobile" ? "bg-white text-zinc-900" : "text-zinc-300"
            )}
          >
            Celular
          </button>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              device === "desktop" ? "bg-white text-zinc-900" : "text-zinc-300"
            )}
          >
            Desktop
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">Posição</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {POSITION_OPTIONS.find((option) => option.value === preferences.position)?.label}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">Comportamento</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {BEHAVIOR_OPTIONS.find((option) => option.value === preferences.behavior)?.label}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">Estilo</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {THEME_OPTIONS.find((option) => option.value === preferences.theme)?.label}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "mt-6 overflow-hidden rounded-4xl border border-white/10 bg-white/5",
          device === "mobile" ? "min-h-[500px]" : "min-h-[360px]"
        )}
      >
        <div className="relative h-full w-full p-5">
          <div className="absolute inset-0 bg-radial-gradient(circle_at_top,_rgba(168,85,247,0.25),_transparent_52%)" />
          {device === "mobile" ? (
            <div className="relative mx-auto h-[440px] w-[280px] rounded-[34px] border border-violet-200/10 bg-white/5 p-5">
              <div className="rounded-3xl border border-violet-200/10 bg-white/5 px-4 py-4">
                <p className="text-xs text-violet-200/55">Visão no celular</p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  Os atalhos ficam ao alcance do polegar.
                </p>
              </div>

              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <NavigationDockBar preferences={preferences} mobile activeItemId={null} />
              </div>
            </div>
          ) : (
            <div className="relative h-[300px] rounded-4xl border border-violet-200/10 bg-white/5 p-6">
              <div className="rounded-3xl border border-violet-200/10 bg-white/5 px-5 py-4">
                <p className="text-xs text-violet-200/55">Visão no desktop</p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  {isSidebar
                    ? "A barra vira uma coluna lateral para abrir o que voce mais usa."
                    : "Os atalhos ficam sempre prontos para abrir o que voce mais usa."}
                </p>
              </div>

              {preferences.position === "center" ? (
                <div className="absolute inset-x-0 bottom-6 flex justify-center">
                  <NavigationDockBar preferences={preferences} activeItemId={null} />
                </div>
              ) : (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2",
                    preferences.position === "left" ? "left-6" : "right-6"
                  )}
                >
                  <NavigationDockBar preferences={preferences} activeItemId={null} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DockSettingsPanel({ compact = false }: DockSettingsPanelProps) {
  const { navigationPreferences, navigationLoading, updatePreferences } = usePlatformExperience();
  const [draft, setDraft] = useState<NavigationPreferences>(navigationPreferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(navigationPreferences);
  }, [navigationPreferences]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(normalizeNavigationPreferences(draft)) !== JSON.stringify(normalizeNavigationPreferences(navigationPreferences));
  }, [draft, navigationPreferences]);

  const visibleShortcuts = useMemo(() => {
    return draft.shortcuts
      .map((id) => NAVIGATION_APP_ITEMS.find((item) => item.id === id))
      .filter((item): item is (typeof NAVIGATION_APP_ITEMS)[number] => Boolean(item));
  }, [draft.shortcuts]);

  const positionLabel = POSITION_OPTIONS.find((option) => option.value === draft.position)?.label || "Centro";
  const behaviorLabel = BEHAVIOR_OPTIONS.find((option) => option.value === draft.behavior)?.label || "Sempre visivel";
  const themeLabel = THEME_OPTIONS.find((option) => option.value === draft.theme)?.label || "Escuro";
  const accentLabel = ACCENT_OPTIONS.find((option) => option.value === draft.accent)?.label || "Violet";
  const labelsLabel = LABEL_OPTIONS.find((option) => option.value === draft.labels)?.label || "Com nomes";
  const densityLabel = DENSITY_OPTIONS.find((option) => option.value === draft.density)?.label || "Confortavel";
  const surfaceLabel = SURFACE_OPTIONS.find((option) => option.value === draft.surface)?.label || "Translucida";

  const updateDraft = (updater: (current: NavigationPreferences) => NavigationPreferences) => {
    setDraft((prev) => normalizeNavigationPreferences(updater(prev)));
  };

  const toggleShortcut = (id: NavigationAppId) => {
    updateDraft((current) => {
      const exists = current.shortcuts.includes(id);
      if (exists) {
        return {
          ...current,
          shortcuts: current.shortcuts.filter((item) => item !== id),
        };
      }
      if (current.shortcuts.length >= MAX_DOCK_SHORTCUTS) return current;
      return {
        ...current,
        shortcuts: [...current.shortcuts, id],
      };
    });
  };

  const moveShortcut = (id: NavigationAppId, direction: "up" | "down") => {
    updateDraft((current) => {
      const index = current.shortcuts.indexOf(id);
      if (index < 0) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.shortcuts.length) return current;
      const nextShortcuts = [...current.shortcuts];
      const [item] = nextShortcuts.splice(index, 1);
      nextShortcuts.splice(nextIndex, 0, item);
      return { ...current, shortcuts: nextShortcuts };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("space-y-6 overflow-x-hidden", compact ? "text-sm" : "")}>
      <div className="app-panel-soft rounded-4xl border border-[color:var(--app-panel-border)] p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Barra rápida personalizada</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Ajuste o comportamento da barra e escolha os atalhos que devem ficar sempre por perto.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.88fr)]">
          <div className="space-y-3">
            <PreferenceSection
              title="Disponibilidade"
              description="Ative a barra no celular, no desktop ou nos dois contextos."
              summary={[
                draft.mobileEnabled ? "Celular ligado" : "Celular desligado",
                draft.desktopEnabled ? "Desktop ligado" : "Desktop desligado",
              ]}
              defaultOpen
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-panel-subtle rounded-2xl border border-[color:var(--app-panel-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">No celular</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Barra inferior parecida com app para abrir o que você usa mais rápido.</p>
                    </div>
                    <Switch
                      checked={draft.mobileEnabled}
                      onCheckedChange={(checked) => updateDraft((current) => ({ ...current, mobileEnabled: checked }))}
                      disabled={navigationLoading || isSaving}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <MonitorSmartphone className="h-4 w-4" />
                    No celular ela fica centralizada e pronta para uso com o polegar.
                  </div>
                </div>

                <div className="app-panel-subtle rounded-2xl border border-[color:var(--app-panel-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">No computador</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Ative se quiser navegar com uma barra parecida com app também no desktop.</p>
                    </div>
                    <Switch
                      checked={draft.desktopEnabled}
                      onCheckedChange={(checked) => updateDraft((current) => ({ ...current, desktopEnabled: checked }))}
                      disabled={navigationLoading || isSaving}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Laptop className="h-4 w-4" />
                    Em esquerda ou direita ela vira uma barra lateral de verdade.
                  </div>
                </div>
              </div>
            </PreferenceSection>

            <PreferenceSection
              title="Posição"
              description="Escolha se a barra fica embaixo ou se vira uma barra lateral no computador."
              summary={[positionLabel]}
            >
              <ChoiceCardGroup
                options={POSITION_OPTIONS}
                value={draft.position}
                onChange={(value) =>
                  updateDraft((current) => ({
                    ...current,
                    position: value,
                    desktopEnabled: value === "center" ? current.desktopEnabled : true,
                  }))
                }
              />
            </PreferenceSection>

            <PreferenceSection
              title="Comportamento"
              description="Defina se a barra fica sempre vísivel ou se pode se ocultar sozinha."
              summary={[behaviorLabel]}
            >
              <ChoiceCardGroup
                options={BEHAVIOR_OPTIONS}
                value={draft.behavior}
                onChange={(value) => updateDraft((current) => ({ ...current, behavior: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Estilo"
              description="Escolha o clima visual da barra para combinar com o jeito que você gosta de usar."
              summary={[themeLabel]}
            >
              <ChoiceCardGroup
                options={THEME_OPTIONS}
                value={draft.theme}
                onChange={(value) => updateDraft((current) => ({ ...current, theme: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Cor"
              description="Escolha a cor principal da barra usando tons derivados do visual do WevenFinance."
              summary={[accentLabel]}
            >
              <ChoiceCardGroup
                options={ACCENT_OPTIONS}
                value={draft.accent}
                onChange={(value) => updateDraft((current) => ({ ...current, accent: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Tamanho"
              description="Deixe a barra mais compacta ou mais confortável para tocar e ler."
              summary={[densityLabel]}
            >
              <ChoiceCardGroup
                options={DENSITY_OPTIONS}
                value={draft.density}
                onChange={(value) => updateDraft((current) => ({ ...current, density: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Nomes dos atalhos"
              description="Escolha se a barra mostra os nomes ou se fica mais limpa so com os icones."
              summary={[labelsLabel]}
            >
              <ChoiceCardGroup
                options={LABEL_OPTIONS}
                value={draft.labels}
                onChange={(value) => updateDraft((current) => ({ ...current, labels: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Acabamento"
              description="Defina se a barra fica mais translucida ou com fundo mais fechado."
              summary={[surfaceLabel]}
            >
              <ChoiceCardGroup
                options={SURFACE_OPTIONS}
                value={draft.surface}
                onChange={(value) => updateDraft((current) => ({ ...current, surface: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>
          </div>

          <div className="space-y-4">
            <PreferenceSection
              title="Atalhos visíveis"
              description={`Escolha ate ${MAX_DOCK_SHORTCUTS} atalhos para deixar sempre por perto.`}
              summary={[`${visibleShortcuts.length}/${MAX_DOCK_SHORTCUTS} ativos`]}
            >
              <div className="flex flex-wrap gap-2">
                {visibleShortcuts.map((item) => (
                  <Badge key={item.id} variant="secondary" className="rounded-full bg-accent px-3 py-1 text-primary">
                    {item.label}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {NAVIGATION_APP_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const enabled = draft.shortcuts.includes(item.id);
                  const index = draft.shortcuts.indexOf(item.id);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-3xl border p-4 transition-all",
                        enabled
                          ? "border-primary/35 bg-accent shadow-sm"
                          : "app-panel-subtle border-[color:var(--app-panel-border)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br", item.accentClass)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleShortcut(item.id)}
                          disabled={navigationLoading || isSaving || (!enabled && draft.shortcuts.length >= MAX_DOCK_SHORTCUTS)}
                        />
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        {enabled ? (
                          <Badge variant="outline" className="rounded-full border-primary/25 bg-background/60 text-primary">
                            Atalho {index + 1}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não aparece na barra rápida</span>
                        )}

                        {enabled && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => moveShortcut(item.id, "up")}
                              disabled={index <= 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => moveShortcut(item.id, "down")}
                              disabled={index < 0 || index >= draft.shortcuts.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PreferenceSection>

            <div className="xl:sticky xl:top-24">
              <PreviewSurface preferences={draft} />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="app-panel-soft rounded-4xl border border-[color:var(--app-panel-border)] p-4 shadow-4xl shadow-primary/10 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Aplicar alterações</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Salve quando quiser usar essas escolhas na barra rápida do app.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => setDraft(DEFAULT_NAVIGATION_PREFERENCES)}
                disabled={isSaving}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar padrão
              </Button>
              <Button
                type="button"
                className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => void handleSave()}
                disabled={navigationLoading || isSaving || !hasChanges}
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
