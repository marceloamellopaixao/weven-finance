# WevenFinance - Vercel Deploy Checklist

Este checklist cobre deploy de producao com Firebase + Mercado Pago + Webhook.

## 1) Variaveis de ambiente obrigatorias (Vercel)

Defina em `Project Settings > Environment Variables` para `Production` (e `Preview` se quiser testar):

### Frontend Firebase (`NEXT_PUBLIC_*`)

- `NEXT_PUBLIC_APP_URL`  
  Exemplo: `https://wevenfinance.com.br`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin (server only)

Escolha **uma** forma:

- Opcao A (recomendada): `FIREBASE_SERVICE_ACCOUNT_KEY` com JSON completo do service account
- Opcao B: campos separados
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (com `\\n` no lugar das quebras de linha)

### Mercado Pago (server only)

- `MERCADOPAGO_ACCESS_TOKEN` (token de producao da conta vendedora)
- `MERCADOPAGO_WEBHOOK_SECRET` (secret do webhook no painel)
- `MERCADOPAGO_PLAN_PREMIUM_ID` (ID do plano de assinatura Premium)
- `MERCADOPAGO_PLAN_PRO_ID` (ID do plano de assinatura Pro)

## 2) Marketplace/planos no Mercado Pago

No painel do Mercado Pago:

1. Crie os planos de assinatura (Premium e Pro).
2. Copie os `preapproval_plan_id` para:
   - `MERCADOPAGO_PLAN_PREMIUM_ID`
   - `MERCADOPAGO_PLAN_PRO_ID`
3. Em Webhooks, configure URL:
   - `https://SEU_DOMINIO/api/mercadopago/webhook`
4. Copie o secret e salve em `MERCADOPAGO_WEBHOOK_SECRET`.

## 3) Deploy de regras Firestore

Se as rules estiverem no arquivo local `firestore.rules`, publique com Firebase CLI:

```bash
firebase login
firebase use <seu-project-id>
firebase deploy --only firestore:rules
```

## 4) Validacao rapida apos deploy

### Swagger / API docs

1. Abrir `https://SEU_DOMINIO/swagger`
2. Abrir `https://SEU_DOMINIO/api/docs`
3. Confirmar que rotas de billing/profile/admin aparecem.

### Billing API

1. Logar como usuario `client`.
2. Ir em `/settings` > Planos.
3. Clicar upgrade.
4. Verificar no browser/network:
   - `GET /api/billing/checkout-link?plan=premium` -> `200`.
5. Finalizar pagamento no Mercado Pago.
6. Verificar webhook:
   - `POST /api/mercadopago/webhook` -> `200`.
7. Verificar no Firestore:
   - `users/{uid}` com `plan= premium/pro` e `paymentStatus=paid`.

## 5) Regras de negocio esperadas

- `admin` e `moderator` sao isentos de pagamento:
  - endpoint `checkout-link` deve retornar `409 role_billing_exempt`.
- `support` segue regra de limite configurado (plano free com limite).
- Fonte da verdade do plano: documento `users/{uid}` atualizado por webhook/confirmacao.

## 6) Troubleshooting rapido

- `Missing MERCADOPAGO_ACCESS_TOKEN`:
  - token nao configurado na Vercel.
- `invalid_signature` no webhook:
  - `MERCADOPAGO_WEBHOOK_SECRET` incorreto ou webhook sem header de assinatura.
- Timeout em simulacao do MP:
  - endpoint deve responder rapido; verificar logs do Vercel function.
- `Missing or insufficient permissions` no client:
  - publicar `firestore.rules` novamente e validar role/status do usuario.

