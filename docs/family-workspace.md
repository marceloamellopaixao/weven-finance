# Workspace Família

## Objetivo

O Workspace Família permite que uma família use um contexto financeiro compartilhado, mantendo login, senha, conta pessoal, autoria e permissões individuais.

## Modelo de dados

- `workspaces`: registro canônico; usa `workspace_type = 'family'` e `settings.familyModeEnabled = true`.
- `workspace_members`: vincula a conta autenticada ao workspace por `workspace_uid`, `workspace_id` e `member_uid`.
- `workspace_invitations`: registra destinatário, validade, papel, permissões e aceite/rejeição.
- `transactions.workspace_id`: identifica o contexto financeiro.
- `transactions.created_by_uid`: preserva a autoria dentro do contexto compartilhado.

## Convites

Existe um único fluxo seguro, sem senha escolhida pelo responsável:

- Conta existente: o perfil é localizado pelo e-mail, recebe notificação interna e precisa aceitar ou recusar o convite.
- Se a pessoa convidada possuir uma assinatura individual ativa e não for Staff, o modal exige consentimento explícito e cancela essa assinatura antes de ativar o vínculo Família. Assim não há duas cobranças simultâneas.
- Staff não tem a assinatura alterada e pode manter múltiplos perfis para testes.
- Conta nova: o Supabase envia o convite para a própria pessoa criar o acesso. Após o primeiro acesso, o vínculo pendente é ativado.
- Convites expiram em sete dias. Enquanto pendentes, reservam uma vaga; quando expiram ou são revogados, liberam a vaga.
- Reenvio para conta existente cria um novo lembrete interno. E-mail de redefinição de senha não é usado nesse caso.

## Papéis e permissões

- `family_manager`: titular/gestor.
- `spouse_responsible`: cônjuge ou outro responsável.
- `child_dependent`: filho ou dependente.
- `guest_member`: familiar com acesso limitado.

As permissões são separadas por dashboard, lançamentos, relatórios, cartões, metas, membros, configurações, segurança e cobrança. O titular ocupa uma vaga e mantém acesso administrativo completo.

## Vagas e cobrança

- Convites pendentes contam como vaga ocupada para impedir excesso por concorrência.
- O plano Família inclui quatro pessoas, contando o titular. Esse número não é alterado no painel administrativo.
- O Admin configura somente o valor mensal de cada vaga adicional; o valor anual é calculado pelo servidor.
- O teto técnico de vagas é uma regra do produto e não pode ser alterado pelo Admin (16 adicionais no Família e 95 no Business).
- `billing.additionalSeats` registra somente vagas efetivamente contratadas.
- A contratação atualiza a mesma preapproval do Mercado Pago; não cria outra assinatura.
- A política é `next_renewal_no_immediate_charge`: o valor novo entra na próxima renovação, sem cobrança duplicada ou pró-rata imediato.
- Não é possível reduzir a quantidade abaixo do total de membros ativos e convites pendentes.

## Isolamento e segurança

As APIs resolvem o workspace e as permissões no servidor. Para membros convidados, o `workspace_uid` continua sendo o dono financeiro canônico, enquanto `created_by_uid` preserva a autoria. Um usuário comum vinculado a uma Família acessa apenas o perfil compartilhado; perfis próprios ficam indisponíveis enquanto o vínculo estiver ativo. Usuários comuns sem vínculo veem somente o tipo permitido pelo plano (Pessoal, Família ou Business). Staff pode acessar vários tipos para testes. Service role e segredos permanecem exclusivamente no servidor.

## Evolução para Business/PJ

O modelo comercial de vagas já aceita configuração do plano Business, mas a gestão visual de funcionários deve usar nomenclatura e papéis próprios — por exemplo, proprietário, administrador financeiro, colaborador e somente leitura. Não se deve reutilizar rótulos familiares como filho ou cônjuge. A futura API de membros Business deve reutilizar as mesmas garantias de convite, aceite, isolamento e cobrança, com permissões específicas de empresa.
