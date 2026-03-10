-- WevenFinance - consolidated performance indexes

create index if not exists idx_profiles_role_status_plan_payment
  on public.profiles(role, status, plan, payment_status);

create index if not exists idx_profiles_status_created_at
  on public.profiles(status, created_at desc);

create index if not exists idx_user_settings_uid_key
  on public.user_settings(uid, setting_key);

create index if not exists idx_categories_uid_name
  on public.categories(uid, name);

create index if not exists idx_categories_uid_parent_name
  on public.categories(uid, parent_name);

create index if not exists idx_transactions_uid_tx_date_desc
  on public.transactions(uid, tx_date desc);

create index if not exists idx_transactions_uid_due_date_desc
  on public.transactions(uid, due_date desc);

create index if not exists idx_transactions_uid_archived_tx_date
  on public.transactions(uid, ((coalesce((raw ->> 'isArchived')::boolean, false))), tx_date desc);

create index if not exists idx_transactions_uid_status_tx_date
  on public.transactions(uid, tx_status, tx_date desc);

create index if not exists idx_transactions_uid_method_tx_date
  on public.transactions(uid, payment_method, tx_date desc);

create index if not exists idx_transactions_uid_card_tx_date
  on public.transactions(uid, card_id, tx_date desc);

create index if not exists idx_transactions_uid_group_id
  on public.transactions(uid, group_id);

create index if not exists idx_payment_cards_uid_updated
  on public.payment_cards(uid, updated_at desc);

create index if not exists idx_piggy_banks_uid_updated
  on public.piggy_banks(uid, updated_at desc);

create index if not exists idx_piggy_bank_history_uid_created
  on public.piggy_bank_history(uid, created_at desc);

create index if not exists idx_support_requests_status_priority_created
  on public.support_requests(ticket_status, created_at desc);

create index if not exists idx_support_requests_uid_created
  on public.support_requests(uid, created_at desc);

create index if not exists idx_support_requests_assigned_status_created
  on public.support_requests(assigned_to, ticket_status, created_at desc);

create index if not exists idx_billing_events_uid_created
  on public.billing_events(uid, created_at desc);

create index if not exists idx_billing_events_provider_created
  on public.billing_events(provider, created_at desc);

create index if not exists idx_billing_events_provider_event_type_created
  on public.billing_events(provider, event_type, created_at desc);

create index if not exists idx_notifications_uid_created_at
  on public.notifications(uid, created_at desc);

create index if not exists idx_notifications_uid_is_read
  on public.notifications(uid, is_read, created_at desc);

create index if not exists idx_admin_audit_logs_actor_created_at
  on public.admin_audit_logs(actor_uid, created_at desc);

create index if not exists idx_admin_audit_logs_target_created_at
  on public.admin_audit_logs(target_uid, created_at desc);

create index if not exists idx_admin_audit_logs_action_created
  on public.admin_audit_logs(action, created_at desc);

create index if not exists idx_api_request_metrics_created_at
  on public.api_request_metrics(created_at desc);

create index if not exists idx_api_request_metrics_route_method_created_at
  on public.api_request_metrics(route, method, created_at desc);
