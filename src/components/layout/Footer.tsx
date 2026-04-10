"use client";

import { Wallet, Instagram, Linkedin } from "lucide-react";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-transparent transition-colors duration-300">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-600 p-1.5">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Weven<span className="text-violet-600">Finance</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Transformando a maneira como você lida com suas finanças. Simples, seguro e eficiente.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Produto</h3>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/#pricing" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Preços</Link></li>
              <li><Link href="/#features" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Funcionalidades</Link></li>
              <li><Link href="/security" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Segurança</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Empresa</h3>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="https://weven.tech" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Sobre Nós</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Contato</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-violet-600 dark:hover:text-violet-400">Termos de Uso</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Siga-nos</h3>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/weventech/" target="_blank" className="text-zinc-400 transition-colors hover:text-violet-600 dark:hover:text-violet-400"><Instagram className="h-5 w-5" /></a>
              <a href="https://www.linkedin.com/company/weventech/" target="_blank" className="text-zinc-400 transition-colors hover:text-blue-700"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-100 pt-8 md:flex-row dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            © {currentYear} WevenFinance. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Desenvolvido para sua liberdade.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
