"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getNavigationAppItem } from "@/lib/navigation/apps";
import { NavigationAppId, NavigationDockAccent, NavigationPreferences } from "@/types/navigation";

type NavigationDockBarProps = {
  preferences: NavigationPreferences;
  activeItemId?: NavigationAppId | null;
  mobile?: boolean;
  interactive?: boolean;
  className?: string;
};

const ACCENT_CLASSES: Record<
  NavigationDockAccent,
  {
    lightSolid: string;
    lightGlass: string;
    darkSolid: string;
    darkGlass: string;
    activeLight: string;
    activeDark: string;
    idleLight: string;
    idleDark: string;
  }
> = {
  violet: {
    lightSolid: "border-violet-200/70 bg-white/96 text-zinc-800 shadow-zinc-200/45 ring-1 ring-violet-200/45",
    lightGlass: "border-violet-200/65 bg-white/86 text-zinc-800 shadow-zinc-200/30 ring-1 ring-violet-200/35 backdrop-blur-2xl",
    darkSolid: "border-violet-400/14 bg-zinc-900/90 text-zinc-100 shadow-black/25 ring-1 ring-white/6",
    darkGlass: "border-violet-400/14 bg-zinc-900/72 text-zinc-100 shadow-black/18 ring-1 ring-violet-300/10 backdrop-blur-2xl",
    activeLight: "bg-violet-600 text-white shadow-lg shadow-violet-300/25",
    activeDark: "bg-violet-400/18 text-white shadow-lg shadow-violet-950/16 ring-1 ring-violet-300/18",
    idleLight: "text-violet-700/75 hover:bg-violet-50 hover:text-violet-700",
    idleDark: "text-violet-100/75 hover:bg-violet-400/10 hover:text-white",
  },
  indigo: {
    lightSolid: "border-indigo-200/70 bg-white/96 text-zinc-800 shadow-zinc-200/45 ring-1 ring-indigo-200/45",
    lightGlass: "border-indigo-200/65 bg-white/86 text-zinc-800 shadow-zinc-200/30 ring-1 ring-indigo-200/35 backdrop-blur-2xl",
    darkSolid: "border-indigo-400/14 bg-zinc-900/90 text-zinc-100 shadow-black/25 ring-1 ring-white/6",
    darkGlass: "border-indigo-400/14 bg-zinc-900/72 text-zinc-100 shadow-black/18 ring-1 ring-indigo-300/10 backdrop-blur-2xl",
    activeLight: "bg-indigo-600 text-white shadow-lg shadow-indigo-300/25",
    activeDark: "bg-indigo-400/18 text-white shadow-lg shadow-indigo-950/16 ring-1 ring-indigo-300/18",
    idleLight: "text-indigo-700/75 hover:bg-indigo-50 hover:text-indigo-700",
    idleDark: "text-indigo-100/75 hover:bg-indigo-400/10 hover:text-white",
  },
  fuchsia: {
    lightSolid: "border-fuchsia-200/70 bg-white/96 text-zinc-800 shadow-zinc-200/45 ring-1 ring-fuchsia-200/45",
    lightGlass: "border-fuchsia-200/65 bg-white/86 text-zinc-800 shadow-zinc-200/30 ring-1 ring-fuchsia-200/35 backdrop-blur-2xl",
    darkSolid: "border-fuchsia-400/14 bg-zinc-900/90 text-zinc-100 shadow-black/25 ring-1 ring-white/6",
    darkGlass: "border-fuchsia-400/14 bg-zinc-900/72 text-zinc-100 shadow-black/18 ring-1 ring-fuchsia-300/10 backdrop-blur-2xl",
    activeLight: "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-300/25",
    activeDark: "bg-fuchsia-400/18 text-white shadow-lg shadow-fuchsia-950/16 ring-1 ring-fuchsia-300/18",
    idleLight: "text-fuchsia-700/75 hover:bg-fuchsia-50 hover:text-fuchsia-700",
    idleDark: "text-fuchsia-100/75 hover:bg-fuchsia-400/10 hover:text-white",
  },
  emerald: {
    lightSolid: "border-emerald-200/70 bg-white/96 text-zinc-800 shadow-zinc-200/45 ring-1 ring-emerald-200/45",
    lightGlass: "border-emerald-200/65 bg-white/86 text-zinc-800 shadow-zinc-200/30 ring-1 ring-emerald-200/35 backdrop-blur-2xl",
    darkSolid: "border-emerald-400/14 bg-zinc-900/90 text-zinc-100 shadow-black/25 ring-1 ring-white/6",
    darkGlass: "border-emerald-400/14 bg-zinc-900/72 text-zinc-100 shadow-black/18 ring-1 ring-emerald-300/10 backdrop-blur-2xl",
    activeLight: "bg-emerald-600 text-white shadow-lg shadow-emerald-300/25",
    activeDark: "bg-emerald-400/18 text-white shadow-lg shadow-emerald-950/16 ring-1 ring-emerald-300/18",
    idleLight: "text-emerald-700/75 hover:bg-emerald-50 hover:text-emerald-700",
    idleDark: "text-emerald-100/75 hover:bg-emerald-400/10 hover:text-white",
  },
  amber: {
    lightSolid: "border-amber-200/70 bg-white/96 text-zinc-800 shadow-zinc-200/45 ring-1 ring-amber-200/45",
    lightGlass: "border-amber-200/65 bg-white/86 text-zinc-800 shadow-zinc-200/30 ring-1 ring-amber-200/35 backdrop-blur-2xl",
    darkSolid: "border-amber-400/14 bg-zinc-900/90 text-zinc-100 shadow-black/25 ring-1 ring-white/6",
    darkGlass: "border-amber-400/14 bg-zinc-900/72 text-zinc-100 shadow-black/18 ring-1 ring-amber-300/10 backdrop-blur-2xl",
    activeLight: "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-300/25",
    activeDark: "bg-amber-400/18 text-white shadow-lg shadow-amber-950/16 ring-1 ring-amber-300/18",
    idleLight: "text-amber-700/80 hover:bg-amber-50 hover:text-amber-700",
    idleDark: "text-amber-100/75 hover:bg-amber-400/10 hover:text-white",
  },
};

function getDockSurfaceClasses(preferences: NavigationPreferences) {
  const accent = ACCENT_CLASSES[preferences.accent];
  if (preferences.theme === "light") {
    return preferences.surface === "solid" ? accent.lightSolid : accent.lightGlass;
  }
  return preferences.surface === "solid" ? accent.darkSolid : accent.darkGlass;
}

function getDockItemClasses(preferences: NavigationPreferences, active: boolean) {
  const accent = ACCENT_CLASSES[preferences.accent];
  if (active) {
    return preferences.theme === "light" ? accent.activeLight : accent.activeDark;
  }

  return preferences.theme === "light" ? accent.idleLight : accent.idleDark;
}

export function NavigationDockBar({
  preferences,
  activeItemId = null,
  mobile = false,
  interactive = false,
  className,
}: NavigationDockBarProps) {
  const items = preferences.shortcuts.map((id) => getNavigationAppItem(id));
  const isSidebar = !mobile && preferences.position !== "center";
  const compact = preferences.density === "compact";
  const showLabels = preferences.labels === "always";

  const containerClass = cn(
    "border shadow-2xl",
    getDockSurfaceClasses(preferences),
    isSidebar
      ? cn(
          "flex flex-col rounded-[28px]",
          compact ? "w-[82px] gap-1 p-2" : "w-[92px] gap-1.5 p-2"
        )
      : cn(
          "flex items-center rounded-[30px]",
          mobile
            ? compact
              ? "w-[220px] gap-1 px-2 py-2"
              : "w-[238px] gap-1.5 px-2 py-2"
            : compact
              ? "w-full max-w-[344px] gap-1 px-2 py-2"
              : "w-full max-w-[388px] gap-1.5 px-2 py-2"
        ),
    className
  );

  const itemClass = (active: boolean) =>
    cn(
      "min-w-0 font-medium transition-all",
      getDockItemClasses(preferences, active),
      isSidebar
        ? cn(
            "flex flex-col items-center rounded-[22px]",
            compact ? "gap-1 px-2 py-2 text-[9px]" : "gap-1.5 px-2 py-2.5 text-[10px]"
          )
        : cn(
            "flex flex-1 flex-col items-center rounded-[22px]",
            compact ? "gap-1 px-1 py-1.5 text-[9px]" : "gap-1 px-1.5 py-1.5 text-[10px]"
          )
    );

  const labelClass = cn(
    "truncate text-center leading-tight",
    isSidebar ? "max-w-[62px]" : mobile ? "max-w-[42px]" : "max-w-[76px]"
  );

  return (
    <div id="tour-app-dock" className={containerClass}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeItemId === item.id;
        const content = (
          <>
            <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            {showLabels && <span className={labelClass}>{item.shortLabel}</span>}
          </>
        );

        if (!interactive) {
          return (
            <div key={item.id} className={itemClass(isActive)}>
              {content}
            </div>
          );
        }

        return (
          <Link key={item.id} href={item.href} className={itemClass(isActive)}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
