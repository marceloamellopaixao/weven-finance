function SettingsLoadingCard({
  lines = 3,
  tall = false,
}: {
  lines?: number;
  tall?: boolean;
}) {
  return (
    <div className={`app-panel-soft rounded-3xl border border-[color:var(--app-panel-border)] p-6 shadow-lg ${tall ? "min-h-[420px]" : ""}`}>
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-primary/12" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-primary/12" />
          <div className="h-3 w-48 animate-pulse rounded-full bg-primary/8" />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="app-panel-subtle rounded-2xl border border-[color:var(--app-panel-border)] p-4">
            <div className="h-4 w-28 animate-pulse rounded-full bg-primary/10" />
            <div className="mt-3 h-10 w-full animate-pulse rounded-xl bg-primary/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="font-sans p-4 md:p-8 pb-28 md:pb-32">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-9 w-56 animate-pulse rounded-full bg-primary/12" />
            <div className="h-4 w-72 animate-pulse rounded-full bg-primary/8" />
          </div>
          <div className="h-11 w-40 animate-pulse rounded-xl bg-red-500/12" />
        </div>

        <div className="app-panel-subtle grid w-full grid-cols-1 gap-1 rounded-2xl border border-[color:var(--app-panel-border)] p-1.5 shadow-sm sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`rounded-xl px-4 py-3 ${index === 0 ? "app-panel-soft border border-[color:var(--app-panel-border)]" : ""}`}
            >
              <div className="h-4 w-24 animate-pulse rounded-full bg-primary/10" />
            </div>
          ))}
        </div>

        <div className="grid gap-6">
          <SettingsLoadingCard lines={4} tall />

          <div className="grid gap-6 md:grid-cols-2">
            <SettingsLoadingCard lines={3} />
            <SettingsLoadingCard lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
