# Versionamento da aplicação

Vale a pena versionar este projeto: a versão já é anexada aos relatos de suporte e permite correlacionar regressões, métricas e deploys. O `package.json` é a fonte da versão e o build usa esse valor como `NEXT_PUBLIC_APP_VERSION` quando a variável não for fornecida pela infraestrutura.

Use Semantic Versioning `MAJOR.MINOR.PATCH`:

- `PATCH` (`0.1.0` → `0.1.1`): correção compatível;
- `MINOR` (`0.1.1` → `0.2.0`): funcionalidade compatível;
- `MAJOR` (`1.4.2` → `2.0.0`): contrato/API incompatível ou migração obrigatória para clientes.

Enquanto produto, contratos e migrations ainda mudam rapidamente, mantenha `0.x.y`. Use `1.0.0` apenas quando a primeira versão pública estiver estável, com rollback, changelog e compatibilidade definidos. Não altere uma versão já publicada.

Fluxo recomendado por release:

1. escolha a versão conforme o impacto;
2. atualize `package.json` e lockfile juntos (`npm version patch|minor|major` faz isso e também cria commit/tag por padrão);
3. registre mudanças em `CHANGELOG.md`;
4. rode todos os gates e publique somente a partir da tag `vX.Y.Z`;
5. injete o SHA do commit separadamente na plataforma de deploy para distinguir builds da mesma versão sem mudar a semântica do produto.

A versão não foi incrementada nesta entrega porque nenhuma release foi publicada. O projeto permanece em `0.1.0` até a decisão de liberação.
