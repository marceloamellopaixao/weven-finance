# WevenFinance - E2E Billing Test Plan

Roteiro objetivo para validar fluxo completo de assinatura.

## Pre-condicoes

1. Deploy em producao ativo na Vercel.
2. Webhook Mercado Pago configurado para:
   - `https://SEU_DOMINIO/api/mercadopago/webhook`
3. Variaveis Mercado Pago e Firebase configuradas na Vercel.
4. Firestore rules publicadas.

## Cenario A - Upgrade Premium com PIX

1. Criar conta nova (role `client`) e logar.
2. Ir em `/settings`, abrir aba Planos.
3. Clicar `Fazer Upgrade Premium`.
4. Confirmar retorno:
   - `GET /api/billing/checkout-link?plan=premium` = `200`.
5. No checkout MP, escolher PIX e pagar.
6. Aguardar webhook (ate ~60s).
7. Confirmar no Firestore `users/{uid}`:
   - `plan = premium`
   - `paymentStatus = paid`
   - `billing.provider = mercadopago`
   - `billing.preapprovalId` preenchido
8. Voltar ao app `/settings`:
   - status do plano deve aparecer como ativo.

## Cenario B - Upgrade Pro com cartao

1. Repetir fluxo para plano Pro.
2. Confirmar no Firestore:
   - `plan = pro`
   - `paymentStatus = paid`
3. Verificar que features de Pro ficam disponiveis.

## Cenario C - Confirmacao fallback pos-checkout

Objetivo: validar robustez quando retorno do checkout nao volta automaticamente ao app.

1. Finalizar pagamento no MP sem voltar para o site.
2. No app, acionar confirmacao manual (endpoint):
   - `POST /api/billing/confirm-preapproval`
3. Esperado:
   - API retorna `ok: true`.
   - Plano em `users/{uid}` atualizado para pago.

## Cenario D - Cancelamento de assinatura

1. Usuario com plano pago abre `/settings`.
2. Clicar em `Cancelar Assinatura` e confirmar no modal.
3. Esperado:
   - `POST /api/billing/cancel-subscription` = `200`
   - `users/{uid}`:
     - `plan = free`
     - `paymentStatus = canceled`
4. Validar UI refletindo cancelamento.

## Cenario E - Regras de cargos

1. Usuario `admin` e `moderator`:
   - chamar checkout-link deve retornar `409 role_billing_exempt`.
2. Usuario `support`:
   - validar regra de limite do plano padrao (20).
   - acima do limite, deve exigir plano pago (fluxo do produto).

## Cenario F - Webhook de teste

1. No Mercado Pago, usar simulador de notificacao.
2. Esperado:
   - endpoint retorna `200` ou `202` (quando evento simulado sem resource valido).
3. Em `billing_events`, validar log com `status` coerente.

## Queries de verificacao (Firestore)

- `users/{uid}`:
  - `plan`, `paymentStatus`, `billing.*`, `role`, `status`
- `billing_events/*`:
  - `topic`, `resourceId`, `status`, `acceptedAt`, `error`

## Criterio de aceite

- Upgrade e cancelamento refletem no app e no Firestore sem intervencao manual.
- Admin/moderator nao passam por cobranca.
- Webhook e confirmacao fallback mantem consistencia do plano.
- `/swagger` e `/api/docs` atualizados com as rotas de billing.

