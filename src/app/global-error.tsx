"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    let cancelled = false;

    void import("@sentry/nextjs")
      .then((Sentry) => {
        if (!cancelled) {
          Sentry.captureException(error);
        }
      })
      .catch(() => {
        // Ignore capture errors in the error boundary itself.
      });

    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4 text-center">
            <h1 className="text-xl font-bold text-zinc-900">Erro inesperado</h1>
            <p className="text-sm text-zinc-600">
              Ocorreu uma falha. Nossa equipe foi notificada automaticamente.
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
