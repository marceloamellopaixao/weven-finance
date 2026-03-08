# Migracao Firebase -> Supabase (WevenFinance)

Este guia transfere os dados atuais do Firestore para Supabase sem quebrar o app agora.

## 1) Objetivo da fase atual

- Migrar dados para Supabase (Postgres) para reduzir risco de `RESOURCE_EXHAUSTED`.
- Manter login atual no Firebase temporariamente.
- Preparar base para migrar API/Realtime/Auth por etapas sem downtime.

## 2) O que foi adicionado no projeto

- Schema SQL: [supabase/schema.sql](/c:/Users/MarceloAmp/Documents/Arquivos/My Company/projetos/weven-finance/supabase/schema.sql)
- Script de migracao: [scripts/migrate/firebase-to-supabase.mjs](/c:/Users/MarceloAmp/Documents/Arquivos/My Company/projetos/weven-finance/scripts/migrate/firebase-to-supabase.mjs)
- Comando npm: `npm run db:migrate:firebase-supabase`

## 3) Variaveis de ambiente necessarias

No `.env.local`, configure:

```env
# Firebase Admin (ja usado no projeto)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
# ou FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY

# Supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY
SUPABASE_READS_ENABLED=true
SUPABASE_WRITES_ENABLED=true
```

Onde pegar:
- Supabase Dashboard -> `Project Settings` -> `API`
  - `Project URL` = `SUPABASE_URL`
  - `service_role` = `SUPABASE_SERVICE_ROLE_KEY`
  - `anon public` = `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4) Criar estrutura no Supabase

1. Abra `Supabase Dashboard` -> `SQL Editor`.
2. Execute o arquivo `supabase/schema.sql`.
3. Confirme que as tabelas foram criadas.

## 5) Exportar e importar dados

### Opcao A - so backup (sem importar)

```bash
npm run db:migrate:firebase-supabase -- --skip-import
```

Vai gerar um arquivo JSON em `scripts/migrate/exports`.

### Opcao B - backup + import para Supabase

```bash
npm run db:migrate:firebase-supabase
```

### Opcao C - migracao incremental (recomendado com quota baixa)

Migrar apenas 1 usuario:

```bash
npm run db:migrate:firebase-supabase -- --skip-import --user=UID_DO_USUARIO
```

Migrar primeiros N usuarios:

```bash
npm run db:migrate:firebase-supabase -- --skip-import --users-limit=10
```

Depois repetir com import:

```bash
npm run db:migrate:firebase-supabase -- --user=UID_DO_USUARIO
```

Migracao super leve (1 usuario, sem colecoes globais):

```bash
npm run db:migrate:firebase-supabase -- --user=UID_DO_USUARIO --skip-global
```

## 6) Validacao rapida apos import

No SQL Editor, rode:

```sql
select count(*) from public.profiles;
select count(*) from public.transactions;
select count(*) from public.categories;
select count(*) from public.payment_cards;
select count(*) from public.support_requests;
```

Confira tambem:

```sql
select * from public.migration_runs order by created_at desc limit 5;
```

## 7) Estrategia recomendada para trocar sem quebrar

1. Migrar leitura de paginas pesadas para Supabase primeiro:
   - `/api/transactions`
   - `/api/payment-cards`
   - `/api/categories`
2. Depois migrar escrita destas rotas.
3. Depois migrar suporte/admin.
4. Por ultimo migrar auth (Firebase -> Supabase Auth), se desejar.

## 8) Realtime e quota (para seu caso)

Para reduzir custo de leitura:
- Use paginacao server-side (limit/offset ou keyset).
- Cache de perfil/plano no cliente (30-60s) para evitar reload em cascata.
- Evite polling curto; prefira Supabase Realtime so em tabelas criticas.
- Em transacoes, assinar eventos apenas do usuario logado (filtro por `uid`).

## 9) Upload de imagem de perfil (futuro)

No Supabase:
1. `Storage` -> criar bucket `avatars` (private).
2. Upload via Signed URL (evita expor service key).
3. Salvar apenas `avatar_path` no `profiles`.
4. Gerar URL assinada temporaria para exibir avatar.

## 10) Observacao importante

Nesta fase, o app ainda consulta Firebase em runtime. Este passo resolve transferencia e base de dados no Supabase.
A troca das APIs para Supabase e desligamento do Firebase sera o proximo passo.

## 11) Migracao de login (Firebase Auth -> Supabase Auth)

Script adicionado:

- `npm run auth:migrate:firebase-supabase`

Dry-run:

```bash
npm run auth:migrate:firebase-supabase -- --dry-run
```

Import real:

```bash
npm run auth:migrate:firebase-supabase
```

Observacoes:
- Usuarios Google vao autenticar novamente pelo Google no Supabase.
- Usuarios e-mail/senha devem redefinir senha no primeiro login.
- O script salva relatorio em `scripts/migrate/exports`.
