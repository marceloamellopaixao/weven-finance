# Observabilidade: Sentry + Logs + Métricas

## 1) Dependência

Já instalada no projeto:

```bash
npm i @sentry/nextjs
```

## 2) Variáveis de ambiente

Adicione no `.env.local` e na Vercel (Project Settings > Environment Variables):

```env
SENTRY_ENABLED=true
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1
APP_ENV=production
NEXT_PUBLIC_APP_ENV=production
```

Observação:
- `SENTRY_DSN` é usado no servidor/API.
- `NEXT_PUBLIC_SENTRY_DSN` é usado no front.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` permitem sourcemaps na build.

## 3) Arquivos de integração

Foram adicionados:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- `src/app/global-error.tsx`

E atualizado:
- `next.config.ts` com `withSentryConfig(...)`.

## 4) O que já está monitorado

- Erros globais de front (`global-error.tsx`).
- Erros de API via `apiLogger.error(...)` com envio para Sentry quando houver `meta.error`.
- Métricas de API salvas em `api_request_metrics`:
  - latência por rota
  - status HTTP
  - erro por rota
  - rate limit por rota
- Painel operacional:
  - `/api/admin/health`
  - `/api/admin/metrics`

## 5) Alertas recomendados no Sentry

Crie alertas para:
- Aumento de erro 5xx por minuto.
- Aumento de latência p95 por rota.
- Erros de billing/webhook (`mercadopago_webhook`).
- Erros em `support_requests` e `admin_*`.

## 6) Teste rápido

1. Rode local:
```bash
npm run dev
```
2. Gere um erro proposital no front (throw) e em uma API.
3. Verifique no Sentry se os eventos chegaram.

