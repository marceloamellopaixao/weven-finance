import { LoaderCircle } from "lucide-react";

export function AppBootLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground" role="status" aria-live="polite">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-2xl font-black text-primary-foreground shadow-xl shadow-primary/20">
          W
        </div>
        <p className="mt-5 text-lg font-bold">WevenFinance</p>
        <p className="mt-1 text-sm text-muted-foreground">Preparando seu espaço financeiro...</p>
        <LoaderCircle
          className="mx-auto mt-5 h-7 w-7 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">Carregando aplicação</span>
      </div>
    </main>
  );
}
