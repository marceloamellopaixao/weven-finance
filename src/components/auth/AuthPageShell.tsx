"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthPageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
};

export function AuthPageShell({
  children,
  className,
  contentClassName,
  maxWidthClassName = "max-w-[440px]",
}: AuthPageShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-x-hidden px-4 py-8 font-sans sm:px-6 sm:py-12",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-14%] top-[-14%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[110px]" />
        <div className="absolute bottom-[-16%] right-[-14%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-[90px]" />
      </div>

      <div className={cn("relative z-10 w-full", maxWidthClassName, contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export const authPanelClassName =
  "app-panel-soft rounded-3xl border border-[color:var(--app-panel-border)] p-5 shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-6 md:p-8";

export const authIconClassName =
  "inline-flex items-center justify-center rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20";
