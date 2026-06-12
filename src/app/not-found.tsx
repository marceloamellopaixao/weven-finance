"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, MoveLeft, FileQuestion } from "lucide-react";
import { useTranslations } from "@/i18n/T";

export default function NotFound() {
  const t = useTranslations("errors");
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-4 font-sans">
      <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className={`${zoomIn} rounded-3xl border border-zinc-100 bg-white p-4 shadow-xl shadow-primary/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-primary/10`}>
            <div className="rounded-2xl bg-primary/10 p-4">
              <FileQuestion className="h-10 w-10 text-primary" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className={`${fadeInUp} delay-150 text-8xl font-black tracking-tighter text-zinc-900 opacity-10 select-none dark:text-white dark:opacity-20`}>
            404
          </h1>

          <div className={`${fadeInUp} delay-200 relative z-20 -mt-10`}>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {t("notFound.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t("notFound.description")}
            </p>
          </div>
        </div>

        <div className={`${fadeInUp} delay-300 flex flex-col gap-3`}>
          <Link href="/" className="w-full">
            <Button className="h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:cursor-pointer hover:bg-primary/90 active:scale-[0.98]">
              <MoveLeft className="mr-2 h-4 w-4" /> {t("notFound.backHome")}
            </Button>
          </Link>

          <Link href="/dashboard" className="w-full">
            <Button variant="ghost" className="h-12 w-full rounded-xl text-zinc-500 transition-all duration-200 hover:cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              {t("notFound.goDashboard")}
            </Button>
          </Link>
        </div>

        <div className={`${fadeInUp} delay-500 flex items-center justify-center gap-2 pt-8 opacity-50`}>
          <Wallet className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-400">WevenFinance</span>
        </div>
      </div>
    </div>
  );
}
