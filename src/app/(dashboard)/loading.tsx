export default function DashboardRouteLoading() {
  return (
    <div className="p-4 pb-28 md:p-8 md:pb-32" role="status" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-7">
        <div className="space-y-3">
          <div className="h-9 w-64 max-w-full animate-pulse rounded-xl bg-primary/12" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-primary/8" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="app-panel-soft min-h-32 rounded-3xl border border-[color:var(--app-panel-border)] p-5 shadow-sm">
              <div className="h-4 w-28 animate-pulse rounded-full bg-primary/10" />
              <div className="mt-5 h-8 w-36 animate-pulse rounded-xl bg-primary/12" />
              <div className="mt-4 h-3 w-24 animate-pulse rounded-full bg-primary/8" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="app-panel-soft min-h-96 rounded-3xl border border-[color:var(--app-panel-border)] p-6 shadow-sm">
            <div className="h-5 w-44 animate-pulse rounded-full bg-primary/10" />
            <div className="mt-8 h-64 animate-pulse rounded-2xl bg-primary/6" />
          </div>
          <div className="app-panel-soft min-h-96 rounded-3xl border border-[color:var(--app-panel-border)] p-6 shadow-sm">
            <div className="h-5 w-36 animate-pulse rounded-full bg-primary/10" />
            <div className="mt-8 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-2xl bg-primary/6" />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">Carregando página</span>
      </div>
    </div>
  );
}
