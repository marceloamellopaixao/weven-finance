function PulseBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-primary/10 ${className}`} />;
}

function PulsePanel({ className = "" }: { className?: string }) {
  return (
    <div className={`app-panel-soft rounded-[30px] border border-[color:var(--app-panel-border)] p-6 shadow-lg ${className}`}>
      <PulseBlock className="h-5 w-28" />
      <PulseBlock className="mt-5 h-8 w-3/4" />
      <PulseBlock className="mt-3 h-4 w-full" />
      <PulseBlock className="mt-2 h-4 w-2/3" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="app-panel-soft overflow-hidden rounded-4xl border border-[color:var(--app-panel-border)] p-6 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 md:p-8">
          <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
            <div>
              <PulseBlock className="h-7 w-44" />
              <PulseBlock className="mt-6 h-11 w-4/5" />
              <PulseBlock className="mt-4 h-4 w-full max-w-2xl" />
              <PulseBlock className="mt-2 h-4 w-2/3" />
              <div className="mt-6 flex gap-3">
                <PulseBlock className="h-11 w-44 rounded-2xl" />
                <PulseBlock className="h-11 w-36 rounded-2xl" />
              </div>
            </div>
            <div className="app-panel-subtle rounded-[28px] border border-[color:var(--app-panel-border)] p-5">
              <div className="flex items-center gap-3">
                <PulseBlock className="h-12 w-12 rounded-2xl" />
                <div className="flex-1">
                  <PulseBlock className="h-4 w-28" />
                  <PulseBlock className="mt-2 h-3 w-40" />
                </div>
              </div>
              <PulseBlock className="mt-6 h-20 w-full rounded-2xl" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
          <PulsePanel className="min-h-[320px]" />
          <div className="app-panel-soft rounded-[30px] border border-[color:var(--app-panel-border)] p-6 shadow-lg">
            <PulseBlock className="h-6 w-48" />
            <PulseBlock className="mt-3 h-4 w-2/3" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="app-panel-subtle rounded-3xl border border-[color:var(--app-panel-border)] p-4">
                  <div className="flex gap-4">
                    <PulseBlock className="h-4 w-4 rounded-lg" />
                    <PulseBlock className="h-12 w-12 rounded-2xl" />
                    <div className="flex-1">
                      <PulseBlock className="h-4 w-32" />
                      <PulseBlock className="mt-3 h-3 w-full" />
                      <PulseBlock className="mt-2 h-3 w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <PulsePanel key={index} />
          ))}
        </section>
      </div>
    </div>
  );
}
