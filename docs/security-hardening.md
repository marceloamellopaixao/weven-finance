# Endurecimento de segurança

## Correção crítica de autorização em `profiles`

O arquivo `supabase/rls.sql` bloqueia `INSERT`, `UPDATE` e `DELETE` diretos de
`anon` e `authenticated` na tabela `profiles`. A aplicação já realiza essas
mutações por rotas autenticadas no servidor com `service_role`.

Uma trigger também protege os campos de autorização, plano e faturamento caso
uma permissão de escrita seja concedida acidentalmente no futuro.

### Aplicação controlada

1. Rode `supabase/preflight.sql` e guarde o resultado.
2. Faça backup lógico da tabela `profiles` e das políticas atuais.
3. Rode `supabase/rls.sql` primeiro em um projeto Supabase de desenvolvimento.
4. Teste com a chave pública e um JWT de usuário comum:
   - leitura do próprio perfil deve funcionar;
   - alteração de `display_name`, `role`, `plan` ou `billing` diretamente pela
     Data API deve falhar por falta de privilégio;
   - alteração do perfil pela rota `/api/profile/me` deve continuar funcionando;
   - alteração administrativa de role/plano pela API deve continuar funcionando.
5. Repita a matriz com `client`, `support`, `moderator` e `admin` antes de
   promover a alteração para produção.

Não aplique este SQL diretamente em produção sem concluir os testes acima.

### Rollback emergencial

O rollback abaixo restaura o comportamento anterior e, por isso, também
restaura o risco de alteração de campos privilegiados. Use apenas para recuperar
uma indisponibilidade enquanto a causa é corrigida.

```sql
drop trigger if exists trg_profiles_protect_privileged_fields on public.profiles;
drop function if exists public.protect_profile_privileged_fields();

grant insert, update, delete on table public.profiles to authenticated;

create policy profiles_insert_own_or_staff on public.profiles
  for insert to authenticated
  with check (public.current_user_uid() = uid or public.is_staff_role());

create policy profiles_update_own_or_staff on public.profiles
  for update to authenticated
  using (public.current_user_uid() = uid or public.is_staff_role())
  with check (public.current_user_uid() = uid or public.is_staff_role());
```

Depois do rollback, bloqueie temporariamente as operações administrativas até
que a proteção seja reaplicada.

## MFA administrativo sem SMS

A aplicação usa TOTP do Supabase com aplicativos como Google Authenticator,
Microsoft Authenticator e 1Password. A API de TOTP é gratuita e habilitada por
padrão no Supabase; o complemento pago é o MFA por telefone.

Contas `admin`, `moderator` e `support` sem fator verificado são direcionadas à
aba Segurança. Depois do cadastro por QR Code, sessões `aal1` são direcionadas
para `/mfa`. As APIs administrativas, de impersonation e operações de suporte
feitas pela equipe rejeitam tokens que não tenham `aal2`.

Antes da liberação:

1. Cadastre um segundo fator TOTP de contingência para o administrador principal.
2. Guarde esse segundo fator em dispositivo/cofre separado. O Supabase não
   fornece códigos de recuperação TOTP.
3. Teste login, logout, perda do autenticador, troca de aparelho e remoção de
   função administrativa.
4. Não habilite MFA Phone no painel: ele é um complemento cobrado separadamente.

## Cabeçalhos HTTP

O `next.config.ts` remove o cabeçalho de tecnologia e envia `nosniff`, proteção
contra frames, política de referência e bloqueio de câmera, microfone e
geolocalização. HSTS é enviado somente em produção.

Uma Content Security Policy não foi ativada às cegas. O layout ainda possui
scripts inline e integrações externas; primeiro deve ser criada em modo
`Content-Security-Policy-Report-Only`, com nonces e coleta segura de violações,
antes de passar para bloqueio.

## Política de senha

Novos cadastros e redefinições exigem no mínimo 12 caracteres no cliente. O
login não rejeita senhas antigas localmente; ele delega a verificação ao
Supabase, evitando bloquear contas legadas.

Configure também o mínimo de 12 caracteres em **Authentication → Settings** no
Supabase. A validação do navegador melhora a experiência, mas a regra do
servidor é a proteção efetiva.
