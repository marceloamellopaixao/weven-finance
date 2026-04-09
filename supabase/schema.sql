-- WevenFinance - consolidated Supabase schema
-- This file contains the canonical table/trigger structure used by the current application.
-- Safe for existing databases: additive only, no drop table / drop column operations.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  uid text primary key,
  email text,
  display_name text,
  complete_name text,
  phone text,
  photo_url text,
  role text not null default 'client',
  plan text not null default 'free',
  status text not null default 'active',
  block_reason text,
  verified_email boolean not null default false,
  deleted_at timestamptz,
  payment_status text not null default 'pending',
  transaction_count integer not null default 0,
  billing jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_settings (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  setting_key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, setting_key)
);

create table if not exists public.categories (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  name text not null,
  parent_name text,
  category_type text,
  color text,
  is_default boolean not null default false,
  is_custom boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.transactions (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  description text,
  amount numeric(17,2),
  amount_text text,
  amount_for_limit numeric(17,2),
  tx_type text,
  category text,
  tx_status text,
  payment_method text,
  card_id text,
  card_label text,
  card_type text,
  tx_date date,
  due_date date,
  group_id text,
  installment_current integer,
  installment_total integer,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.payment_cards (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  bank_name text,
  last4 text,
  card_type text,
  brand text,
  bin text,
  due_date integer,
  limit_enabled boolean,
  credit_limit numeric(17,2),
  alert_threshold_pct numeric(6,2),
  block_on_limit_exceeded boolean,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.piggy_banks (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  slug text,
  name text,
  goal_type text,
  total_saved numeric(17,2) not null default 0,
  withdrawal_mode text,
  yield_type text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.piggy_bank_history (
  id text primary key,
  piggy_bank_id text not null references public.piggy_banks(id) on delete cascade,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  amount numeric(17,2),
  withdrawal_mode text,
  yield_type text,
  source_type text,
  card_id text,
  card_label text,
  applied_to_card_limit boolean,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.support_requests (
  id text primary key,
  uid text,
  email text,
  name text,
  title text,
  message text,
  ticket_type text,
  ticket_status text,
  assigned_to text,
  assigned_to_name text,
  staff_seen_by text[] not null default '{}',
  votes integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_events (
  id text primary key,
  uid text,
  event_type text,
  action text,
  provider text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_access_requests (
  id text primary key,
  requester_uid text,
  target_uid text,
  request_status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.impersonation_action_requests (
  id text primary key,
  requester_uid text,
  target_uid text,
  action_type text,
  action_status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.log_acesso_suporte (
  id text primary key,
  id_user text,
  id_user_impersonate text,
  permission_impersonate boolean,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.system_configs (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  kind text not null default 'system',
  title text not null,
  message text not null,
  href text,
  is_read boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_audit_logs (
  id text primary key,
  actor_uid text,
  action text not null,
  target_uid text,
  request_id text,
  route text,
  method text,
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.api_request_metrics (
  id text primary key,
  route text not null,
  method text not null,
  status integer not null,
  duration_ms integer not null default 0,
  request_id text,
  uid text,
  error_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'system',
  target text not null default 'supabase',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.profiles add column if not exists email text;
alter table if exists public.profiles add column if not exists display_name text;
alter table if exists public.profiles add column if not exists complete_name text;
alter table if exists public.profiles add column if not exists phone text;
alter table if exists public.profiles add column if not exists photo_url text;
alter table if exists public.profiles add column if not exists role text default 'client';
alter table if exists public.profiles add column if not exists plan text default 'free';
alter table if exists public.profiles add column if not exists status text default 'active';
alter table if exists public.profiles add column if not exists block_reason text;
alter table if exists public.profiles add column if not exists verified_email boolean default false;
alter table if exists public.profiles add column if not exists deleted_at timestamptz;
alter table if exists public.profiles add column if not exists payment_status text default 'pending';
alter table if exists public.profiles add column if not exists transaction_count integer default 0;
alter table if exists public.profiles add column if not exists billing jsonb default '{}'::jsonb;
alter table if exists public.profiles add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.profiles add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.profiles add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.user_settings add column if not exists uid text;
alter table if exists public.user_settings add column if not exists setting_key text;
alter table if exists public.user_settings add column if not exists data jsonb default '{}'::jsonb;
alter table if exists public.user_settings add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.user_settings add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.categories add column if not exists uid text;
alter table if exists public.categories add column if not exists source_id text;
alter table if exists public.categories add column if not exists name text;
alter table if exists public.categories add column if not exists parent_name text;
alter table if exists public.categories add column if not exists category_type text;
alter table if exists public.categories add column if not exists color text;
alter table if exists public.categories add column if not exists is_default boolean default false;
alter table if exists public.categories add column if not exists is_custom boolean default true;
alter table if exists public.categories add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.categories add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.categories add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.transactions add column if not exists uid text;
alter table if exists public.transactions add column if not exists source_id text;
alter table if exists public.transactions add column if not exists description text;
alter table if exists public.transactions add column if not exists amount numeric(17,2);
alter table if exists public.transactions add column if not exists amount_text text;
alter table if exists public.transactions add column if not exists amount_for_limit numeric(17,2);
alter table if exists public.transactions add column if not exists tx_type text;
alter table if exists public.transactions add column if not exists category text;
alter table if exists public.transactions add column if not exists tx_status text;
alter table if exists public.transactions add column if not exists payment_method text;
alter table if exists public.transactions add column if not exists card_id text;
alter table if exists public.transactions add column if not exists card_label text;
alter table if exists public.transactions add column if not exists card_type text;
alter table if exists public.transactions add column if not exists tx_date date;
alter table if exists public.transactions add column if not exists due_date date;
alter table if exists public.transactions add column if not exists group_id text;
alter table if exists public.transactions add column if not exists installment_current integer;
alter table if exists public.transactions add column if not exists installment_total integer;
alter table if exists public.transactions add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.transactions add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.transactions add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.payment_cards add column if not exists uid text;
alter table if exists public.payment_cards add column if not exists source_id text;
alter table if exists public.payment_cards add column if not exists bank_name text;
alter table if exists public.payment_cards add column if not exists last4 text;
alter table if exists public.payment_cards add column if not exists card_type text;
alter table if exists public.payment_cards add column if not exists brand text;
alter table if exists public.payment_cards add column if not exists bin text;
alter table if exists public.payment_cards add column if not exists due_date integer;
alter table if exists public.payment_cards add column if not exists limit_enabled boolean;
alter table if exists public.payment_cards add column if not exists credit_limit numeric(17,2);
alter table if exists public.payment_cards add column if not exists alert_threshold_pct numeric(6,2);
alter table if exists public.payment_cards add column if not exists block_on_limit_exceeded boolean;
alter table if exists public.payment_cards add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.payment_cards add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.payment_cards add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.piggy_banks add column if not exists uid text;
alter table if exists public.piggy_banks add column if not exists source_id text;
alter table if exists public.piggy_banks add column if not exists slug text;
alter table if exists public.piggy_banks add column if not exists name text;
alter table if exists public.piggy_banks add column if not exists goal_type text;
alter table if exists public.piggy_banks add column if not exists total_saved numeric(17,2) default 0;
alter table if exists public.piggy_banks add column if not exists withdrawal_mode text;
alter table if exists public.piggy_banks add column if not exists yield_type text;
alter table if exists public.piggy_banks add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.piggy_banks add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.piggy_banks add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.piggy_bank_history add column if not exists piggy_bank_id text;
alter table if exists public.piggy_bank_history add column if not exists uid text;
alter table if exists public.piggy_bank_history add column if not exists source_id text;
alter table if exists public.piggy_bank_history add column if not exists amount numeric(17,2);

alter table if exists public.transactions alter column amount type numeric(17,2);
alter table if exists public.transactions alter column amount_for_limit type numeric(17,2);
alter table if exists public.payment_cards alter column credit_limit type numeric(17,2);
alter table if exists public.piggy_banks alter column total_saved type numeric(17,2);
alter table if exists public.piggy_bank_history alter column amount type numeric(17,2);
alter table if exists public.piggy_bank_history add column if not exists withdrawal_mode text;
alter table if exists public.piggy_bank_history add column if not exists yield_type text;
alter table if exists public.piggy_bank_history add column if not exists source_type text;
alter table if exists public.piggy_bank_history add column if not exists card_id text;
alter table if exists public.piggy_bank_history add column if not exists card_label text;
alter table if exists public.piggy_bank_history add column if not exists applied_to_card_limit boolean;
alter table if exists public.piggy_bank_history add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.piggy_bank_history add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.piggy_bank_history add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.support_requests add column if not exists uid text;
alter table if exists public.support_requests add column if not exists email text;
alter table if exists public.support_requests add column if not exists name text;
alter table if exists public.support_requests add column if not exists title text;
alter table if exists public.support_requests add column if not exists message text;
alter table if exists public.support_requests add column if not exists ticket_type text;
alter table if exists public.support_requests add column if not exists ticket_status text;
alter table if exists public.support_requests add column if not exists assigned_to text;
alter table if exists public.support_requests add column if not exists assigned_to_name text;
alter table if exists public.support_requests add column if not exists staff_seen_by text[] default '{}';
alter table if exists public.support_requests add column if not exists votes integer default 0;
alter table if exists public.support_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.support_requests add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.support_requests add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.billing_events add column if not exists uid text;
alter table if exists public.billing_events add column if not exists event_type text;
alter table if exists public.billing_events add column if not exists action text;
alter table if exists public.billing_events add column if not exists provider text;
alter table if exists public.billing_events add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.billing_events add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.billing_events add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.support_access_requests add column if not exists requester_uid text;
alter table if exists public.support_access_requests add column if not exists target_uid text;
alter table if exists public.support_access_requests add column if not exists request_status text;
alter table if exists public.support_access_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.support_access_requests add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.support_access_requests add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.impersonation_action_requests add column if not exists requester_uid text;
alter table if exists public.impersonation_action_requests add column if not exists target_uid text;
alter table if exists public.impersonation_action_requests add column if not exists action_type text;
alter table if exists public.impersonation_action_requests add column if not exists action_status text;
alter table if exists public.impersonation_action_requests add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.impersonation_action_requests add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.impersonation_action_requests add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.log_acesso_suporte add column if not exists id_user text;
alter table if exists public.log_acesso_suporte add column if not exists id_user_impersonate text;
alter table if exists public.log_acesso_suporte add column if not exists permission_impersonate boolean;
alter table if exists public.log_acesso_suporte add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.log_acesso_suporte add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.log_acesso_suporte add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.system_configs add column if not exists data jsonb default '{}'::jsonb;
alter table if exists public.system_configs add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.system_configs add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.notifications add column if not exists uid text;
alter table if exists public.notifications add column if not exists kind text default 'system';
alter table if exists public.notifications add column if not exists title text;
alter table if exists public.notifications add column if not exists message text;
alter table if exists public.notifications add column if not exists href text;
alter table if exists public.notifications add column if not exists is_read boolean default false;
alter table if exists public.notifications add column if not exists meta jsonb default '{}'::jsonb;
alter table if exists public.notifications add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.notifications add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.admin_audit_logs add column if not exists actor_uid text;
alter table if exists public.admin_audit_logs add column if not exists action text;
alter table if exists public.admin_audit_logs add column if not exists target_uid text;
alter table if exists public.admin_audit_logs add column if not exists request_id text;
alter table if exists public.admin_audit_logs add column if not exists route text;
alter table if exists public.admin_audit_logs add column if not exists method text;
alter table if exists public.admin_audit_logs add column if not exists ip text;
alter table if exists public.admin_audit_logs add column if not exists user_agent text;
alter table if exists public.admin_audit_logs add column if not exists details jsonb default '{}'::jsonb;
alter table if exists public.admin_audit_logs add column if not exists created_at timestamptz default timezone('utc', now());

alter table if exists public.api_request_metrics add column if not exists route text;
alter table if exists public.api_request_metrics add column if not exists method text;
alter table if exists public.api_request_metrics add column if not exists status integer;
alter table if exists public.api_request_metrics add column if not exists duration_ms integer default 0;
alter table if exists public.api_request_metrics add column if not exists request_id text;
alter table if exists public.api_request_metrics add column if not exists uid text;
alter table if exists public.api_request_metrics add column if not exists error_code text;
alter table if exists public.api_request_metrics add column if not exists created_at timestamptz default timezone('utc', now());

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_set_updated_at on public.user_settings;
create trigger trg_user_settings_set_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_set_updated_at on public.categories;
create trigger trg_categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_set_updated_at on public.transactions;
create trigger trg_transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_cards_set_updated_at on public.payment_cards;
create trigger trg_payment_cards_set_updated_at before update on public.payment_cards
for each row execute function public.set_updated_at();

drop trigger if exists trg_piggy_banks_set_updated_at on public.piggy_banks;
create trigger trg_piggy_banks_set_updated_at before update on public.piggy_banks
for each row execute function public.set_updated_at();

drop trigger if exists trg_piggy_bank_history_set_updated_at on public.piggy_bank_history;
create trigger trg_piggy_bank_history_set_updated_at before update on public.piggy_bank_history
for each row execute function public.set_updated_at();

drop trigger if exists trg_support_requests_set_updated_at on public.support_requests;
create trigger trg_support_requests_set_updated_at before update on public.support_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_billing_events_set_updated_at on public.billing_events;
create trigger trg_billing_events_set_updated_at before update on public.billing_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_support_access_requests_set_updated_at on public.support_access_requests;
create trigger trg_support_access_requests_set_updated_at before update on public.support_access_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_impersonation_action_requests_set_updated_at on public.impersonation_action_requests;
create trigger trg_impersonation_action_requests_set_updated_at before update on public.impersonation_action_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_log_acesso_suporte_set_updated_at on public.log_acesso_suporte;
create trigger trg_log_acesso_suporte_set_updated_at before update on public.log_acesso_suporte
for each row execute function public.set_updated_at();

drop trigger if exists trg_system_configs_set_updated_at on public.system_configs;
create trigger trg_system_configs_set_updated_at before update on public.system_configs
for each row execute function public.set_updated_at();

drop trigger if exists trg_notifications_set_updated_at on public.notifications;
create trigger trg_notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();
