# Funil de produto e receita

O WevenFinance registra eventos próprios em `product_events`, sem SDK externo e sem cookie persistente. Eventos anônimos usam apenas um UUID temporário em `sessionStorage`; propriedades são limitadas a valores primitivos, nomes permitidos e comprimentos reduzidos.

## Eventos

- `landing_viewed` e `pricing_viewed`
- `billing_interval_selected` e `plan_selected`
- `registration_started` e `registration_completed`
- `checkout_started`, `checkout_redirected`, `checkout_completed` e `checkout_failed`

O endpoint `POST /api/analytics/events` possui allowlist e rate limit. Falhas de analytics retornam `202` e nunca bloqueiam cadastro ou checkout.

## Métricas

`GET /api/admin/metrics` inclui contagem de sessões por etapa, conversão landing → cadastro e cadastro → checkout. O acesso continua protegido por `admin.metrics.read`.

Para habilitar o armazenamento, aplique `supabase/schema.sql`, `supabase/indexes.sql` e `supabase/rls.sql`. A tabela não permite escrita direta pelo client; gravações passam pela rota server-side.

## Regras de privacidade

Não envie e-mail, telefone, nome, token, saldo, descrição de transação, cartão ou qualquer payload financeiro em `properties`. Eventos associados a um usuário são removidos pelo fluxo de exclusão permanente quando possuem `uid`.

## Operação de billing

`MERCADOPAGO_WEBHOOK_SECRET` é obrigatório. Sem ele, webhooks são rejeitados. O checkout envia ao Mercado Pago o preço e a periodicidade resolvidos pela configuração de planos do sistema.

Para testar com contas de teste sem substituir o e-mail real do perfil, configure apenas no ambiente de desenvolvimento:

```env
MERCADOPAGO_TEST_MODE=true
MERCADOPAGO_TEST_PAYER_EMAIL=EMAIL_DA_CONTA_COMPRADORA_DE_TESTE
```

O e-mail deve pertencer a uma conta de teste do tipo Comprador e ao mesmo país da conta de teste Vendedor. Em produção, remova as duas variáveis ou defina `MERCADOPAGO_TEST_MODE=false`.
