# Categorias padrão e personalizadas

## Modelo de dados

O catálogo de categorias tem duas camadas independentes:

- **Categorias padrão:** configuração global salva em `system_configs`, na chave `category_presets`. Somente administradores com permissão de Planos podem alterá-la.
- **Categorias personalizadas:** salvas na tabela `categories` e isoladas por proprietário e `workspace_id`.
- **Visibilidade:** cada workspace pode ocultar categorias padrão sem alterar o catálogo global. A preferência fica em `user_settings`, na chave `categories:<workspaceId>`.

O endpoint `GET /api/categories?workspaceId=...` resolve o perfil ativo no servidor e devolve as categorias padrão corretas junto das categorias personalizadas daquele workspace.

## Perfis de aplicação

- `personal`: Free, Premium, Pro e Foundation.
- `family`: workspace do plano Família.
- `business`: fallback para um workspace Business ainda sem segmento definido.
- `business_*`: catálogo específico para Autônomo/MEI, Empresa, Serviços, Igreja, Associação/ONG, Projeto ou Outro.

O nível comercial do plano pessoal não duplica catálogos: Free, Premium, Pro e Foundation compartilham o perfil Pessoal. As limitações de recursos continuam sendo controladas pelas capacidades do plano.

## Regras de segurança e histórico

- O client chama apenas APIs internas; a gravação global exige `admin.plans.write`.
- `Outros` é obrigatório e não pode ser removido, pois é o fallback de exclusões e dados antigos.
- Renomear ou remover um padrão altera somente as opções futuras. Transações históricas não são reclassificadas automaticamente.
- Ao renomear, o nome anterior é preservado como alias para manter preferências de visibilidade compatíveis.
- Registros legados com prefixo `preset_`, criados quando o sistema materializava padrões como categorias personalizadas, deixam de aparecer na interface. Eles não são apagados automaticamente.

## Cache

RTK Query usa as tags `CategoryPresets` e `Categories`. Uma alteração administrativa invalida o catálogo global e todas as consultas de categorias ativas; dados financeiros de outros workspaces não entram na mesma chave de cache.
