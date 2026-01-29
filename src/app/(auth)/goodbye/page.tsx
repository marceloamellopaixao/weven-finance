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
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header Visual */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-xl">
            <ShieldCheck className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Conta Encerrada
          </h1>
          <p className="text-lg text-zinc-500 max-w-lg mx-auto">
            Sua conta foi excluída com sucesso. O acesso ao painel foi revogado imediatamente.
          </p>
        </div>

        {/* Card Informativo */}
        <Card className="border-2 border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="h-5 w-5 text-violet-500" />
              Política de Retenção de Dados
            </CardTitle>
            <CardDescription>
              Para sua segurança e conformidade, seus dados financeiros foram arquivados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20">
                <ArchiveRestore className="h-6 w-6 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-violet-900 dark:text-violet-200">
                    Recuperar Conta com Histórico
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    Caso decida voltar, é possível <strong>restaurar seus dados</strong> antigos (lançamentos, categorias). Entre em contato com o suporte para solicitar a recuperação do arquivo.
                    <span className="block mt-1 font-medium text-violet-700 dark:text-violet-300">
                      *Taxa de recuperação de dados aplicável.
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-200">
                    Iniciar Nova Conta
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    Você pode retornar a qualquer momento criando uma nova assinatura limpa, sem custos de recuperação de dados, pagando apenas a mensalidade do plano.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 p-6 flex flex-col md:flex-row justify-between gap-4 items-center">
            <p className="text-xs text-center md:text-left text-zinc-500 italic">
              Precisa de ajuda? Fale com nosso suporte.
            </p>
            <div className="flex gap-3 w-full md:w-auto">
              <Link href="/" className="w-full md:w-auto">
                <Button className="w-full gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800">
                  <Home className="h-4 w-4" />
                  Ir para Início
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}