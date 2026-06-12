import { cn } from "@/lib/utils";

function AdminPulse({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-full bg-primary/10", className)} />;
}

export function AdminLoadingShell() {
  return (
    <div className="relative min-h-screen overflow-x-hidden p-3 pb-20 font-sans sm:p-4 md:p-6 xl:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-primary/6 blur-[100px]" />
        <div className="absolute bottom-[-12%] left-[-12%] h-[500px] w-[500px] rounded-full bg-primary/4 blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <AdminPulse className="h-9 w-64" />
            <AdminPulse className="h-4 w-72" />
          </div>
          <AdminPulse className="h-11 w-64 rounded-xl" />
        </div>

        <div className="app-panel-subtle grid grid-cols-1 gap-1 rounded-2xl border border-color:var(--app-panel-border) p-1.5 shadow-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "rounded-xl px-6 py-3",
                index === 0 && "app-panel-soft border border-color:var(--app-panel-border)",
              )}
            >
              <AdminPulse className="h-4 w-full" />
            </div>
          ))}
        </div>

        <div className="app-panel-soft overflow-hidden rounded-3xl border border-color:var(--app-panel-border) shadow-xl shadow-primary/10">
          <div className="app-panel-subtle border-b border-color:var(--app-panel-border) px-6 py-5">
            <AdminPulse className="h-5 w-56" />
            <AdminPulse className="mt-3 h-3 w-80" />
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                <AdminPulse className="h-3 w-24" />
                <AdminPulse className="mt-4 h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 p-5 pt-0 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) p-4">
                <div className="flex justify-between gap-4">
                  <div className="space-y-3">
                    <AdminPulse className="h-3 w-28" />
                    <AdminPulse className="h-4 w-44" />
                    <AdminPulse className="h-3 w-56" />
                  </div>
                  <AdminPulse className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
