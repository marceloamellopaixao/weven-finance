# Plano Foundation

O plano comercial **Foundation** mantém o identificador interno `founder` para preservar compatibilidade com perfis, regras e eventos já existentes.

## Regras

- Perfil próprio do tipo Pessoal.
- R$ 9,90 por mês durante 12 cobranças mensais.
- Mesmas capacidades do plano Pro durante a vigência.
- Oferta limitada por `FOUNDATION_PLAN_MAX_USERS` (padrão: 30).
- Uma reserva de checkout expira após 24 horas; uma adesão confirmada ocupa definitivamente uma posição da campanha.
- Após as 12 cobranças, o cliente deve escolher Premium ou Pro. Não há renovação automática da oferta Foundation.

## Variáveis

```env
NEXT_PUBLIC_FOUNDATION_PLAN_ACTIVE=true
FOUNDATION_PLAN_MAX_USERS=30
MERCADOPAGO_PLAN_FOUNDATION_ID=
```

Os nomes legados `NEXT_PUBLIC_FOUNDER_PLAN_ACTIVE` e `MERCADOPAGO_PLAN_FOUNDER_ID` continuam aceitos durante a transição.

## Mercado Pago

Crie o plano como cobrança mensal, no valor de R$ 9,90, com duração limitada a **12 recorrências** e retorno para a rota pública de ativação. O servidor valida a quantidade de recorrências antes de abrir o checkout.

Antes de ativar a oferta, aplique `supabase/schema.sql`, `supabase/indexes.sql` e `supabase/rls.sql`. A função `claim_foundation_plan_slot` reserva as posições de forma atômica para impedir que checkouts simultâneos ultrapassem o limite.
