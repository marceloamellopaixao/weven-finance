# Redux Toolkit e RTK Query

## Arquitetura

A store é criada uma vez por árvore React em `src/store/provider.tsx` e conectada no layout raiz. `baseApi.ts` é a única API RTK Query: os arquivos de domínio adicionam endpoints com `injectEndpoints`, compartilhando reducer, middleware, cache e deduplicação.

O Redux DevTools fica habilitado somente em desenvolvimento. Focus refetch está desabilitado; reconnect refetch está habilitado e entradas sem consumidores permanecem por 120 segundos (planos, por 300 segundos).

## Autenticação e segurança

`prepareHeaders` obtém o access token do Supabase no momento da request e acrescenta os headers de impersonation. O token não faz parte dos argumentos, estado ou cache Redux. Os endpoints chamam exclusivamente `/api/*`; chaves de service role e segredos de provedores de pagamento permanecem server-side.

Não registre headers, tokens ou payloads financeiros. Uma resposta 401 é devolvida ao consumidor sem retry ou refresh em loop; o fluxo de sessão existente decide logout/redirecionamento.

## Chaves de cache e workspaces

Toda query autenticada recebe `userId`, mesmo quando ele não vai para a URL. Toda query financeira recebe também `workspaceId`. Esses valores fazem parte da serialização automática dos argumentos e impedem que cache de outro usuário ou workspace seja reutilizado. Filtros, mês, paginação e tipo também devem fazer parte do objeto de argumentos.

Use `skip` ou `skipToken` até usuário e workspace estarem prontos. Nunca use `"default"` como workspace real.

## Endpoints novos

Adicione endpoints ao arquivo do domínio usando `baseApi.injectEndpoints`. Para uma leitura, transforme o envelope `{ ok, ... }` no dado consumido pela UI e forneça uma tag com escopo. Para mutation, remova `userId` do body, envie `workspaceId` quando aplicável e invalide somente a tag afetada.

Exemplo de identidade de tag por workspace: ``{ type: "Transactions", id: `${userId}:${workspaceId}` }``. Dados globais públicos, como planos, usam a tag `Plans`; dados por usuário usam o próprio `userId`.

## Migração

Os endpoints centrais disponíveis cobrem perfil, configurações financeiras, planos, controle de acesso, workspaces, categorias/visibilidade padrão, transações, cartões, resumo de crédito, porquinhos e onboarding. Hooks migrados devem preservar a interface pública para não quebrar páginas. Caches manuais e polling só devem ser removidos depois que todos os consumidores daquele domínio usarem RTK Query; eventos realtime podem chamar `refetch` ou invalidar a tag correspondente.
