# API-First Audit (WevenFinance)

Este documento resume a revisao dos arquivos e o estado atual da migracao para API-first.

## Ja em API (`src/app/api/*`)

- `GET /api/billing/checkout-link`
- `POST /api/billing/confirm-preapproval`
- `POST /api/billing/cancel-subscription`
- `POST /api/account/delete`
- `GET/PUT /api/profile/me`
- `POST /api/profile/bootstrap`
- `POST /api/profile/verify-email`
- `GET/PATCH/POST /api/admin/users`
- `GET/POST /api/mercadopago/webhook`
- `GET /api/docs` (OpenAPI JSON)
- `GET /swagger` (Swagger UI)
- `GET/POST/PATCH/DELETE /api/transactions`
- `GET/PUT /api/user-settings/finance`
- `GET/POST/PATCH/DELETE /api/support-requests`
- `GET/PUT /api/system/plans`

## Ainda direto no client (Firestore SDK)

Nenhum acesso direto ao Firestore identificado em `src/app`, `src/hooks` e `src/services` (fora da camada `src/services/firebase/*` e backend `src/app/api/*`).

## Prioridade de migracao recomendada

1. Categorias
- Status: concluido.
- Rotas: `GET/POST/PATCH/DELETE /api/categories` e `POST /api/categories/default-visibility`.

2. Transações
- Status: concluido.
- Rotas: `GET/POST/PATCH/DELETE /api/transactions`.

3. Suporte / chamados
- Status: concluido.
- Rotas: `GET/POST/PATCH/DELETE /api/support-requests`.

4. Perfil / usuários
- Status: concluido.
- Rotas: `GET/PUT /api/profile/me`, `POST /api/profile/bootstrap`, `POST /api/profile/verify-email`, `GET/PATCH/POST /api/admin/users`.

5. Configurações de sistema
- Status: concluido.
- Rotas: `GET/PUT /api/system/plans`.

## Beneficios apos conclusao

- Regras de negocio centralizadas (fonte unica da verdade).
- Menor risco de `Missing or insufficient permissions` no frontend.
- Melhor auditoria e observabilidade (eventos e logs server-side).
- Swagger completo para equipe (admin, suporte, dev).
