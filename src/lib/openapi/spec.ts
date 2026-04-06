type OpenApiServer = {
  url: string;
  description: string;
};

export function buildOpenApiSpec(servers: OpenApiServer[]) {
  return {
    openapi: "3.0.3",
    info: {
      title: "WevenFinance API",
      version: "1.0.0",
      description: "Documentação das rotas API do WevenFinance.",
    },
    servers,
    tags: [
      { name: "Billing", description: "Fluxos de checkout, confirmação e cancelamento de assinatura" },
      { name: "Account", description: "Gestão de conta do próprio usuário" },
      { name: "Profile", description: "Perfil do usuário autenticado e bootstrap de conta" },
      { name: "AdminUsers", description: "Gestão administrativa de usuários e operações de manutenção" },
      { name: "AdminAudit", description: "Consulta de trilha de auditoria administrativa" },
      { name: "AdminMetrics", description: "Métricas operacionais das APIs" },
      { name: "AdminJobs", description: "Jobs administrativos de reconciliação e manutenção" },
      { name: "Impersonation", description: "solicitação e aprovação de acesso da equipe ao ambiente do usuário" },
      { name: "Categories", description: "Gestão de categorias personalizadas e visibilidade das padrão" },
      { name: "Transactions", description: "CRUD e operações em lote de transações" },
      { name: "UserSettings", description: "Configurações financeiras do usuário" },
      { name: "CreditCard", description: "Controle de limite e políticas de cartão de crédito" },
      { name: "PaymentCards", description: "Cadastro de cartões sem dados sensíveis (banco, final e tipo)" },
      { name: "PiggyBanks", description: "Gestão de metas no porquinho e aportes com reflexo no extrato" },
      { name: "Support", description: "Chamados de suporte e solicitações de feature" },
      { name: "System", description: "Configurações globais do sistema" },
      { name: "MercadoPago", description: "Webhook e sincronização com gateway" },
      { name: "Notifications", description: "Notificações in-app em tempo real para o usuário autenticado" },
      { name: "Onboarding", description: "Progresso guiado de primeiros passos do usuário" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Supabase JWT",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: false },
            error: { type: "string", example: "missing_auth_token" },
          },
          required: ["ok", "error"],
        },
      },
    },
    paths: {
      "/api/billing/checkout-link": {
        get: {
          tags: ["Billing"],
          summary: "Gerar link de checkout de assinatura",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "plan",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["premium", "pro"] },
            },
          ],
          responses: {
            200: {
              description: "Link gerado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      checkoutUrl: { type: "string" },
                      preapprovalId: { type: "string", nullable: true },
                    },
                    required: ["ok", "checkoutUrl"],
                  },
                },
              },
            },
            400: { description: "Plano inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Plano inativo/isento", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Link não configurado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/billing/confirm-preapproval": {
        post: {
          tags: ["Billing"],
          summary: "Confirmar assinatura por preapproval_id (ou fallback automático)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    preapprovalId: { type: "string", nullable: true },
                    expectedPlan: { type: "string", enum: ["free", "premium", "pro"], nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Assinatura confirmada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      uid: { type: "string" },
                      targetPlan: { type: "string", enum: ["free", "premium", "pro"] },
                      targetPaymentStatus: { type: "string" },
                      gatewayStatus: { type: "string" },
                    },
                    required: ["ok", "uid", "targetPlan", "targetPaymentStatus"],
                  },
                },
              },
            },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/billing/cancel-subscription": {
        post: {
          tags: ["Billing"],
          summary: "Cancelar assinatura ativa do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Assinatura cancelada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      uid: { type: "string" },
                      preapprovalId: { type: "string" },
                      targetPlan: { type: "string", enum: ["free"] },
                      targetPaymentStatus: { type: "string", enum: ["canceled"] },
                    },
                    required: ["ok", "uid", "targetPlan", "targetPaymentStatus"],
                  },
                },
              },
            },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/billing/history": {
        get: {
          tags: ["Billing"],
          summary: "Histórico de eventos de cobrança do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Histórico retornado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },      "/api/account/delete": {
        post: {
          tags: ["Account"],
          summary: "Excluir (soft-delete) a própria conta",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Conta desativada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean", example: true } },
                    required: ["ok"],
                  },
                },
              },
            },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/profile/me": {
        get: {
          tags: ["Profile"],
          summary: "Ler perfil do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Perfil retornado (ou null)" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Profile"],
          summary: "Atualizar dados básicos do próprio perfil",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    displayName: { type: "string" },
                    completeName: { type: "string" },
                    phone: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Perfil atualizado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/profile/bootstrap": {
        post: {
          tags: ["Profile"],
          summary: "Criar/sincronizar perfil no primeiro login",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    profile: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Perfil criado/sincronizado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/profile/verify-email": {
        post: {
          tags: ["Profile"],
          summary: "Marcar verifiedEmail=true no perfil do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Perfil atualizado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Listar notificações in-app do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Notificações retornadas" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["Notifications"],
          summary: "Marcar notificação como lida (ou todas)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", nullable: true },
                    markAllRead: { type: "boolean", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Notificações atualizadas" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Notifications"],
          summary: "Limpar todas as notificações do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Notificações removidas" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/onboarding": {
        get: {
          tags: ["Onboarding"],
          summary: "Consultar progresso de onboarding do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Progresso retornado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Onboarding"],
          summary: "Atualizar flags do onboarding (dismiss e steps)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    dismissed: { type: "boolean", nullable: true },
                    steps: {
                      type: "object",
                      properties: {
                        firstTransaction: { type: "boolean", nullable: true },
                        firstCard: { type: "boolean", nullable: true },
                        firstGoal: { type: "boolean", nullable: true },
                        profileMenu: { type: "boolean", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Onboarding atualizado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/users": {
        get: {
          tags: ["AdminUsers"],
          summary: "Listar usuários (opcional scope=staff)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "scope", in: "query", required: false, schema: { type: "string", enum: ["staff"] } },
          ],
          responses: {
            200: { description: "Usuários retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["AdminUsers"],
          summary: "Atualizar campos de usuário (admin/moderator)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    uid: { type: "string" },
                    updates: { type: "object", additionalProperties: true },
                    requiresAdmin: { type: "boolean" },
                  },
                  required: ["uid", "updates"],
                },
              },
            },
          },
          responses: {
            200: { description: "Usuário atualizado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["AdminUsers"],
          summary: "Executar ação administrativa de usuários",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: {
                      type: "string",
                      enum: ["normalize", "resetFinancialData", "softDelete", "restore", "recountTransactionCount"],
                    },
                    uid: { type: "string", nullable: true },
                    restoreData: { type: "boolean", nullable: true },
                  },
                  required: ["action"],
                },
              },
            },
          },
          responses: {
            200: { description: "Ação executada" },
            400: { description: "Payload/ação inválida", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/metrics": {
        get: {
          tags: ["AdminMetrics"],
          summary: "Resumo operacional de métricas das APIs",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "windowMinutes", in: "query", required: false, schema: { type: "integer", minimum: 5, maximum: 1440, default: 60 } },
          ],
          responses: {
            200: { description: "Métricas retornadas" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/health": {
        get: {
          tags: ["AdminMetrics"],
          summary: "Painel de saúde operacional (DB, webhook, pagamentos e API)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Saúde operacional retornada" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/audit-logs": {
        get: {
          tags: ["AdminAudit"],
          summary: "Listar trilha de auditoria administrativa com filtros",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
            { name: "q", in: "query", required: false, schema: { type: "string" } },
            { name: "action", in: "query", required: false, schema: { type: "string" } },
            { name: "actorUid", in: "query", required: false, schema: { type: "string" } },
            { name: "targetUid", in: "query", required: false, schema: { type: "string" } },
            { name: "from", in: "query", required: false, schema: { type: "string", format: "date" } },
            { name: "to", in: "query", required: false, schema: { type: "string", format: "date" } },
          ],
          responses: {
            200: { description: "Logs retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/jobs/billing-reconcile": {
        post: {
          tags: ["AdminJobs"],
          summary: "Reconciliar eventos de billing pendentes/falhos do Mercado Pago",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
            { name: "onlyFailed", in: "query", required: false, schema: { type: "boolean", default: false } },
            { name: "dryRun", in: "query", required: false, schema: { type: "boolean", default: false } },
          ],
          responses: {
            200: { description: "Job executado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/jobs/data-retention": {
        post: {
          tags: ["AdminJobs"],
          summary: "Executar limpeza e anonimização de dados (retenção)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Job executado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            429: { description: "Rate limit excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/impersonation": {
        get: {
          tags: ["Impersonation"],
          summary: "Consultar solicitações (pending/mine/status)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "mode", in: "query", required: false, schema: { type: "string", enum: ["pending", "mine", "status"] } },
            { name: "targetUid", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Consulta realizada" },
            400: { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Impersonation"],
          summary: "Solicitar acesso (staff) ou responder solicitação (usuário)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["request", "respond"] },
                    targetUid: { type: "string", nullable: true },
                    requestId: { type: "string", nullable: true },
                    approved: { type: "boolean", nullable: true },
                  },
                  required: ["action"],
                },
              },
            },
          },
          responses: {
            200: { description: "Operação executada" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Recurso não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Conflito de estado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories": {
        get: {
          tags: ["Categories"],
          summary: "Listar categorias personalizadas e padrão ocultas",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Dados de categorias",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      customCategories: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            type: { type: "string", enum: ["income", "expense", "both"] },
                            color: { type: "string" },
                            userId: { type: "string" },
                          },
                        },
                      },
                      hiddenDefaultCategories: { type: "array", items: { type: "string" } },
                    },
                    required: ["ok", "customCategories", "hiddenDefaultCategories"],
                  },
                },
              },
            },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Categories"],
          summary: "Criar categoria personalizada",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["income", "expense", "both"] },
                    color: { type: "string", nullable: true },
                  },
                  required: ["name", "type"],
                },
              },
            },
          },
          responses: {
            200: { description: "Categoria criada" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Categoria duplicada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["Categories"],
          summary: "Renomear categoria principal e suas subcategorias",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    oldName: { type: "string" },
                    newName: { type: "string" },
                  },
                  required: ["oldName", "newName"],
                },
              },
            },
          },
          responses: {
            200: { description: "Categorias renomeadas" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Categoria duplicada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Categories"],
          summary: "Excluir categoria e subcategorias, movendo transações para fallback",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "name", in: "query", required: true, schema: { type: "string" } },
            { name: "fallbackCategory", in: "query", required: false, schema: { type: "string", default: "Outros" } },
          ],
          responses: {
            200: { description: "Categoria excluida" },
            400: { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories/default-visibility": {
        post: {
          tags: ["Categories"],
          summary: "Ocultar/mostrar categoria padrão",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    categoryName: { type: "string" },
                    hidden: { type: "boolean" },
                  },
                  required: ["categoryName", "hidden"],
                },
              },
            },
          },
          responses: {
            200: { description: "Visibilidade atualizada" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/transactions": {
        get: {
          tags: ["Transactions"],
          summary: "Listar transações do usuário (opcional por groupId)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "groupId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Transações listadas" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Transactions"],
          summary: "Operacoes em lote e acoes de status/cancelamento",
          description: "Acoes suportadas: createMany, updateMany, toggleStatus, cancelFuture.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["createMany", "updateMany", "toggleStatus", "cancelFuture"] },
                  },
                  required: ["action"],
                },
              },
            },
          },
          responses: {
            200: { description: "Operação executada" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["Transactions"],
          summary: "Atualizar transação por ID",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactionId: { type: "string" },
                    updates: { type: "object", additionalProperties: true },
                  },
                  required: ["transactionId", "updates"],
                },
              },
            },
          },
          responses: {
            200: { description: "Transação atualizada" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Transactions"],
          summary: "Excluir transação por ID ou grupo",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "transactionId", in: "query", required: false, schema: { type: "string" } },
            { name: "groupId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Transação/grupo excluído" },
            400: { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/user-settings/finance": {
        get: {
          tags: ["UserSettings"],
          summary: "Ler saldo financeiro atual",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Saldo retornado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["UserSettings"],
          summary: "Atualizar saldo financeiro atual",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    currentBalance: { type: "number" },
                  },
                  required: ["currentBalance"],
                },
              },
            },
          },
          responses: {
            200: { description: "Saldo atualizado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/credit-card": {
        get: {
          tags: ["CreditCard"],
          summary: "Ler configurações e resumo de limite do cartão de crédito",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Configurações e resumo retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["CreditCard"],
          summary: "Atualizar configurações do cartão e reavaliar bloqueio por limite",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    cardName: { type: "string" },
                    limit: { type: "number" },
                    alertThresholdPct: { type: "number" },
                    blockOnLimitExceeded: { type: "boolean" },
                    autoUnblockWhenBelowLimit: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Configurações salvas" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovação de impersonação pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/payment-cards": {
        get: {
          tags: ["PaymentCards"],
          summary: "Listar cartões cadastrados do usuário",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Cartões retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["PaymentCards"],
          summary: "Cadastrar cartão (somente banco, final e tipo)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bankName: { type: "string" },
                    last4: { type: "string" },
                    type: { type: "string", enum: ["credit_card", "debit_card"] },
                  },
                  required: ["bankName", "last4", "type"],
                },
              },
            },
          },
          responses: {
            200: { description: "Cartão criado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovação de impersonação pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["PaymentCards"],
          summary: "Atualizar cartão cadastrado",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cardId: { type: "string" },
                    updates: {
                      type: "object",
                      properties: {
                        bankName: { type: "string" },
                        last4: { type: "string" },
                        type: { type: "string", enum: ["credit_card", "debit_card"] },
                      },
                    },
                  },
                  required: ["cardId", "updates"],
                },
              },
            },
          },
          responses: {
            200: { description: "Cartão atualizado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovação de impersonação pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["PaymentCards"],
          summary: "Excluir cartão cadastrado",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "cardId", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Cartão excluído" },
            400: { description: "Parâmetro inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovação de impersonação pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/payment-cards/identify": {
        get: {
          tags: ["PaymentCards"],
          summary: "Identificar bandeira/banco por BIN (6+ digitos)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "bin", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Identificação retornada" },
            400: { description: "BIN inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/piggy-banks": {
        get: {
          tags: ["PiggyBanks"],
          summary: "Listar porquinhos do usuário autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Porquinhos retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["PiggyBanks"],
          summary: "Guardar valor no porquinho (e opcionalmente aumentar limite do cartão)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["deposit"] },
                    goalType: {
                      type: "string",
                      enum: ["card_limit", "emergency_reserve", "travel", "home_renovation", "dream_purchase", "custom"],
                    },
                    goalName: { type: "string" },
                    amount: { type: "number" },
                    withdrawalMode: { type: "string", nullable: true },
                    yieldType: { type: "string", nullable: true },
                    sourceType: { type: "string", enum: ["bank", "cash"] },
                    cardId: { type: "string", nullable: true },
                  },
                  required: ["action", "goalType", "goalName", "amount"],
                },
              },
            },
          },
          responses: {
            200: { description: "Aporte registrado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Cartão não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovação de impersonação pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/piggy-banks/{slug}": {
        get: {
          tags: ["PiggyBanks"],
          summary: "Ler porquinho por slug com histórico",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Porquinho retornado" },
            400: { description: "Slug inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Porquinho não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/support-requests": {
        get: {
          tags: ["Support"],
          summary: "Listar chamados conforme perfil (admin/mod: todos, support: atribuídos, client: próprios)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Chamados listados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Support"],
          summary: "Criar chamado de suporte ou feature request",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["support", "feature"] },
                    message: { type: "string" },
                    status: { type: "string", nullable: true },
                    platform: { type: "string", nullable: true },
                  },
                  required: ["type", "message"],
                },
              },
            },
          },
          responses: {
            200: { description: "Chamado criado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["Support"],
          summary: "Atualizar chamado (status/atribuicao/outros campos permitidos)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ticketId: { type: "string" },
                    updates: { type: "object", additionalProperties: true },
                  },
                  required: ["ticketId", "updates"],
                },
              },
            },
          },
          responses: {
            200: { description: "Chamado atualizado" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Support"],
          summary: "Excluir chamado (somente admin)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "ticketId", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Chamado excluído" },
            400: { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/system/plans": {
        get: {
          tags: ["System"],
          summary: "Ler configuração de planos",
          responses: {
            200: { description: "Planos retornados" },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["System"],
          summary: "Atualizar configuração de planos (somente admin)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plans: { type: "object", additionalProperties: true },
                  },
                  required: ["plans"],
                },
              },
            },
          },
          responses: {
            200: { description: "Planos atualizados" },
            400: { description: "Payload inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissão", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/mercadopago/webhook": {
        get: {
          tags: ["MercadoPago"],
          summary: "Healthcheck do webhook",
          responses: {
            200: {
              description: "Webhook ativo",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      service: { type: "string", example: "mercadopago_webhook" },
                    },
                    required: ["ok", "service"],
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["MercadoPago"],
          summary: "Receber notificações do Mercado Pago",
          description: "Endpoint de webhook. Responde rapidamente e sincroniza o status de billing.",
          parameters: [
            { name: "topic", in: "query", required: false, schema: { type: "string" } },
            { name: "type", in: "query", required: false, schema: { type: "string" } },
            { name: "data.id", in: "query", required: false, schema: { type: "string" } },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          responses: {
            200: {
              description: "Evento aceito/processado",
            },
            202: {
              description: "Evento ignorado por falta de dados",
            },
            401: {
              description: "Assinatura inválida",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
    },
  };
}

