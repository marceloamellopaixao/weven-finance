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

## Estado atual

A configuração comercial de usuários adicionais e a rota server-side de alteração da assinatura já aceitam workspaces Business. A base de domínio agora possui papéis e permissões empresariais próprios, cria o proprietário do workspace, preserva a conta e a assinatura pessoal de funcionários convidados e encerra os acessos da equipe quando o titular troca para um plano não Business.

Ainda falta concluir o painel e a API de funcionários antes de liberar a funcionalidade em produção. O fluxo será entregue atrás da própria disponibilidade do plano Business, sem reaproveitar textos ou papéis familiares.
