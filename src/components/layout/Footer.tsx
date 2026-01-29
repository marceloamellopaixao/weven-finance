"use client";

import { Wallet, Instagram, Linkedin } from "lucide-react";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-colors duration-300">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Coluna 1: Marca */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="bg-violet-600 p-1.5 rounded-lg">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                Weven<span className="text-violet-600">Finance</span>
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Transformando a maneira como você lida com suas finanças. Simples, seguro e eficiente.
            </p>
          </div>

          {/* Coluna 2: Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Produto</h3>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/#pricing" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Preços</Link></li>
              <li><Link href="/#features" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Funcionalidades</Link></li>
              <li><Link href="/security" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Segurança</Link></li>
            </ul>
          </div>

          {/* Coluna 3: Empresa */}
          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Empresa</h3>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="https://weven.tech" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Sobre Nós</Link></li>
              <li><Link href="/contact" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Contato</Link></li>
              <li><Link href="/terms" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Termos de Uso</Link></li>
            </ul>
          </div>

          {/* Coluna 4: Social */}
          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Siga-nos</h3>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/weventech/" target="_blank" className="text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"><Instagram className="h-5 w-5" /></a>
              <a href="https://www.linkedin.com/company/weventech/" target="_blank" className="text-zinc-400 hover:text-blue-700 transition-colors"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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