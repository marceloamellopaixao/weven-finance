"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, MoveLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-4 font-sans">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        
        {/* Logo / Icone */}
        <div className="flex justify-center">
          <div className={`${zoomIn} rounded-3xl border border-zinc-100 bg-white p-4 shadow-xl shadow-primary/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-primary/10`}>
             <div className="rounded-2xl bg-primary/10 p-4">
                <FileQuestion className="h-10 w-10 text-primary" />
             </div>
          </div>
        </div>

        <div className="space-y-2">
          {/* 404 Gigante */}
          <h1 className={`${fadeInUp} delay-150 text-8xl font-black text-zinc-900 dark:text-white tracking-tighter opacity-10 dark:opacity-20 select-none`}>
            404
          </h1>
          
          {/* Título e Texto - Margem negativa para sobrepor visualmente o 404 */}
          <div className={`${fadeInUp} delay-200 -mt-10 relative z-20`}>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Página não encontrada
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs mx-auto mt-2 leading-relaxed">
              Opa! Parece que você se perdeu no fluxo financeiro. A página que você está procurando não existe ou foi movida.
            </p>
          </div>
        </div>

        <div className={`${fadeInUp} delay-300 flex flex-col gap-3`}>
            <Link href="/" className="w-full">
              <Button className="h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:cursor-pointer hover:bg-primary/90 active:scale-[0.98]">
                <MoveLeft className="mr-2 h-4 w-4" /> Voltar para o Início
              </Button>
            </Link>
            
            <Link href="/dashboard" className="w-full">
               <Button variant="ghost" className="w-full h-12 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:cursor-pointer transition-all duration-200">
                 Ir para Dashboard
               </Button>
            </Link>
        </div>

        <div className={`${fadeInUp} delay-500 pt-8 flex items-center justify-center gap-2 opacity-50`}>
           <Wallet className="h-4 w-4 text-zinc-400" />
           <span className="text-xs font-semibold text-zinc-400">WevenFinance</span>
        </div>

      </div>
    </div>
  );
}
