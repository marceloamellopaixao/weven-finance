# Workspace Familia

## Objetivo

O modo Workspace Familia permite que uma familia use um mesmo contexto financeiro com login proprio por membro, papeis e permissoes por pessoa.

## Modelo de dados

- `workspaces`: continua sendo o registro canonico do workspace. Para familia, `workspace_type = 'family'` e `settings.familyModeEnabled = true`.
- `workspace_members`: vincula membros autenticados ao workspace familiar por `workspace_uid` (dono/gestor), `workspace_id`, `member_uid`, papel e permissoes.
- `workspace_invitations`: registra convites por e-mail, status, papel e permissoes planejadas.
- `transactions.workspace_id`: identifica o workspace financeiro.
- `transactions.created_by_uid`: identifica quem criou o lancamento dentro do workspace.

## Papeis

- `family_manager`: gestor da familia, criado automaticamente para o dono do workspace.
- `spouse_responsible`: conjuge/responsavel.
- `child_dependent`: filho/dependente.
- `guest_member`: membro convidado.

## Permissoes

- `view_all`
- `view_own`
- `create_entries`
- `edit_own_entries`
- `edit_all_entries`
- `view_consolidated_reports`
- `manage_members`

As APIs financeiras resolvem o workspace ativo no servidor. Para membros convidados, o `uid` financeiro canonico passa a ser o `workspace_uid`, mas a autoria fica em `created_by_uid`.

## Convites e Supabase Auth

A rota `/api/workspaces/family` usa Supabase Admin no servidor:

- `self_setup`: envia convite do Supabase para o familiar criar a propria senha.
- `temporary_password`: cria ou vincula usuario com senha temporaria recebida do gestor.
- `auto_password`: gera uma senha no servidor e nao a devolve ao client; o familiar deve usar fluxo de primeiro acesso/recuperacao.

Senhas geradas automaticamente nao sao logadas nem retornadas ao navegador.

## Google opcional

O vinculo com Google continua opcional. Como o convite resolve usuario por e-mail antes de criar nova conta, evita duplicidade quando ja existe login por e-mail/senha. Ao entrar com Google usando o mesmo e-mail, o bootstrap de perfil consolida provedores em `authProviders`.

## Compatibilidade

Fluxos atuais de login, cadastro, dashboard, billing e Mercado Pago continuam usando o mesmo `profiles.uid` e plano do usuario. Workspaces pessoais existentes seguem funcionando; novas transacoes passam a receber `workspace_id` quando houver workspace ativo.
