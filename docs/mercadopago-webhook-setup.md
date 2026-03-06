# MercadoPago Webhook + Fonte da Verdade do Plano

Este projeto agora usa o webhook do MercadoPago como fonte da verdade para `plan` e `paymentStatus`.

## 1) Variaveis de ambiente

Crie/atualize `.env.local` com:

```env
# Firebase client (ja usado no front)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase admin (backend)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Opcional alternativa unica:
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Opcional: mapeamento explicito de plano por preapproval_plan_id
MERCADOPAGO_PLAN_PRO_ID=
MERCADOPAGO_PLAN_PREMIUM_ID=
```

## 2) Configurar credenciais MercadoPago

1. Entre no painel MercadoPago Developers.
2. Copie o `Access Token` da aplicacao (teste e producao em ambientes separados).
3. Cole em `MERCADOPAGO_ACCESS_TOKEN`.

## 3) Configurar webhook no MercadoPago

1. URL do webhook:
   - Local com tunnel: `https://SEU_TUNNEL/api/mercadopago/webhook`
   - Producao: `https://SEU_DOMINIO/api/mercadopago/webhook`
2. Eventos recomendados:
   - `payment`
   - `preapproval`
   - `merchant_order`
3. Copie a chave de assinatura (webhook secret) para `MERCADOPAGO_WEBHOOK_SECRET`.

## 4) Como o vinculo com usuário funciona

O checkout e gerado por `GET /api/billing/checkout-link?plan=pro|premium` e inclui:

- `external_reference=uid:{UID}|plan:{PLAN}`
- `client_reference_id={UID}`
- `payer_email={EMAIL}`

No webhook, o backend tenta localizar usuário por:

1. `external_reference` (preferencial)
2. `payer_email` (fallback)

## 5) Fonte da verdade no Firestore

Quando webhook chega:

- Atualiza `users/{uid}` com:
  - `plan`
  - `paymentStatus`
  - `billing.*` (source, status gateway, ids, ultimo sync)
- Registra auditoria em:
  - `billing_events/{topic}_{resourceId}`

## 6) Como ADMIN e USUARIO validam status

- Usuário: `Configurações > Planos`
  - Mostra origem (`Webhook Mercado Pago` ou `Administracao manual`)
  - Mostra ultima sincronizacao
- Admin: tabela de usuários
  - Mostra `Fonte: Webhook MP` ou `Fonte: Manual`
  - Mostra data de `Sync`

## 6.1) Automacoes de status (novo)

No processamento do webhook:

- `paymentStatus = paid`:
  - atualiza `plan` para o plano pago
  - reativa conta (`status = active`) se estava `blocked/inactive` por motivo de pagamento
- `paymentStatus = overdue | not_paid | canceled`:
  - rebaixa `plan` para `free` quando aplicavel
  - bloqueia conta ativa com motivo automatico

Observacao: contas `deleted` não sao reativadas automaticamente.

## 6.2) Regras por cargo

- `admin` e `moderator`:
  - isentos de cobranca
  - não recebem bloqueio por inadimplencia no webhook
  - checkout de pagamento retorna `role_billing_exempt`
- `support`:
  - não isento
  - segue regra de plano como usuário comum (limite do plano free: 20)

## 7) Fluxo recomendado de operacao

1. Usuário clica em upgrade (dashboard/configurações).
2. Front chama `/api/billing/checkout-link`.
3. Usuário paga no MercadoPago.
4. MercadoPago notifica `/api/mercadopago/webhook`.
5. Backend sincroniza Firestore.
6. UI atualiza em tempo real via snapshot de `users/{uid}`.

## 8) Teste rapido local

1. Rode `npm run dev`.
2. Exponha local com ngrok/cloudflared.
3. Configure webhook no MercadoPago para URL publica do tunnel.
4. Execute um pagamento de teste.
5. Verifique:
   - documento `users/{uid}` atualizado
   - documento em `billing_events`
   - badges/status no Admin e Settings
