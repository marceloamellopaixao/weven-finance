function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-primary/10 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-10 font-sans sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-12%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-14%] right-[-14%] h-[420px] w-[420px] rounded-full bg-primary/6 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="app-panel-soft rounded-3xl border border-[color:var(--app-panel-border)] p-5 text-center shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-6 md:p-8">
          <Pulse className="mx-auto h-12 w-12 rounded-2xl" />
          <Pulse className="mx-auto mt-5 h-7 w-64" />
          <Pulse className="mx-auto mt-4 h-4 w-full max-w-sm" />
          <Pulse className="mx-auto mt-2 h-4 w-3/4" />
          <div className="mt-6 flex justify-center">
            <Pulse className="h-5 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
