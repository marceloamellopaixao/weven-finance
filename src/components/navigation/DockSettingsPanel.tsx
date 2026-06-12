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
import { useTranslations } from "@/i18n/T";

const POSITION_OPTIONS: Array<{
  value: NavigationDockPosition;
  label: string;
  description: string;
}> = [
    { value: "left", label: "", description: "" },
    { value: "center", label: "", description: "" },
    { value: "right", label: "", description: "" },
  ];

const BEHAVIOR_OPTIONS: Array<{
  value: NavigationDockBehavior;
  label: string;
  description: string;
}> = [
    { value: "fixed", label: "", description: "" },
    { value: "auto-hide", label: "", description: "" },
  ];

const THEME_OPTIONS: Array<{
  value: NavigationDockTheme;
  label: string;
  description: string;
}> = [
    { value: "dark", label: "", description: "" },
    { value: "light", label: "", description: "" },
  ];

const DENSITY_OPTIONS: Array<{
  value: NavigationDockDensity;
  label: string;
  description: string;
}> = [
    { value: "compact", label: "", description: "" },
    { value: "comfortable", label: "", description: "" },
  ];

const LABEL_OPTIONS: Array<{
  value: NavigationDockLabels;
  label: string;
  description: string;
}> = [
    { value: "always", label: "", description: "" },
    { value: "icons-only", label: "", description: "" },
  ];

const SURFACE_OPTIONS: Array<{
  value: NavigationDockSurface;
  label: string;
  description: string;
}> = [
    { value: "glass", label: "", description: "" },
    { value: "solid", label: "", description: "" },
  ];

const ACCENT_OPTIONS: Array<{
  value: NavigationDockAccent;
  label: string;
  description: string;
  swatchClass?: string;
}> = [
    { value: "app", label: "", description: "", swatchClass: "bg-primary" },
    { value: "violet", label: "", description: "", swatchClass: "bg-linear-to-br from-violet-500 to-fuchsia-500" },
    { value: "indigo", label: "", description: "" },
    { value: "fuchsia", label: "", description: "" },
    { value: "emerald", label: "", description: "" },
    { value: "amber", label: "", description: "" },
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
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-3xl border p-4 text-left transition-all",
                value === option.value
                  ? "border-primary/40 bg-accent shadow-sm ring-2 ring-ring/20"
                  : "app-panel-subtle border-color:var(--app-panel-border) hover:border-primary/25 hover:bg-accent/60"
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
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.description}</span>
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
      <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-4 shadow-sm">
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
                "app-panel-subtle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-color:var(--app-panel-border) text-muted-foreground transition-all",
                open && "rotate-180 border-primary/25 bg-accent text-primary"
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-5 space-y-5 border-t border-color:var(--app-panel-border) pt-5">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PreviewSurface({
  preferences,
  tApps,
}: {
  preferences: NavigationPreferences;
  tApps: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const isSidebar = device === "desktop" && preferences.position !== "center";

  return (
    <div className="rounded-4xl border border-violet-200 bg-linear-to-br from-violet-950 via-fuchsia-950 to-zinc-950 p-5 text-white shadow-2xl shadow-violet-300/20 dark:border-violet-500/20 dark:shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="rounded-full bg-violet-400/15 px-3 py-1 text-violet-100 hover:bg-violet-400/15">{tApps("dock.preview.badge")}</Badge>
          <h3 className="mt-3 text-xl font-semibold">{tApps("dock.preview.title")}</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-violet-100/80">
            {tApps("dock.preview.description")}
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
            {tApps("dock.preview.mobile")}
          </button>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              device === "desktop" ? "bg-white text-zinc-900" : "text-zinc-300"
            )}
          >
            {tApps("dock.preview.desktop")}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">{tApps("dock.preview.position")}</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {tApps(`dock.options.position.${preferences.position}.label`)}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">{tApps("dock.preview.behavior")}</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {tApps(`dock.options.behavior.${preferences.behavior}.label`)}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200/50">{tApps("dock.preview.style")}</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {tApps(`dock.options.theme.${preferences.theme}.label`)}
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
                <p className="text-xs text-violet-200/55">{tApps("dock.preview.mobileView")}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  {tApps("dock.preview.mobileText")}
                </p>
              </div>

              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <NavigationDockBar preferences={preferences} mobile activeItemId={null} />
              </div>
            </div>
          ) : (
            <div className="relative h-[300px] rounded-4xl border border-violet-200/10 bg-white/5 p-6">
              <div className="rounded-3xl border border-violet-200/10 bg-white/5 px-5 py-4">
                <p className="text-xs text-violet-200/55">{tApps("dock.preview.desktopView")}</p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  {isSidebar
                    ? tApps("dock.preview.desktopSidebarText")
                    : tApps("dock.preview.desktopCenterText")}
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
  const tApps = useTranslations("apps");
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

  const translateOptions = <T extends string>(
    group: "position" | "behavior" | "theme" | "accent" | "density" | "labels" | "surface",
    options: Array<{ value: T; label: string; description: string; swatchClass?: string }>
  ) =>
    options.map((option) => ({
      ...option,
      label: tApps(`dock.options.${group}.${option.value}.label`),
      description: tApps(`dock.options.${group}.${option.value}.description`),
    }));

  const positionOptions = translateOptions("position", POSITION_OPTIONS);
  const behaviorOptions = translateOptions("behavior", BEHAVIOR_OPTIONS);
  const themeOptions = translateOptions("theme", THEME_OPTIONS);
  const accentOptions = translateOptions("accent", ACCENT_OPTIONS);
  const densityOptions = translateOptions("density", DENSITY_OPTIONS);
  const labelOptions = translateOptions("labels", LABEL_OPTIONS);
  const surfaceOptions = translateOptions("surface", SURFACE_OPTIONS);

  const positionLabel = tApps(`dock.options.position.${draft.position}.label`);
  const behaviorLabel = tApps(`dock.options.behavior.${draft.behavior}.label`);
  const themeLabel = tApps(`dock.options.theme.${draft.theme}.label`);
  const accentLabel = tApps(`dock.options.accent.${draft.accent}.label`);
  const labelsLabel = tApps(`dock.options.labels.${draft.labels}.label`);
  const densityLabel = tApps(`dock.options.density.${draft.density}.label`);
  const surfaceLabel = tApps(`dock.options.surface.${draft.surface}.label`);

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
      <div className="app-panel-soft rounded-4xl border border-color:var(--app-panel-border) p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{tApps("dock.title")}</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {tApps("dock.description")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.88fr)]">
          <div className="space-y-3">
            <PreferenceSection
              title={tApps("dock.availability.title")}
              description={tApps("dock.availability.description")}
              summary={[
                draft.mobileEnabled ? tApps("dock.availability.mobileOn") : tApps("dock.availability.mobileOff"),
                draft.desktopEnabled ? tApps("dock.availability.desktopOn") : tApps("dock.availability.desktopOff"),
              ]}
              defaultOpen
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tApps("dock.availability.mobileTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{tApps("dock.availability.mobileDescription")}</p>
                    </div>
                    <Switch
                      checked={draft.mobileEnabled}
                      onCheckedChange={(checked) => updateDraft((current) => ({ ...current, mobileEnabled: checked }))}
                      disabled={navigationLoading || isSaving}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <MonitorSmartphone className="h-4 w-4" />
                    {tApps("dock.availability.mobileHint")}
                  </div>
                </div>

                <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tApps("dock.availability.desktopTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{tApps("dock.availability.desktopDescription")}</p>
                    </div>
                    <Switch
                      checked={draft.desktopEnabled}
                      onCheckedChange={(checked) => updateDraft((current) => ({ ...current, desktopEnabled: checked }))}
                      disabled={navigationLoading || isSaving}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Laptop className="h-4 w-4" />
                    {tApps("dock.availability.desktopHint")}
                  </div>
                </div>
              </div>
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.position.title")}
              description={tApps("dock.sections.position.description")}
              summary={[positionLabel]}
            >
              <ChoiceCardGroup
                options={positionOptions}
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
              title={tApps("dock.sections.behavior.title")}
              description={tApps("dock.sections.behavior.description")}
              summary={[behaviorLabel]}
            >
              <ChoiceCardGroup
                options={behaviorOptions}
                value={draft.behavior}
                onChange={(value) => updateDraft((current) => ({ ...current, behavior: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.theme.title")}
              description={tApps("dock.sections.theme.description")}
              summary={[themeLabel]}
            >
              <ChoiceCardGroup
                options={themeOptions}
                value={draft.theme}
                onChange={(value) => updateDraft((current) => ({ ...current, theme: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.accent.title")}
              description={tApps("dock.sections.accent.description")}
              summary={[accentLabel]}
            >
              <ChoiceCardGroup
                options={accentOptions}
                value={draft.accent}
                onChange={(value) => updateDraft((current) => ({ ...current, accent: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.density.title")}
              description={tApps("dock.sections.density.description")}
              summary={[densityLabel]}
            >
              <ChoiceCardGroup
                options={densityOptions}
                value={draft.density}
                onChange={(value) => updateDraft((current) => ({ ...current, density: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.labels.title")}
              description={tApps("dock.sections.labels.description")}
              summary={[labelsLabel]}
            >
              <ChoiceCardGroup
                options={labelOptions}
                value={draft.labels}
                onChange={(value) => updateDraft((current) => ({ ...current, labels: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>

            <PreferenceSection
              title={tApps("dock.sections.surface.title")}
              description={tApps("dock.sections.surface.description")}
              summary={[surfaceLabel]}
            >
              <ChoiceCardGroup
                options={surfaceOptions}
                value={draft.surface}
                onChange={(value) => updateDraft((current) => ({ ...current, surface: value }))}
                columns="md:grid-cols-2"
              />
            </PreferenceSection>
          </div>

          <div className="space-y-4">
            <PreferenceSection
              title={tApps("dock.sections.shortcuts.title")}
              description={tApps("dock.sections.shortcuts.description", { count: MAX_DOCK_SHORTCUTS })}
              summary={[tApps("dock.sections.shortcuts.summary", { active: visibleShortcuts.length, max: MAX_DOCK_SHORTCUTS })]}
            >
              <div className="flex flex-wrap gap-2">
                {visibleShortcuts.map((item) => (
                  <Badge key={item.id} variant="secondary" className="rounded-full bg-accent px-3 py-1 text-primary">
                    {tApps(`navigation.${item.id}.label`)}
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
                          : "app-panel-subtle border-color:var(--app-panel-border)"
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
                        <p className="text-sm font-semibold text-foreground">{tApps(`navigation.${item.id}.label`)}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{tApps(`navigation.${item.id}.description`)}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        {enabled ? (
                          <Badge variant="outline" className="rounded-full border-primary/25 bg-background/60 text-primary">
                            {tApps("dock.sections.shortcuts.shortcutBadge", { index: index + 1 })}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tApps("dock.sections.shortcuts.hidden")}</span>
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
              <PreviewSurface preferences={draft} tApps={tApps} />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="app-panel-soft rounded-4xl border border-color:var(--app-panel-border) p-4 shadow-4xl shadow-primary/10 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{tApps("dock.actions.title")}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {tApps("dock.actions.description")}
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
                {tApps("dock.actions.reset")}
              </Button>
              <Button
                type="button"
                className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => void handleSave()}
                disabled={navigationLoading || isSaving || !hasChanges}
              >
                <Save className="h-4 w-4" />
                {isSaving ? tApps("dock.actions.saving") : tApps("dock.actions.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
