-- WevenFinance - consolidated row level security policies

create or replace function public.current_user_uid()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb;
begin
  if auth.uid() is not null then
    return auth.uid()::text;
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;

  return claims ->> 'sub';
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    (select p.role from public.profiles p where p.uid = public.current_user_uid()),
    'client'
  );
$$;

create or replace function public.is_staff_role()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'moderator', 'support');
$$;

create or replace function public.is_manager_role()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'moderator');
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin';
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_cards enable row level security;
alter table public.piggy_banks enable row level security;
alter table public.piggy_bank_history enable row level security;
alter table public.support_requests enable row level security;
alter table public.billing_events enable row level security;
alter table public.support_access_requests enable row level security;
alter table public.impersonation_action_requests enable row level security;
alter table public.log_acesso_suporte enable row level security;
alter table public.system_configs enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.api_request_metrics enable row level security;
alter table public.migration_runs enable row level security;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_staff_select on public.profiles;
drop policy if exists user_settings_self_all on public.user_settings;
drop policy if exists categories_self_all on public.categories;
drop policy if exists transactions_self_all on public.transactions;
drop policy if exists payment_cards_self_all on public.payment_cards;
drop policy if exists piggy_banks_self_all on public.piggy_banks;
drop policy if exists piggy_bank_history_self_all on public.piggy_bank_history;
drop policy if exists support_access_requests_insert_requester on public.support_access_requests;
drop policy if exists support_requests_delete_staff on public.support_requests;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own_or_staff') then
    create policy profiles_select_own_or_staff on public.profiles
      for select using (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own_or_staff') then
    create policy profiles_insert_own_or_staff on public.profiles
      for insert with check (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own_or_staff') then
    create policy profiles_update_own_or_staff on public.profiles
      for update using (public.current_user_uid() = uid or public.is_staff_role())
      with check (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'user_settings_own_all') then
    create policy user_settings_own_all on public.user_settings
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_settings' and policyname = 'user_settings_staff_read') then
    create policy user_settings_staff_read on public.user_settings
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_own_all') then
    create policy categories_own_all on public.categories
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'categories_staff_read') then
    create policy categories_staff_read on public.categories
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_own_all') then
    create policy transactions_own_all on public.transactions
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_staff_read') then
    create policy transactions_staff_read on public.transactions
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_cards' and policyname = 'payment_cards_own_all') then
    create policy payment_cards_own_all on public.payment_cards
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_cards' and policyname = 'payment_cards_staff_read') then
    create policy payment_cards_staff_read on public.payment_cards
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piggy_banks' and policyname = 'piggy_banks_own_all') then
    create policy piggy_banks_own_all on public.piggy_banks
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piggy_banks' and policyname = 'piggy_banks_staff_read') then
    create policy piggy_banks_staff_read on public.piggy_banks
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piggy_bank_history' and policyname = 'piggy_bank_history_own_all') then
    create policy piggy_bank_history_own_all on public.piggy_bank_history
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piggy_bank_history' and policyname = 'piggy_bank_history_staff_read') then
    create policy piggy_bank_history_staff_read on public.piggy_bank_history
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_select_own_or_staff') then
    create policy support_requests_select_own_or_staff on public.support_requests
      for select using (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_insert_own') then
    create policy support_requests_insert_own on public.support_requests
      for insert with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_update_own_or_staff') then
    create policy support_requests_update_own_or_staff on public.support_requests
      for update using (public.current_user_uid() = uid or public.is_staff_role())
      with check (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_delete_admin') then
    create policy support_requests_delete_admin on public.support_requests
      for delete using (public.is_admin_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'billing_events' and policyname = 'billing_events_select_own_or_staff') then
    create policy billing_events_select_own_or_staff on public.billing_events
      for select using (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_access_requests' and policyname = 'support_access_requests_select_involved_or_staff') then
    create policy support_access_requests_select_involved_or_staff on public.support_access_requests
      for select using (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_access_requests' and policyname = 'support_access_requests_insert_requester_or_staff') then
    create policy support_access_requests_insert_requester_or_staff on public.support_access_requests
      for insert with check (
        public.current_user_uid() = requester_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_access_requests' and policyname = 'support_access_requests_update_involved_or_staff') then
    create policy support_access_requests_update_involved_or_staff on public.support_access_requests
      for update using (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      )
      with check (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'impersonation_action_requests' and policyname = 'impersonation_action_requests_select_involved_or_staff') then
    create policy impersonation_action_requests_select_involved_or_staff on public.impersonation_action_requests
      for select using (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'impersonation_action_requests' and policyname = 'impersonation_action_requests_insert_requester_or_staff') then
    create policy impersonation_action_requests_insert_requester_or_staff on public.impersonation_action_requests
      for insert with check (
        public.current_user_uid() = requester_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'impersonation_action_requests' and policyname = 'impersonation_action_requests_update_involved_or_staff') then
    create policy impersonation_action_requests_update_involved_or_staff on public.impersonation_action_requests
      for update using (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      )
      with check (
        public.current_user_uid() = requester_uid
        or public.current_user_uid() = target_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'log_acesso_suporte' and policyname = 'log_acesso_suporte_select_involved_or_staff') then
    create policy log_acesso_suporte_select_involved_or_staff on public.log_acesso_suporte
      for select using (
        public.current_user_uid() = id_user
        or public.current_user_uid() = id_user_impersonate
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'log_acesso_suporte' and policyname = 'log_acesso_suporte_insert_staff') then
    create policy log_acesso_suporte_insert_staff on public.log_acesso_suporte
      for insert with check (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_configs' and policyname = 'system_configs_select_authenticated') then
    create policy system_configs_select_authenticated on public.system_configs
      for select using (public.current_user_uid() is not null);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_configs' and policyname = 'system_configs_write_manager') then
    create policy system_configs_write_manager on public.system_configs
      for all using (public.is_manager_role())
      with check (public.is_manager_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own') then
    create policy notifications_select_own on public.notifications
      for select using (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own') then
    create policy notifications_update_own on public.notifications
      for update using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_delete_own') then
    create policy notifications_delete_own on public.notifications
      for delete using (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit_logs' and policyname = 'admin_audit_logs_select_staff') then
    create policy admin_audit_logs_select_staff on public.admin_audit_logs
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'api_request_metrics' and policyname = 'api_request_metrics_select_staff') then
    create policy api_request_metrics_select_staff on public.api_request_metrics
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'migration_runs' and policyname = 'migration_runs_select_staff') then
    create policy migration_runs_select_staff on public.migration_runs
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'migration_runs' and policyname = 'migration_runs_write_admin') then
    create policy migration_runs_write_admin on public.migration_runs
      for all using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;
end $$;
