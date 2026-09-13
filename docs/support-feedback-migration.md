# Operação da Central de Ajuda

## Aplicação da migration

Nenhum comando deste documento deve ser executado diretamente em produção sem backup e aprovação.

Ordem de aplicação no Supabase SQL Editor:

1. Execute `supabase/preflight.sql` e guarde o resultado.
2. Execute `supabase/schema.sql` para criar `support_request_attachments`, a coluna idempotente e o bucket privado `support-evidence`.
3. Execute `supabase/indexes.sql`.
4. Execute `supabase/rls.sql`.
5. Execute novamente `supabase/preflight.sql` e confirme que não há itens ausentes.

O backend exige `SUPABASE_SERVICE_ROLE_KEY` somente no servidor. Essa chave não pode usar o prefixo `NEXT_PUBLIC_` nem ser enviada ao navegador.

O bucket não possui políticas de acesso direto para clientes. Criação, exclusão e assinatura de URLs passam obrigatoriamente pelas rotas server-side, impedindo que um upload direto contorne validação, reprocessamento, cota ou autorização da equipe. A tabela permite ao usuário autenticado consultar apenas os próprios metadados; as mutações continuam restritas ao backend.

## Retenção e limpeza

- Falhas durante criação removem os objetos que já tenham sido enviados.
- Exclusão administrativa de um ticket remove primeiro seus objetos do Storage; a FK remove os metadados em cascata.
- Uploads aceitos ficam marcados como `scan_status = unavailable` enquanto não houver antivírus configurado. Isso significa “não verificado”, nunca “limpo”.
- A retenção inicial implementada é de 180 dias após o encerramento do chamado. Reabrir o chamado cancela a expiração pendente.
- Os jobs administrativo e cron de retenção removem primeiro os objetos pela API do Storage e somente depois apagam os metadados. Não apague linhas de `storage.objects` diretamente.

## Evolução da caixa de entrada

O mesmo `schema.sql` também cria `support_request_messages`, `support_request_events` e as colunas normalizadas usadas nos filtros administrativos. Essas tabelas não possuem acesso direto pelo cliente: a API remove notas internas, UID do atendente, caminhos de Storage e metadados privados antes de responder ao titular. A reabertura pelo cliente fica limitada a 14 dias após o encerramento.

No rollback desta evolução, remova primeiro `support_request_events` e `support_request_messages`. Depois remova os índices de filtros e, somente se não forem mais usadas, as colunas `protocol`, `workspace_id`, `workspace_type`, `effective_plan`, `report_route`, `app_version` e `browser` de `support_requests`.

## Rollback

O rollback da interface e da API pode ser feito revertendo o commit da feature. Antes de remover estruturas do banco:

1. desative a criação de novos relatos;
2. exporte os metadados necessários para auditoria;
3. liste e remova os objetos do bucket pela API do Supabase Storage;
4. confirme que o bucket está vazio;
5. remova as políticas `support_evidence_*` e `support_attachments_*`;
6. remova a tabela `public.support_request_attachments`;
7. remova o índice `idx_support_requests_uid_client_request` e, se não for mais usado, a coluna `client_request_id`;
8. remova o bucket privado somente depois da confirmação.

Esse rollback é destrutivo e não deve ser automatizado ou executado sem autorização explícita.
