type OpenApiServer = {
  url: string;
  description?: string;
};

export function buildOpenApiSpec(servers: OpenApiServer[]) {
  return {
    openapi: "3.0.3",
    info: {
      title: "WevenFinance API",
      version: "1.0.0",
      description: "Documentacao das rotas API do WevenFinance.",
    },
    servers,
    tags: [
      { name: "Billing", description: "Fluxos de checkout, confirmacao e cancelamento de assinatura" },
      { name: "Account", description: "Gestao de conta do proprio usuario" },
      { name: "Profile", description: "Perfil do usuario autenticado e bootstrap de conta" },
      { name: "AdminUsers", description: "Gestao administrativa de usuarios e operacoes de manutencao" },
      { name: "Impersonation", description: "Solicitacao e aprovacao de acesso da equipe ao ambiente do usuario" },
      { name: "Categories", description: "Gestao de categorias personalizadas e visibilidade das padrao" },
      { name: "Transactions", description: "CRUD e operacoes em lote de transacoes" },
      { name: "UserSettings", description: "Configuracoes financeiras do usuario" },
      { name: "CreditCard", description: "Controle de limite e politicas de cartao de credito" },
      { name: "PaymentCards", description: "Cadastro de cartoes sem dados sensiveis (banco, final e tipo)" },
      { name: "Support", description: "Chamados de suporte e solicitacoes de feature" },
      { name: "System", description: "Configuracoes globais do sistema" },
      { name: "MercadoPago", description: "Webhook e sincronizacao com gateway" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Firebase ID Token",
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
            400: { description: "Plano invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Plano inativo/isento", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            422: { description: "Link nao configurado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/billing/confirm-preapproval": {
        post: {
          tags: ["Billing"],
          summary: "Confirmar assinatura por preapproval_id (ou fallback automatico)",
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/billing/cancel-subscription": {
        post: {
          tags: ["Billing"],
          summary: "Cancelar assinatura ativa do usuario autenticado",
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
      "/api/account/delete": {
        post: {
          tags: ["Account"],
          summary: "Excluir (soft-delete) a propria conta",
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
          summary: "Ler perfil do usuario autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Perfil retornado (ou null)" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["Profile"],
          summary: "Atualizar dados basicos do proprio perfil",
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
          summary: "Marcar verifiedEmail=true no perfil do usuario autenticado",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Perfil atualizado" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/admin/users": {
        get: {
          tags: ["AdminUsers"],
          summary: "Listar usuarios (opcional scope=staff)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "scope", in: "query", required: false, schema: { type: "string", enum: ["staff"] } },
          ],
          responses: {
            200: { description: "Usuarios retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["AdminUsers"],
          summary: "Atualizar campos de usuario (admin/moderator)",
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
            200: { description: "Usuario atualizado" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["AdminUsers"],
          summary: "Executar acao administrativa de usuarios",
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
            200: { description: "Acao executada" },
            400: { description: "Payload/acao invalida", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/impersonation": {
        get: {
          tags: ["Impersonation"],
          summary: "Consultar solicitacoes (pending/mine/status)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "mode", in: "query", required: false, schema: { type: "string", enum: ["pending", "mine", "status"] } },
            { name: "targetUid", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Consulta realizada" },
            400: { description: "Parametros invalidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["Impersonation"],
          summary: "Solicitar acesso (staff) ou responder solicitacao (usuario)",
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
            200: { description: "Operacao executada" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            404: { description: "Recurso nao encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Conflito de estado", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories": {
        get: {
          tags: ["Categories"],
          summary: "Listar categorias personalizadas e padrao ocultas",
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Categoria duplicada", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Categories"],
          summary: "Excluir categoria e subcategorias, movendo transacoes para fallback",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "name", in: "query", required: true, schema: { type: "string" } },
            { name: "fallbackCategory", in: "query", required: false, schema: { type: "string", default: "Outros" } },
          ],
          responses: {
            200: { description: "Categoria excluida" },
            400: { description: "Parametros invalidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/categories/default-visibility": {
        post: {
          tags: ["Categories"],
          summary: "Ocultar/mostrar categoria padrao",
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/transactions": {
        get: {
          tags: ["Transactions"],
          summary: "Listar transacoes do usuario (opcional por groupId)",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "groupId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Transacoes listadas" },
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
            200: { description: "Operacao executada" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["Transactions"],
          summary: "Atualizar transacao por ID",
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
            200: { description: "Transacao atualizada" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Transactions"],
          summary: "Excluir transacao por ID ou grupo",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "transactionId", in: "query", required: false, schema: { type: "string" } },
            { name: "groupId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Transacao/grupo excluido" },
            400: { description: "Parametros invalidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/credit-card": {
        get: {
          tags: ["CreditCard"],
          summary: "Ler configuracoes e resumo de limite do cartao de credito",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Configuracoes e resumo retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["CreditCard"],
          summary: "Atualizar configuracoes do cartao e reavaliar bloqueio por limite",
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
            200: { description: "Configuracoes salvas" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovacao de impersonacao pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/payment-cards": {
        get: {
          tags: ["PaymentCards"],
          summary: "Listar cartoes cadastrados do usuario",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Cartoes retornados" },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        post: {
          tags: ["PaymentCards"],
          summary: "Cadastrar cartao (somente banco, final e tipo)",
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
            200: { description: "Cartao criado" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovacao de impersonacao pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        patch: {
          tags: ["PaymentCards"],
          summary: "Atualizar cartao cadastrado",
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
            200: { description: "Cartao atualizado" },
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovacao de impersonacao pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["PaymentCards"],
          summary: "Excluir cartao cadastrado",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "cardId", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Cartao excluido" },
            400: { description: "Parametro invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            409: { description: "Aprovacao de impersonacao pendente", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
            200: { description: "Identificacao retornada" },
            400: { description: "BIN invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/support-requests": {
        get: {
          tags: ["Support"],
          summary: "Listar chamados conforme perfil (admin/mod: todos, support: atribuidos, client: proprios)",
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        delete: {
          tags: ["Support"],
          summary: "Excluir chamado (somente admin)",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "ticketId", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Chamado excluido" },
            400: { description: "Parametros invalidos", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/system/plans": {
        get: {
          tags: ["System"],
          summary: "Ler configuracao de planos",
          responses: {
            200: { description: "Planos retornados" },
            500: { description: "Erro interno", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
        put: {
          tags: ["System"],
          summary: "Atualizar configuracao de planos (somente admin)",
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
            400: { description: "Payload invalido", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            401: { description: "Sem token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
            403: { description: "Sem permissao", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
          summary: "Receber notificacoes do Mercado Pago",
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
              description: "Assinatura invalida",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
    },
  };
}
