# Workspace Business/PJ

## Direção funcional

O Business deve reutilizar a infraestrutura segura de convites e assentos do Família, mas não seus papéis ou textos. O vínculo representa emprego ou colaboração profissional, não parentesco.

## Papéis recomendados

- Proprietário: assinatura, CNPJ, segurança, membros e todas as movimentações.
- Administrador financeiro: lançamentos, cartões, metas, relatórios e conciliação; cobrança opcional.
- Colaborador: cria e consulta somente os recursos permitidos.
- Somente leitura/contador: relatórios e exportações sem alteração de dados.

## Regras necessárias

- Conta existente aceita ou recusa o convite sem perder seu plano pessoal.
- Conta nova cria a própria senha; o empregador nunca recebe ou define credenciais.
- O titular ocupa um assento e convites pendentes reservam vaga.
- Assentos adicionais usam os valores mensal/anual definidos pelo Admin e a mesma assinatura ativa.
- Remover um funcionário revoga imediatamente o acesso, preservando lançamentos e autoria para auditoria.
- Uma pessoa pode trabalhar em mais de um workspace Business, desde que cada vínculo seja isolado.
- Dados pessoais, Family e outras empresas nunca são agregados ao Business.
- Alterações sensíveis devem gerar auditoria: convite, aceite, recusa, papel, permissão, remoção e cobrança.

## Estado atual

A configuração comercial de assentos e a rota server-side de alteração da assinatura já aceitam workspaces Business. Ainda falta criar o painel e a API de funcionários com papéis próprios antes de liberar a funcionalidade em produção.
