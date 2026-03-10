-- WevenFinance - preflight de estrutura
-- Diagnóstico somente leitura para rodar antes de schema.sql / indexes.sql / rls.sql

with required_tables as (
  select * from (
    values
      ('profiles'),
      ('user_settings'),
      ('categories'),
      ('transactions'),
      ('payment_cards'),
      ('piggy_banks'),
      ('piggy_bank_history'),
      ('support_requests'),
      ('billing_events'),
      ('support_access_requests'),
      ('impersonation_action_requests'),
      ('log_acesso_suporte'),
      ('system_configs'),
      ('notifications'),
      ('admin_audit_logs'),
      ('api_request_metrics'),
      ('migration_runs')
  ) as t(table_name)
)
select
  rt.table_name,
  case when c.table_name is null then 'missing' else 'ok' end as table_status
from required_tables rt
left join information_schema.tables c
  on c.table_schema = 'public'
 and c.table_name = rt.table_name
order by rt.table_name;

with required_columns as (
  select * from (
    values
      ('profiles', 'uid', 'text'),
      ('profiles', 'email', 'text'),
      ('profiles', 'display_name', 'text'),
      ('profiles', 'complete_name', 'text'),
      ('profiles', 'phone', 'text'),
      ('profiles', 'photo_url', 'text'),
      ('profiles', 'role', 'text'),
      ('profiles', 'plan', 'text'),
      ('profiles', 'status', 'text'),
      ('profiles', 'block_reason', 'text'),
      ('profiles', 'verified_email', 'boolean'),
      ('profiles', 'deleted_at', 'timestamp with time zone'),
      ('profiles', 'payment_status', 'text'),
      ('profiles', 'transaction_count', 'integer'),
      ('profiles', 'billing', 'jsonb'),
      ('profiles', 'raw', 'jsonb'),
      ('profiles', 'created_at', 'timestamp with time zone'),
      ('profiles', 'updated_at', 'timestamp with time zone'),

      ('user_settings', 'id', 'text'),
      ('user_settings', 'uid', 'text'),
      ('user_settings', 'setting_key', 'text'),
      ('user_settings', 'data', 'jsonb'),
      ('user_settings', 'created_at', 'timestamp with time zone'),
      ('user_settings', 'updated_at', 'timestamp with time zone'),

      ('categories', 'id', 'text'),
      ('categories', 'uid', 'text'),
      ('categories', 'source_id', 'text'),
      ('categories', 'name', 'text'),
      ('categories', 'parent_name', 'text'),
      ('categories', 'category_type', 'text'),
      ('categories', 'color', 'text'),
      ('categories', 'is_default', 'boolean'),
      ('categories', 'is_custom', 'boolean'),
      ('categories', 'raw', 'jsonb'),
      ('categories', 'created_at', 'timestamp with time zone'),
      ('categories', 'updated_at', 'timestamp with time zone'),

      ('transactions', 'id', 'text'),
      ('transactions', 'uid', 'text'),
      ('transactions', 'source_id', 'text'),
      ('transactions', 'description', 'text'),
      ('transactions', 'amount', 'numeric'),
      ('transactions', 'amount_text', 'text'),
      ('transactions', 'amount_for_limit', 'numeric'),
      ('transactions', 'tx_type', 'text'),
      ('transactions', 'category', 'text'),
      ('transactions', 'tx_status', 'text'),
      ('transactions', 'payment_method', 'text'),
      ('transactions', 'card_id', 'text'),
      ('transactions', 'card_label', 'text'),
      ('transactions', 'card_type', 'text'),
      ('transactions', 'tx_date', 'date'),
      ('transactions', 'due_date', 'date'),
      ('transactions', 'group_id', 'text'),
      ('transactions', 'installment_current', 'integer'),
      ('transactions', 'installment_total', 'integer'),
      ('transactions', 'raw', 'jsonb'),
      ('transactions', 'created_at', 'timestamp with time zone'),
      ('transactions', 'updated_at', 'timestamp with time zone'),

      ('payment_cards', 'id', 'text'),
      ('payment_cards', 'uid', 'text'),
      ('payment_cards', 'source_id', 'text'),
      ('payment_cards', 'bank_name', 'text'),
      ('payment_cards', 'last4', 'text'),
      ('payment_cards', 'card_type', 'text'),
      ('payment_cards', 'brand', 'text'),
      ('payment_cards', 'bin', 'text'),
      ('payment_cards', 'due_date', 'integer'),
      ('payment_cards', 'limit_enabled', 'boolean'),
      ('payment_cards', 'credit_limit', 'numeric'),
      ('payment_cards', 'alert_threshold_pct', 'numeric'),
      ('payment_cards', 'block_on_limit_exceeded', 'boolean'),
      ('payment_cards', 'raw', 'jsonb'),
      ('payment_cards', 'created_at', 'timestamp with time zone'),
      ('payment_cards', 'updated_at', 'timestamp with time zone'),

      ('piggy_banks', 'id', 'text'),
      ('piggy_banks', 'uid', 'text'),
      ('piggy_banks', 'source_id', 'text'),
      ('piggy_banks', 'slug', 'text'),
      ('piggy_banks', 'name', 'text'),
      ('piggy_banks', 'goal_type', 'text'),
      ('piggy_banks', 'total_saved', 'numeric'),
      ('piggy_banks', 'withdrawal_mode', 'text'),
      ('piggy_banks', 'yield_type', 'text'),
      ('piggy_banks', 'raw', 'jsonb'),
      ('piggy_banks', 'created_at', 'timestamp with time zone'),
      ('piggy_banks', 'updated_at', 'timestamp with time zone'),

      ('piggy_bank_history', 'id', 'text'),
      ('piggy_bank_history', 'piggy_bank_id', 'text'),
      ('piggy_bank_history', 'uid', 'text'),
      ('piggy_bank_history', 'source_id', 'text'),
      ('piggy_bank_history', 'amount', 'numeric'),
      ('piggy_bank_history', 'withdrawal_mode', 'text'),
      ('piggy_bank_history', 'yield_type', 'text'),
      ('piggy_bank_history', 'source_type', 'text'),
      ('piggy_bank_history', 'card_id', 'text'),
      ('piggy_bank_history', 'card_label', 'text'),
      ('piggy_bank_history', 'applied_to_card_limit', 'boolean'),
      ('piggy_bank_history', 'raw', 'jsonb'),
      ('piggy_bank_history', 'created_at', 'timestamp with time zone'),
      ('piggy_bank_history', 'updated_at', 'timestamp with time zone'),

      ('support_requests', 'id', 'text'),
      ('support_requests', 'uid', 'text'),
      ('support_requests', 'email', 'text'),
      ('support_requests', 'name', 'text'),
      ('support_requests', 'title', 'text'),
      ('support_requests', 'message', 'text'),
      ('support_requests', 'ticket_type', 'text'),
      ('support_requests', 'ticket_status', 'text'),
      ('support_requests', 'assigned_to', 'text'),
      ('support_requests', 'assigned_to_name', 'text'),
      ('support_requests', 'staff_seen_by', 'ARRAY'),
      ('support_requests', 'votes', 'integer'),
      ('support_requests', 'raw', 'jsonb'),
      ('support_requests', 'created_at', 'timestamp with time zone'),
      ('support_requests', 'updated_at', 'timestamp with time zone'),

      ('billing_events', 'id', 'text'),
      ('billing_events', 'uid', 'text'),
      ('billing_events', 'event_type', 'text'),
      ('billing_events', 'action', 'text'),
      ('billing_events', 'provider', 'text'),
      ('billing_events', 'raw', 'jsonb'),
      ('billing_events', 'created_at', 'timestamp with time zone'),
      ('billing_events', 'updated_at', 'timestamp with time zone'),

      ('support_access_requests', 'id', 'text'),
      ('support_access_requests', 'requester_uid', 'text'),
      ('support_access_requests', 'target_uid', 'text'),
      ('support_access_requests', 'request_status', 'text'),
      ('support_access_requests', 'raw', 'jsonb'),
      ('support_access_requests', 'created_at', 'timestamp with time zone'),
      ('support_access_requests', 'updated_at', 'timestamp with time zone'),

      ('impersonation_action_requests', 'id', 'text'),
      ('impersonation_action_requests', 'requester_uid', 'text'),
      ('impersonation_action_requests', 'target_uid', 'text'),
      ('impersonation_action_requests', 'action_type', 'text'),
      ('impersonation_action_requests', 'action_status', 'text'),
      ('impersonation_action_requests', 'raw', 'jsonb'),
      ('impersonation_action_requests', 'created_at', 'timestamp with time zone'),
      ('impersonation_action_requests', 'updated_at', 'timestamp with time zone'),

      ('log_acesso_suporte', 'id', 'text'),
      ('log_acesso_suporte', 'id_user', 'text'),
      ('log_acesso_suporte', 'id_user_impersonate', 'text'),
      ('log_acesso_suporte', 'permission_impersonate', 'boolean'),
      ('log_acesso_suporte', 'raw', 'jsonb'),
      ('log_acesso_suporte', 'created_at', 'timestamp with time zone'),
      ('log_acesso_suporte', 'updated_at', 'timestamp with time zone'),

      ('system_configs', 'key', 'text'),
      ('system_configs', 'data', 'jsonb'),
      ('system_configs', 'created_at', 'timestamp with time zone'),
      ('system_configs', 'updated_at', 'timestamp with time zone'),

      ('notifications', 'id', 'text'),
      ('notifications', 'uid', 'text'),
      ('notifications', 'kind', 'text'),
      ('notifications', 'title', 'text'),
      ('notifications', 'message', 'text'),
      ('notifications', 'href', 'text'),
      ('notifications', 'is_read', 'boolean'),
      ('notifications', 'meta', 'jsonb'),
      ('notifications', 'created_at', 'timestamp with time zone'),
      ('notifications', 'updated_at', 'timestamp with time zone'),

      ('admin_audit_logs', 'id', 'text'),
      ('admin_audit_logs', 'actor_uid', 'text'),
      ('admin_audit_logs', 'action', 'text'),
      ('admin_audit_logs', 'target_uid', 'text'),
      ('admin_audit_logs', 'request_id', 'text'),
      ('admin_audit_logs', 'route', 'text'),
      ('admin_audit_logs', 'method', 'text'),
      ('admin_audit_logs', 'ip', 'text'),
      ('admin_audit_logs', 'user_agent', 'text'),
      ('admin_audit_logs', 'details', 'jsonb'),
      ('admin_audit_logs', 'created_at', 'timestamp with time zone'),

      ('api_request_metrics', 'id', 'text'),
      ('api_request_metrics', 'route', 'text'),
      ('api_request_metrics', 'method', 'text'),
      ('api_request_metrics', 'status', 'integer'),
      ('api_request_metrics', 'duration_ms', 'integer'),
      ('api_request_metrics', 'request_id', 'text'),
      ('api_request_metrics', 'uid', 'text'),
      ('api_request_metrics', 'error_code', 'text'),
      ('api_request_metrics', 'created_at', 'timestamp with time zone'),

      ('migration_runs', 'id', 'uuid'),
      ('migration_runs', 'source', 'text'),
      ('migration_runs', 'target', 'text'),
      ('migration_runs', 'payload', 'jsonb'),
      ('migration_runs', 'created_at', 'timestamp with time zone')
  ) as t(table_name, column_name, expected_type)
)
select
  rc.table_name,
  rc.column_name,
  rc.expected_type,
  c.data_type as current_type,
  case
    when c.column_name is null then 'missing'
    when rc.expected_type = 'ARRAY' and c.data_type = 'ARRAY' then 'ok'
    when rc.expected_type = 'numeric' and c.data_type = 'numeric' then 'ok'
    when rc.expected_type = c.data_type then 'ok'
    else 'type_mismatch'
  end as column_status
from required_columns rc
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = rc.table_name
 and c.column_name = rc.column_name
order by rc.table_name, rc.column_name;

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles',
    'user_settings',
    'categories',
    'transactions',
    'payment_cards',
    'piggy_banks',
    'piggy_bank_history',
    'support_requests',
    'billing_events',
    'support_access_requests',
    'impersonation_action_requests',
    'log_acesso_suporte',
    'system_configs',
    'notifications',
    'admin_audit_logs',
    'api_request_metrics',
    'migration_runs'
  )
order by tablename, indexname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'user_settings',
    'categories',
    'transactions',
    'payment_cards',
    'piggy_banks',
    'piggy_bank_history',
    'support_requests',
    'billing_events',
    'support_access_requests',
    'impersonation_action_requests',
    'log_acesso_suporte',
    'system_configs',
    'notifications',
    'admin_audit_logs',
    'api_request_metrics',
    'migration_runs'
  )
order by tablename, policyname;
