"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, MoveLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-400 dark:bg-zinc-950 p-4 relative overflow-hidden font-sans">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo / Icone */}
        <div className="flex justify-center">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-xl shadow-violet-200/50 dark:shadow-violet-900/20 border border-zinc-100 dark:border-zinc-800">
             <div className="bg-violet-100 dark:bg-violet-900/30 p-4 rounded-2xl">
                <FileQuestion className="h-10 w-10 text-violet-600 dark:text-violet-400" />
             </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-8xl font-black text-zinc-900 dark:text-white tracking-tighter opacity-10 dark:opacity-20 select-none">
            404
          </h1>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 -mt-10">
            Página não encontrada
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs mx-auto">
            Opa! Parece que você se perdeu no fluxo financeiro. A página que você está procurando não existe ou foi movida.
          </p>
        </div>

        <div className="flex flex-col gap-3">
            <Link href="/">
              <Button className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-lg shadow-violet-500/20 transition-all active:scale-[0.98]">
                <MoveLeft className="mr-2 h-4 w-4" /> Voltar para o Início
              </Button>
            </Link>
            
            <Link href="/">
               <Button variant="ghost" className="w-full h-12 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                 Ir para Dashboard
               </Button>
            </Link>
        </div>

        <div className="pt-8 flex items-center justify-center gap-2 opacity-50">
           <Wallet className="h-4 w-4 text-zinc-400" />
           <span className="text-xs font-semibold text-zinc-400">Weven Finance</span>
        </div>

      </div>
    </div>
  );
}