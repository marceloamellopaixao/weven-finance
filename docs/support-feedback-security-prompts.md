# Prompts de execução: suporte, feedback e segurança

## Diagnóstico atual

A aplicação já possui uma fundação de suporte que deve ser reaproveitada:

- abertura de solicitações de suporte e sugestões em Configurações;
- protocolo, prioridade, SLA, status, atribuição e notificações;
- consulta dos próprios chamados pelo usuário;
- painel administrativo com filtros e atualização dos chamados;
- contexto de impersonation tratado no endpoint de suporte.

A evolução recomendada é transformar essa fundação em uma central de relatos acessível de qualquer tela. Evidências não devem ser gravadas no banco como base64 nem expostas em bucket público. O arquivo deve ficar em um bucket privado, enquanto o banco mantém somente metadados e vínculo com o chamado.

O levantamento de 8 de setembro de 2026 também encontrou 14 alertas em dependências de produção (`npm audit --omit=dev`): 9 altos e 5 moderados. Entre as dependências diretas que exigem atenção estão `next@16.1.6`, `xlsx@0.18.5`, `mercadopago@2.12.0` e `exceljs@4.4.0`. Versões e advisories devem ser consultados novamente no momento de cada correção.

## Ordem recomendada

1. Executar os prompts 1 e 2 juntos na mesma feature branch.
2. Executar os prompts 3 e 4 para concluir a experiência de suporte.
3. Tratar os prompts 5, 6, 7 e 8 como prioridades de segurança antes do lançamento amplo.
4. Executar os prompts 9 e 10 como evolução operacional e de desempenho.
5. Encerrar com o prompt 11 como portão de liberação.

Cada prompt deve ser executado separadamente. Antes de alterar código, o agente deve inspecionar a implementação real, preservar mudanças existentes e registrar suposições. Toda migration precisa ser idempotente e acompanhada de plano de rollback. Não publicar em produção nem aplicar migrations remotas sem autorização explícita.

## Prompt 1 — Relato global de suporte, bug ou sugestão

```text
Implemente uma Central de Ajuda global reaproveitando o fluxo existente de support_requests, sem criar um segundo sistema de tickets.

Objetivos:
- Adicione um botão discreto e acessível, disponível nas telas autenticadas, que abra um modal de relato.
- Permita escolher entre: problema/bug, dúvida/suporte e sugestão.
- Campos mínimos: título, descrição, passos para reproduzir, resultado esperado e resultado observado. Mostre somente os campos pertinentes ao tipo selecionado.
- Permita colar uma captura da área de transferência, arrastar ou selecionar imagens. Mostre prévia, tamanho e ação de remover antes do envio.
- Limite inicialmente a 3 imagens por chamado, 5 MB por imagem, aceitando somente PNG, JPEG e WebP. Não aceite SVG, GIF, PDF ou vídeo nesta fase.
- Colete automaticamente apenas contexto técnico permitido: rota sem query sensível, versão/build da aplicação, navegador, sistema operacional, viewport, idioma, fuso horário, identificador do workspace, tipo de workspace, plano efetivo e flags relevantes.
- Mostre ao usuário uma prévia do contexto que será enviado e permita desmarcar dados técnicos opcionais.
- Nunca colete cookies, tokens, Authorization, localStorage, conteúdo de formulários, saldos, movimentações ou outros dados financeiros.
- Preserve a identidade do usuário real e o contexto de impersonation. Um relato criado durante impersonation deve ser identificado como relato feito pelo suporte em nome do usuário, sem atribuir a autoria real ao cliente.
- Atualize os tipos compartilhados, validação do servidor, traduções e filtros existentes para aceitar `bug`, mantendo compatibilidade com `support` e `feature`.
- Garanta navegação por teclado, foco preso no modal, mensagens de erro associadas aos campos e layout mobile.

Critérios de aceite:
- O botão não cobre a navegação inferior ou ações importantes em desktop e mobile.
- Um usuário autenticado consegue abrir, enviar e depois consultar o chamado.
- Falha no upload não cria um chamado aparentemente completo; o fluxo informa quais anexos falharam e permite tentar novamente.
- Duplo clique não duplica ticket nem arquivo.
- Testes cobrem os três tipos, validação, acessibilidade básica e impersonation.
- Rode lint, typecheck e os testes relacionados e relate os resultados.
```

## Prompt 2 — Upload privado e seguro das evidências

```text
Implemente o backend de anexos da Central de Ajuda usando Supabase Storage e autorização server-side.

Antes de codificar, leia a documentação atual do Supabase Storage e o OWASP File Upload Cheat Sheet. Modele ameaças de IDOR, path traversal, MIME falso, dupla extensão, arquivo muito grande, conteúdo ativo e enumeração de objetos.

Requisitos:
- Crie um bucket privado chamado `support-evidence`, com restrições de tamanho e MIME também configuradas no bucket.
- Crie uma tabela `support_request_attachments` separada de `support_requests`, contendo no mínimo id, ticket_id, owner_uid, storage_path, mime_type validado, tamanho, hash, largura, altura, status de varredura e timestamps.
- Use nomes opacos gerados pelo servidor. Nunca use o nome original no caminho do objeto. Uma estrutura aceitável é `<owner_uid>/<ticket_id>/<uuid>.<extensão-validada>`.
- Valide tamanho, extensão, assinatura/magic bytes e decodificação real da imagem. Não confie no Content-Type enviado pelo navegador.
- Reprocesse a imagem no servidor para remover EXIF/metadados e neutralizar conteúdo inesperado. Registre somente metadados técnicos necessários.
- Defina limites de quantidade, tamanho por arquivo, tamanho total por chamado e cota diária por usuário.
- Usuários podem criar e ler anexos somente dos próprios chamados. Admin, moderador ou suporte podem ler apenas se possuírem permissão explícita de atendimento.
- Nenhuma URL deve ser pública. Visualização e download devem usar URL assinada de curta duração, criada somente após autorização do ticket.
- A service role jamais pode chegar ao cliente. Não registre base64, conteúdo do arquivo, URL assinada ou credenciais em logs.
- Faça limpeza de upload órfão, cancelado ou reprovado. Defina retenção e remoção em cascata para exclusão do chamado/conta, respeitando auditoria e política legal.
- Se não houver antivírus disponível, mantenha status de varredura extensível e documente a limitação; não finja que o arquivo foi escaneado.

Testes obrigatórios:
- usuário A não acessa anexos do usuário B;
- acesso anônimo falha;
- suporte sem permissão falha;
- ticket inexistente ou pertencente a outro workspace falha;
- MIME forjado, dupla extensão, SVG renomeado, arquivo corrompido e arquivo acima do limite falham;
- path traversal e tentativa de sobrescrever outro objeto falham;
- URL assinada expira e não é persistida no banco.

Entregue migration idempotente, políticas RLS, implementação, testes e instruções de rollback. Não aplique a migration em produção.
```

Referências para este prompt: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control), [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) e [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

## Prompt 3 — Caixa de entrada para Admin e equipe de suporte

```text
Evolua o painel administrativo existente para uma caixa de entrada de suporte completa, preservando as permissões atuais.

Implemente:
- filtros por tipo, status, prioridade, responsável, rota, versão da aplicação, navegador, plano e workspace;
- busca por protocolo, título e usuário, sem expor dados de outro tenant;
- visualização dos anexos com thumbnail e lightbox obtidos por URL assinada curta;
- timeline com criação, mudança de status, atribuição, resposta, anexos e eventos relevantes;
- notas internas separadas de mensagens visíveis ao cliente;
- resposta ao cliente e solicitação de informações adicionais;
- auditoria de visualização/download de evidência e de toda mutação do chamado;
- paginação server-side e estados de loading/erro consistentes.

Integre com o acesso de suporte existente:
- nunca inicie impersonation automaticamente;
- ofereça `Solicitar acesso temporário` somente quando necessário e autorizado;
- sempre use o UID alvo do ticket e valide novamente plano, papel, permissão, expiração e revogação no servidor;
- deixe visível quando a interface estiver impersonando e registre a ação no audit log.

Crie testes de autorização em matriz para usuário comum, proprietário do chamado, suporte, moderador, admin e sessão impersonada. Inclua testes negativos de IDOR e de URLs assinadas. Rode lint, typecheck e testes.
```

## Prompt 4 — Acompanhamento pelo usuário

```text
Complete a experiência do cliente para acompanhar chamados sem depender do Admin.

Requisitos:
- Central `Meus chamados` com protocolo, tipo, status, atualização mais recente e responsável quando apropriado.
- Tela de detalhes com timeline somente de mensagens públicas, anexos permitidos e respostas.
- Possibilidade de responder, complementar informações e anexar novas imagens respeitando as mesmas validações e cotas.
- Notificações dentro da aplicação quando houver resposta ou mudança relevante de status.
- Reabertura somente dentro de uma janela configurável; depois dela, orientar a criar novo chamado relacionado.
- Ação para remover uma evidência enquanto a política de retenção permitir, com confirmação e auditoria.
- Texto claro de consentimento: capturas podem conter informações pessoais e o usuário deve revisar a imagem antes de enviar.
- Nenhuma nota interna, identidade técnica do atendente, caminho de Storage ou dado de outro usuário pode aparecer na resposta da API.

Teste isolamento entre usuários/workspaces, paginação, notificações, reabertura e remoção de anexo.
```

## Prompt 5 — Correção auditada das dependências vulneráveis

```text
Faça uma remediação controlada das vulnerabilidades de dependências de produção. Não use `npm audit fix --force` e não altere versões às cegas.

Estado de referência em 08/09/2026: `npm audit --omit=dev` reportou 14 vulnerabilidades, sendo 9 altas e 5 moderadas. Dependências diretas relevantes: next@16.1.6, xlsx@0.18.5, mercadopago@2.12.0 e exceljs@4.4.0.

Etapas:
- Reexecute o audit e salve um resumo sem dados sensíveis.
- Consulte somente advisories e documentação oficiais para confirmar versões corrigidas atuais.
- Atualize Next.js para uma versão estável corrigida e compatível; valide React, middleware, build, rotas, cache e autenticação.
- O pacote `xlsx` não possuía correção indicada pelo npm no levantamento. Localize todos os usos e substitua-o por alternativa mantida ou remova-o. Se uma substituição imediata não for segura, isole o processamento, limite entrada e documente risco, dono e prazo; não declare o risco resolvido.
- Avalie a migração major do SDK `mercadopago`, revisando criação de preferência, webhooks, idempotência e assinaturas.
- Investigue a cadeia vulnerável de `exceljs`; não faça downgrade automático sugerido sem confirmar compatibilidade e segurança.
- Atualize transitivas por upgrades compatíveis. Use override somente com justificativa e testes que comprovem compatibilidade.
- Gere comparação antes/depois, lista de riscos restantes e motivo de cada exceção.

Validação mínima: instalação limpa pelo lockfile, lint, typecheck, testes unitários/integrados, build de produção e smoke tests de login, dashboard, importação/exportação e pagamentos. Não publique nem faça deploy.
```

## Prompt 6 — Autorização, RLS e isolamento de tenant

```text
Execute uma revisão de segurança focada em autorização e isolamento de dados em todas as rotas de API, tabelas Supabase e canais realtime.

Há aproximadamente 50 arquivos route.ts sob src/app/api. Crie primeiro um inventário com: rota, método, autenticação, recurso, regra de propriedade, regra de workspace, permissão/plano exigido, uso de service role, rate limit e teste existente.

Verifique especialmente:
- diferença entre usuário autenticado, usuário alvo e sessão de impersonation;
- expiração, revogação e escopo de impersonation em toda requisição;
- acesso por ID a tickets, anexos, transações, cartões, workspaces e relatórios;
- filtros server-side obrigatórios por uid/workspace;
- RLS equivalente às regras da API, inclusive Storage e realtime;
- endpoints que usam service role, garantindo autorização explícita antes da consulta;
- planos e permissões derivados no servidor, nunca aceitos do payload do cliente;
- consultas administrativas paginadas e limitadas ao papel correto.

Crie testes table-driven com dois usuários, dois workspaces, papéis diferentes, planos diferentes e sessões impersonadas válida, expirada e revogada. Cada leitura e mutação deve possuir caso positivo e negativo. Corrija vulnerabilidades confirmadas em commits pequenos e descreva evidência, impacto e regressão testada, sem incluir segredos ou dados reais no relatório.
```

## Prompt 7 — Privacidade, criptografia e retenção

```text
Faça uma revisão de privacidade e minimização de dados dos fluxos de suporte e auditoria.

Ponto conhecido para verificar: support_requests mantém email, nome e mensagem em colunas legíveis e também inclui conteúdo cifrado em raw.secureSupport. Determine se há duplicação desnecessária e proponha uma migration segura.

Objetivos:
- manter em colunas pesquisáveis somente dados não sensíveis realmente necessários;
- cifrar conteúdo e identificadores pessoais quando a busca direta não for requisito;
- nunca armazenar tokens, cookies, query strings sensíveis, dados financeiros ou URLs assinadas no contexto do chamado;
- definir retenção para tickets, evidências, logs e backups;
- implementar exportação e exclusão compatíveis com os fluxos de privacidade/LGPD do produto;
- registrar consentimento e versão do aviso de privacidade usado no envio da captura;
- definir quem acessou cada evidência, quando e por qual motivo;
- garantir que logs e analytics façam redaction antes do envio.

Produza um pequeno threat model, mapa de dados, migration idempotente, estratégia de backfill/rollback e testes que demonstrem que APIs não retornam campos internos ou conteúdo de outro usuário. Não remova dados existentes sem aprovação explícita e backup validado.
```

## Prompt 8 — Headers, CSP e proteção das mutações

```text
Revise e implemente headers de segurança para a aplicação Next.js. O next.config atual não define headers de segurança.

Requisitos:
- inventarie scripts, estilos, imagens, fontes, iframes, Supabase, analytics e Mercado Pago antes de criar a política;
- introduza Content-Security-Policy em modo Report-Only, elimine violações legítimas e só então proponha enforcement;
- prefira nonce ou hash para scripts necessários e evite liberar unsafe-eval/unsafe-inline globalmente;
- configure frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e HSTS apenas em HTTPS/produção;
- mantenha compatibilidade com metadata/JSON-LD e com o script inicial de tema/aparência;
- revise CORS, validação de Origin/Host e proteção CSRF das mutações conforme o mecanismo real de autenticação;
- não exponha variáveis server-only por prefixo público ou payload de erro.

Crie testes automatizados dos headers e smoke tests dos fluxos que carregam recursos externos. Documente toda exceção de CSP com motivo e responsável. Não ative enforcement em produção neste trabalho.
```

## Prompt 9 — Rate limiting e prevenção de abuso

```text
Fortaleça o rate limiting dos endpoints sensíveis, com foco em login, suporte, uploads, notificações, convites, pagamentos e impersonation.

O projeto possui integração opcional com Upstash e fallback em memória local. O fallback por instância não é suficiente como controle distribuído em produção e hoje depende principalmente do IP informado em x-forwarded-for.

Implemente:
- estratégia distribuída e atômica para produção, com fail-safe definido por criticidade da rota;
- identificação combinada por usuário autenticado, tenant e IP validado pela infraestrutura;
- limites separados para criação de ticket, arquivo, bytes totais, respostas e notificações;
- resposta 429 consistente com Retry-After, sem revelar se uma conta existe;
- idempotency key para criações e uploads;
- contenção de spam de notificações e proteção contra concorrência;
- métricas agregadas e alertas sem armazenar IP em claro além do necessário.

Teste concorrência, múltiplas instâncias simuladas, indisponibilidade do Redis, spoof de forwarded headers e recuperação após a janela. Documente os limites e como ajustá-los por ambiente.
```

## Prompt 10 — Observabilidade e desempenho percebido

```text
Instrumente a jornada de boot e suporte para descobrir onde o usuário realmente espera, sem registrar conteúdo financeiro ou pessoal.

Meça separadamente:
- restauração da sessão;
- carregamento de perfil, plano e permissões;
- resolução de workspace e impersonation;
- primeira consulta de dados do dashboard;
- tempo de envio do ticket e upload de cada evidência;
- Web Vitals e duração do AppBootLoading.

Adicione correlation/request id entre cliente e servidor, métricas p50/p75/p95 e erros categorizados. Não envie payloads, saldos, descrições de chamados, nomes, emails ou URLs assinadas para analytics.

Com dados locais e testes controlados, identifique chamadas duplicadas, cascatas sequenciais, reconciliações/escritas dentro de GETs e bloqueios desnecessários do primeiro paint. Defina orçamentos de desempenho e só então otimize cache, paralelismo e bootstrap. Preserve skeletons locais para conteúdo incremental e use o loading geral apenas enquanto sessão/contexto indispensável ainda estiver sendo resolvido.

Entregue comparação antes/depois e testes para evitar regressões de autenticação, plano, workspace e impersonation.
```

## Prompt 11 — Portão de qualidade e liberação gradual

```text
Prepare a Central de Ajuda para liberação gradual, sem fazer deploy.

Crie uma suíte E2E que cubra:
- usuário comum criando bug com e sem imagem;
- colar, remover, reprovar e tentar novamente um anexo;
- dois usuários e dois workspaces sem vazamento cruzado;
- suporte/admin filtrando, atribuindo, respondendo e visualizando evidência;
- papel sem permissão recebendo 403;
- impersonation válida, expirada e revogada;
- plano alterado durante a sessão;
- URL assinada expirada;
- acessibilidade por teclado e viewport mobile;
- indisponibilidade parcial do Storage e envio idempotente.

Adicione feature flag server-side para liberar por ambiente, papel e percentual, sem confiar apenas no cliente. Prepare checklist de migrations, políticas RLS, bucket, variáveis, rollback, métricas e alertas. Defina critérios objetivos de go/no-go e um canário interno antes da liberação geral. Entregue o relatório e pare antes de aplicar migration, ativar flag ou publicar em produção.
```
