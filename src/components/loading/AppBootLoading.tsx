export function AppBootLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground" role="status" aria-live="polite">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-2xl font-black text-primary-foreground shadow-xl shadow-primary/20">
          W
        </div>
        <p className="mt-5 text-lg font-bold">WevenFinance</p>
        <p className="mt-1 text-sm text-muted-foreground">Preparando seu espaço financeiro...</p>
        <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-primary/10">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
        <span className="sr-only">Carregando aplicação</span>
      </div>
    </main>
  );
}
