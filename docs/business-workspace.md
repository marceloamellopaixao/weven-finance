# Workspace Business/PJ

## Direção funcional

O Business deve reutilizar a infraestrutura segura de convites e vagas do Família, mas não seus papéis ou textos. O vínculo representa emprego ou colaboração profissional, não parentesco.

## Papéis recomendados

- Proprietário: assinatura, CNPJ, segurança, membros e todas as movimentações.
- Administrador financeiro: lançamentos, cartões, metas, relatórios e conciliação; cobrança opcional.
- Colaborador: cria e consulta somente os recursos permitidos.
- Somente leitura/contador: relatórios e exportações sem alteração de dados.

## Regras necessárias

- Conta existente aceita ou recusa o convite sem perder seu plano pessoal.
- Conta nova cria a própria senha; o empregador nunca recebe ou define credenciais.
- O titular ocupa uma vaga e convites pendentes reservam vaga.
- Vagas adicionais usam o valor mensal definido pelo Admin e a mesma assinatura ativa; o ciclo anual é calculado pelo servidor.
- Remover um funcionário revoga imediatamente o acesso, preservando lançamentos e autoria para auditoria.
- Uma pessoa pode trabalhar em mais de um workspace Business, desde que cada vínculo seja isolado.
- Dados pessoais, Family e outras empresas nunca são agregados ao Business.
- Alterações sensíveis devem gerar auditoria: convite, aceite, recusa, papel, permissão, remoção e cobrança.

## Implementação

A configuração comercial de usuários adicionais e a rota server-side de alteração da assinatura aceitam workspaces Business. A base de domínio possui papéis e permissões empresariais próprios, cria o proprietário do workspace, preserva a conta e a assinatura pessoal de funcionários convidados e encerra os acessos da equipe quando o titular troca para um plano não Business.

As operações de equipe ficam em `/api/workspaces/business`:

- `GET`: lista funcionários, convites e capacidade do plano.
- `POST`: convida conta existente ou cria convite seguro para uma conta nova.
- `PUT`: reenvia um convite pendente.
- `PATCH`: altera papel, permissões ou remove o acesso de um funcionário.
- `DELETE`: revoga um convite pendente.

O painel fica em **Configurações > Equipe** e só aparece para um workspace Business que o usuário possa consultar. Permissões avançadas ficam recolhidas por padrão; o papel escolhido já aplica uma configuração segura recomendada.

Antes da liberação em produção, valide o fluxo completo com credenciais de teste: convite de conta existente, convite de conta nova, aceite, recusa, remoção, troca de papel, isolamento de dados e alteração de usuários adicionais.

## Perfil da organização

Todo perfil continua usando o tipo técnico `business`. A finalidade é registrada em `settings.businessOrganizationKind` e não cria outro plano ou cache financeiro. As opções são MEI/autônomo, empresa/comércio, serviços, igreja/ministério, associação/ONG, projeto/equipe e outro.

O porte aproximado fica em `settings.businessTeamSize`. Equipes acima de 100 pessoas são direcionadas para atendimento Enterprise porque o Business padrão possui 5 acessos incluídos e até 95 adicionais.

A classificação escolhe apenas recomendações iniciais de categorias. Alterá-la posteriormente adiciona categorias ausentes de forma idempotente e nunca remove categorias personalizadas nem movimentações existentes.

## Segurança operacional

- A listagem da equipe é paginada no servidor e aceita busca por nome ou e-mail.
- Convites Business reservam capacidade pela função transacional `reserve_business_workspace_invitation`, evitando ultrapassar o limite em solicitações simultâneas.
- Aceite, recusa, reenvio, alteração de papel/permissões, saída e remoção produzem registros de auditoria com escopo do workspace.
- Mudanças de acesso notificam a pessoa afetada e aceite, recusa ou saída notificam o proprietário.
- O endpoint canônico de resposta a convites é `/api/workspaces/invitations`; o caminho anterior permanece somente para compatibilidade temporária.

Após atualizar o código, execute `supabase/schema.sql` antes de testar novos convites Business para instalar a função transacional.
