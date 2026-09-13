# Portão de qualidade — Central de Ajuda

## Estado da entrega

Status atual: **NO-GO para produção**. A implementação e a suíte estão preparadas, mas a flag permanece desligada, as migrations não foram aplicadas e os cenários E2E que dependem de contas/estados reais ainda precisam rodar em um ambiente descartável. Nenhum deploy, migration ou ativação foi executado por esta entrega.

O `npm audit --omit=dev` de 2026-09-08 encontrou 15 dependências de produção sinalizadas (6 moderadas, 8 altas e 1 crítica). Entre elas estão o Next.js 16.1.6 e o Sharp 0.34.5; Sharp participa diretamente do processamento das imagens enviadas por usuários. O audit indica correções em versões posteriores. Isso mantém o gate fechado até atualização controlada, testes de regressão e triagem das dependências transitivas; nenhum `npm audit fix --force` foi executado.

## Estratégia de rollout

A Central de Ajuda fica disponível para todos os usuários autenticados. Não há liberação por papel,
UID ou porcentagem, porque solicitar suporte é uma capacidade essencial do produto. A autorização
normal de cada endpoint e o isolamento por usuário/workspace continuam obrigatórios.

`SUPPORT_CENTER_KILL_SWITCH=true` é apenas o freio de emergência no servidor. Ele não faz parte da
operação cotidiana e normalmente permanece `false`. A equipe autorizada continua conseguindo abrir
a caixa de entrada do Admin para tratar chamados existentes.

## Execução E2E

Instale o Chromium uma vez com `npx playwright install chromium`. Use exclusivamente um Supabase de QA descartável e configure:

- `E2E_START_SERVER=true` para subir o Next local na porta 3100, ou `E2E_BASE_URL` para uma URL de QA;
- `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_A_UID` e `E2E_USER_A_WORKSPACE_ID`;
- equivalentes `E2E_USER_B_*` para outro tenant/workspace;
- `E2E_ADMIN_*` e `E2E_DENIED_*`;
- `E2E_IMPERSONATION_VALID_UID`, `E2E_IMPERSONATION_EXPIRED_UID` e `E2E_IMPERSONATION_REVOKED_UID`, previamente semeados;
- `E2E_USER_A_ORIGINAL_PLAN` e `E2E_USER_A_ALTERNATE_PLAN` para a conta descartável.

Comandos:

```bash
npm run test:e2e:list
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-chromium
```

Os testes que alteram plano restauram o valor original em `finally`. Os controles de falha do Storage e TTL curto só funcionam quando `PLAYWRIGHT_TEST=1` e `NODE_ENV` não é `production`.

## Checklist antes do canário

- [ ] Backup e plano de rollback aprovados.
- [ ] `schema.sql`, `indexes.sql` e `rls.sql` aplicados em QA na ordem documentada.
- [ ] `preflight.sql` sem tabela, coluna, índice, trigger, política ou bucket ausente.
- [ ] Bucket privado `support-evidence`, MIME e 5 MiB conferidos.
- [ ] Service role presente somente no servidor.
- [ ] Upstash, salt de rate limit e cabeçalho de proxy confiável configurados.
- [ ] `SUPPORT_CENTER_KILL_SWITCH=false` no ambiente de QA.
- [ ] `ENABLE_API_METRICS=true` e `ENABLE_PERFORMANCE_METRICS=true` em QA.
- [ ] Alertas 5xx, 429, latência p75 e falha de Storage entregues ao canal interno.
- [ ] `npm test`, lint, typecheck, i18n, build e toda a suíte E2E verdes.
- [ ] Vulnerabilidades high/critical do `npm audit` triadas; nenhuma explorável no caminho liberado.
- [ ] Teste manual por teclado, leitor de tela básico e viewport mobile concluído.
- [ ] Retenção, exclusão, auditoria e consentimento revisados.

## Canário interno

1. Validar a Central com contas internas no ambiente de QA.
2. Observar por pelo menos 24 horas e executar todos os fluxos, inclusive anexos, impersonation e respostas.
3. Executar um canário interno em produção por 24–48 horas antes de comunicar a funcionalidade.
4. Se todos os critérios estiverem verdes, disponibilizar a entrada normalmente aos usuários autenticados.
5. Em qualquer violação, desativar a Central pelo Admin; em emergência, definir `SUPPORT_CENTER_KILL_SWITCH=true`.

## Critérios objetivos de GO

- 100% dos cenários E2E obrigatórios aprovados em Chromium desktop e mobile;
- zero falha de isolamento/IDOR, RLS, permissão ou impersonation;
- zero chamado/anexo duplicado nos testes de concorrência e retentativa;
- zero upload órfão após falha simulada;
- taxa de erro 5xx abaixo de 1% e 429 abaixo de 5% no canário;
- p75 dentro dos orçamentos documentados e upload p95 abaixo de 8 segundos;
- nenhum alerta crítico aberto e nenhum vazamento de conteúdo nos logs/analytics;
- rollback ensaiado em QA e responsável pela liberação identificado.

## Critérios de NO-GO/rollback

Qualquer vazamento entre usuários/workspaces, URL acessível após expiração, bypass da flag, autorização incorreta, duplicação persistente, perda de ticket/anexo, erro 5xx ≥ 1%, ou alerta crítico implica NO-GO. Desative primeiro a flag; preserve dados para auditoria e só reverta schema após backup e confirmação explícita.
