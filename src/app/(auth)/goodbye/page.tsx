"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArchiveRestore, CheckCircle2, History, ShieldCheck, Home } from "lucide-react";

export default function GoodbyePage() {
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-8">

      {/* Header Visual */}
      <div className="text-center space-y-4 w-full">
        <div className={`${zoomIn} mx-auto w-16 h-16 md:w-24 md:h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-xl`}>
          <ShieldCheck className="w-8 h-8 md:w-12 md:h-12 text-emerald-600" />
        </div>

        <div className={`${fadeInUp} space-y-3 delay-150`}>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Conta Encerrada
          </h1>
          <p className="text-base md:text-lg text-zinc-500 max-w-xs md:max-w-lg mx-auto leading-relaxed">
            Sua conta foi excluída com sucesso e o acesso ao painel foi revogado.
          </p>
        </div>
      </div>

      {/* Card Informativo */}
      <Card className={`${fadeInUp} delay-300 w-full border border-zinc-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900 overflow-hidden`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <History className="h-5 w-5 text-violet-500 shrink-0" />
            Política de Retenção
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            Para sua segurança e conformidade, seus dados financeiros foram arquivados temporariamente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Item 1 */}
          <div className={`${fadeInUp} delay-500 flex items-start gap-3 p-3 md:p-4 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20`}>
            <ArchiveRestore className="h-5 w-5 md:h-6 md:w-6 text-violet-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm md:text-base text-violet-900 dark:text-violet-200">
                Recuperar Conta com Histórico
              </h3>
              <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                É possível <strong>restaurar seus dados</strong> antigos. <br />Entre em contato com o suporte.
                <span className="block mt-1 font-medium text-violet-700 dark:text-violet-300">
                  *Taxa de recuperação aplicável.
                </span>
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className={`${fadeInUp} delay-700 flex items-start gap-3 p-3 md:p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800`}>
            <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm md:text-base text-zinc-900 dark:text-zinc-200">
                Iniciar Nova Conta
              </h3>
              <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                Retorne a qualquer momento criando uma assinatura limpa, sem custos de recuperação.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 p-4 md:p-6 flex flex-col md:flex-row justify-between gap-4 items-center">
          <p className="text-xs text-center md:text-left text-zinc-500 italic order-2 md:order-1">
            Precisa de ajuda? Fale com nosso suporte.
          </p>
          <div className="w-full md:w-auto order-1 md:order-2">
            <Link href="/" className="w-full block">
              <Button className="w-full md:w-auto gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 transition-all shadow-sm">
                <Home className="h-4 w-4" />
                Ir para Início
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}