"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Laptop,
  MonitorSmartphone,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  { value: "center", label: "Centro", description: "Mantem a barra central do jeito classico." },
  { value: "right", label: "Direita", description: "Vira uma barra lateral fixa no lado direito." },
];

const BEHAVIOR_OPTIONS: Array<{
  value: NavigationDockBehavior;
  label: string;
  description: string;
}> = [
  { value: "fixed", label: "Fixa", description: "A barra fica sempre visivel na tela." },
  { value: "auto-hide", label: "Oculta", description: "Ela some e reaparece quando voce precisar." },
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
  { value: "compact", label: "Compacta", description: "Ocupa menos espaco e fica mais enxuta." },
  { value: "comfortable", label: "Confortavel", description: "Mais respiro para tocar e ler melhor." },
];

const LABEL_OPTIONS: Array<{
  value: NavigationDockLabels;
  label: string;
  description: string;
}> = [
  { value: "always", label: "Com nomes", description: "Mostra o nome de cada atalho na barra." },
  { value: "icons-only", label: "So icones", description: "Deixa a barra mais limpa e minimalista." },
];

const SURFACE_OPTIONS: Array<{
  value: NavigationDockSurface;
  label: string;
  description: string;
}> = [
  { value: "glass", label: "Glass", description: "Fundo translucido com brilho suave." },
  { value: "solid", label: "Solida", description: "Fundo mais fechado e contraste mais forte." },
];

const ACCENT_OPTIONS: Array<{
  value: NavigationDockAccent;
  label: string;
  description: string;
}> = [
  { value: "violet", label: "Roxo Weven", description: "A cor principal da marca e do app." },
  { value: "indigo", label: "Indigo", description: "Uma variacao fria e mais executiva." },
  { value: "fuchsia", label: "Fuchsia", description: "Mais vibrante, mantendo o DNA premium." },
  { value: "emerald", label: "Emerald", description: "Derivacao limpa para um visual mais fresco." },
  { value: "amber", label: "Amber", description: "Quente e chamativa, sem fugir do sistema." },
];

type DockSettingsPanelProps = {
  compact?: boolean;
};

type ChoiceCardGroupProps<T extends string> = {
  title: string;
  options: Array<{ value: T; label: string; description: string }>;
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className={cn("grid gap-3", columns)}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-3xl border p-4 text-left transition-all",
              value === option.value
                ? "border-violet-400 bg-violet-50 shadow-sm ring-2 ring-violet-200 dark:border-violet-500 dark:bg-violet-950/30"
                : "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-800 dark:bg-zinc-950"
            )}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
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
          <h3 className="mt-3 text-xl font-semibold">Como sua barra rapida vai ficar</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-violet-100/80">
            Esta e uma previa. A barra real so muda depois que voce salvar.
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
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">Posicao</p>
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.25),_transparent_52%)]" />
          {device === "mobile" ? (
            <div className="relative mx-auto h-[440px] w-[280px] rounded-[34px] border border-violet-200/10 bg-white/5 p-5">
              <div className="rounded-3xl border border-violet-200/10 bg-white/5 px-4 py-4">
                <p className="text-xs text-violet-200/55">Visao no celular</p>
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
                <p className="text-xs text-violet-200/55">Visao no desktop</p>
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
      <div className="rounded-4xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Barra rapida personalizada</h3>
            <p className="text-sm leading-6 text-zinc-500">
              Ajuste o comportamento da barra e escolha os atalhos que devem ficar sempre por perto.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-6 rounded-4xl border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Barra no celular</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Barra inferior estilo app para abrir o que voce mais usa.</p>
                  </div>
                  <Switch
                    checked={draft.mobileEnabled}
                    onCheckedChange={(checked) => updateDraft((current) => ({ ...current, mobileEnabled: checked }))}
                    disabled={navigationLoading || isSaving}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <MonitorSmartphone className="h-4 w-4" />
                  No celular ela continua centralizada e pronta para toque rapido.
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Barra no desktop</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Ative para usar o WevenFinance com navegacao estilo app no computador.</p>
                  </div>
                  <Switch
                    checked={draft.desktopEnabled}
                    onCheckedChange={(checked) => updateDraft((current) => ({ ...current, desktopEnabled: checked }))}
                    disabled={navigationLoading || isSaving}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <Laptop className="h-4 w-4" />
                  Em esquerda ou direita ela vira uma barra lateral de verdade.
                </div>
              </div>
            </div>

            <ChoiceCardGroup
              title="Posicao"
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

            <ChoiceCardGroup
              title="Comportamento"
              options={BEHAVIOR_OPTIONS}
              value={draft.behavior}
              onChange={(value) => updateDraft((current) => ({ ...current, behavior: value }))}
              columns="md:grid-cols-2"
            />

            <ChoiceCardGroup
              title="Estilo"
              options={THEME_OPTIONS}
              value={draft.theme}
              onChange={(value) => updateDraft((current) => ({ ...current, theme: value }))}
              columns="md:grid-cols-2"
            />

            <ChoiceCardGroup
              title="Cor"
              options={ACCENT_OPTIONS}
              value={draft.accent}
              onChange={(value) => updateDraft((current) => ({ ...current, accent: value }))}
              columns="md:grid-cols-2 xl:grid-cols-3"
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <ChoiceCardGroup
                title="Tamanho"
                options={DENSITY_OPTIONS}
                value={draft.density}
                onChange={(value) => updateDraft((current) => ({ ...current, density: value }))}
                columns="grid-cols-1"
              />

              <ChoiceCardGroup
                title="Rotulos"
                options={LABEL_OPTIONS}
                value={draft.labels}
                onChange={(value) => updateDraft((current) => ({ ...current, labels: value }))}
                columns="grid-cols-1"
              />
            </div>

            <ChoiceCardGroup
              title="Superficie"
              options={SURFACE_OPTIONS}
              value={draft.surface}
              onChange={(value) => updateDraft((current) => ({ ...current, surface: value }))}
              columns="md:grid-cols-2"
            />
          </div>

          <div className="rounded-4xl border border-zinc-200 bg-zinc-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Atalhos visiveis</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Escolha ate {MAX_DOCK_SHORTCUTS} atalhos para deixar na barra rapida.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleShortcuts.map((item) => (
                  <Badge key={item.id} variant="secondary" className="rounded-full bg-violet-100 px-3 py-1 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    {item.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
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
                        ? "border-violet-300 bg-violet-50/70 shadow-sm dark:border-violet-500/40 dark:bg-violet-950/25"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
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
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {enabled ? (
                        <Badge variant="outline" className="rounded-full border-violet-300 bg-white text-violet-700 dark:border-violet-500/40 dark:bg-transparent dark:text-violet-300">
                          Atalho {index + 1}
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-400">Nao aparece na barra rapida</span>
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
          </div>
        </div>
      </div>

      <PreviewSurface preferences={draft} />

      <div className="flex flex-col gap-3 rounded-4xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pronto para aplicar</p>
            <p className="mt-1 text-xs text-zinc-500">
              A barra rapida so muda no app depois que voce salvar essas preferencias.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setDraft(DEFAULT_NAVIGATION_PREFERENCES)}
            disabled={isSaving}
          >
            Restaurar padrao
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => void handleSave()}
            disabled={navigationLoading || isSaving || !hasChanges}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar preferencias"}
          </Button>
        </div>
      </div>
    </div>
  );
}
