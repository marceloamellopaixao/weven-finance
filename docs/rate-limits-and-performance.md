# Rate limiting e desempenho

## Controles de abuso

Em produção, configure `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` e `RATE_LIMIT_IP_HASH_SECRET`. O contador usa um script Lua `EVAL` para executar incremento, expiração e leitura do TTL atomicamente. Rotas críticas falham fechadas quando o armazenamento distribuído está indisponível; leituras e telemetria podem usar o fallback em memória para preservar disponibilidade.

O IP só é aceito de um cabeçalho definido pela infraestrutura em `RATE_LIMIT_TRUSTED_PROXY_HEADER`. Vercel (`x-forwarded-for`) e Cloudflare Pages (`cf-connecting-ip`) possuem defaults próprios. Fora desses ambientes, cabeçalhos encaminhados não configurados não são confiáveis. A chave persistida é um HMAC/hash de usuário, tenant e IP, nunca o IP em claro.

Limites configuráveis:

| Variável | Padrão | Janela |
|---|---:|---:|
| `RATE_LIMIT_SUPPORT_TICKETS_PER_HOUR` | 10 | 1 hora |
| `RATE_LIMIT_SUPPORT_FILES_PER_DAY` | 12 | 1 dia |
| `RATE_LIMIT_SUPPORT_BYTES_PER_DAY` | 30 MiB | 1 dia |
| `RATE_LIMIT_SUPPORT_RESPONSES_PER_MINUTE` | 12 | 1 minuto |
| `RATE_LIMIT_NOTIFICATIONS_READS_PER_MINUTE` | 60 | 1 minuto |
| `RATE_LIMIT_NOTIFICATION_MUTATIONS_PER_MINUTE` | 30 | 1 minuto |
| `RATE_LIMIT_IMPERSONATION_ACTIONS_PER_MINUTE` | 10 | 1 minuto |
| `RATE_LIMIT_BILLING_ACTIONS_PER_MINUTE` | 10 | 1 minuto |
| `RATE_LIMIT_INVITATIONS_PER_HOUR` | 10 | 1 hora |

Criações de chamados e mensagens usam chaves de idempotência. Notificações relacionadas usam uma chave de deduplicação com índice único, evitando duplicação sob concorrência. Toda resposta limitada usa HTTP 429 e `Retry-After`.

## Observabilidade e orçamento

Ative persistência com `ENABLE_PERFORMANCE_METRICS=true`. São coletados somente nome allowlisted, duração, rota sem query, correlation ID, classificação e categoria de erro. Payloads, descrições, saldos, nomes, e-mails, tokens e URLs assinadas não são aceitos pelo endpoint.

O painel de métricas calcula p50, p75 e p95 e alerta quando o p75 supera o orçamento:

| Jornada | Orçamento p75 |
|---|---:|
| Sessão | 800 ms |
| Perfil, plano e permissões | 1.200 ms |
| Workspace e impersonation | 1.000 ms |
| AppBootLoading | 2.000 ms |
| Primeiros dados do dashboard | 1.800 ms |
| Envio de chamado | 3.000 ms |
| Upload de evidência | 5.000 ms |

Web Vitals também são medidos pelo reporter oficial do Next.js. O loading global continua reservado à sessão e ao contexto indispensável; skeletons locais devem permanecer para dados incrementais.

## Antes e depois

Antes não havia série histórica específica da jornada de boot/suporte, portanto não existe uma comparação numérica honesta retroativa. A linha de base começa após a migration e a ativação da flag. A implementação remove como riscos conhecidos o contador Redis não atômico, a confiança indiscriminada em `x-forwarded-for`, a dependência exclusiva de memória por instância e a ausência de idempotência em respostas/uploads.

## Aplicação e rollback

Execute `supabase/schema.sql`, `supabase/indexes.sql`, `supabase/rls.sql` e depois `supabase/preflight.sql` no ambiente de homologação. Nenhuma migration é aplicada automaticamente em produção.

Para rollback, desative `ENABLE_PERFORMANCE_METRICS`, remova os índices novos e, após confirmar a política de retenção, remova `performance_metrics`, `notifications.dedupe_key` e `support_request_messages.client_request_id`. A remoção de colunas/tabelas perde histórico e deve exigir backup e aprovação explícita.
