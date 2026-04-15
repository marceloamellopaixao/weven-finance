"use client";

import { Instagram, Linkedin, Wallet } from "lucide-react";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-transparent transition-colors duration-300">
      <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-1.5 text-primary-foreground shadow-lg shadow-primary/15">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-foreground">
                Weven<span className="text-primary">Finance</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Transformando a maneira como você lida com suas finanças. Simples, seguro e eficiente.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Produto</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#pricing" className="transition-colors hover:text-primary">Preços</Link></li>
              <li><Link href="/#features" className="transition-colors hover:text-primary">Funcionalidades</Link></li>
              <li><Link href="/security" className="transition-colors hover:text-primary">Segurança</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Empresa</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="https://weven.tech" className="transition-colors hover:text-primary">Sobre Nós</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-primary">Contato</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-primary">Termos de Uso</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Siga-nos</h3>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/weventech/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary"><Instagram className="h-5 w-5" /></a>
              <a href="https://www.linkedin.com/company/weventech/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-8 text-center md:flex-row md:text-left">
          <p className="text-xs text-muted-foreground">
            © {currentYear} WevenFinance. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Desenvolvido para sua liberdade.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
