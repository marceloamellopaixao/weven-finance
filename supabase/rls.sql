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
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_cards enable row level security;
alter table public.piggy_banks enable row level security;
alter table public.piggy_bank_history enable row level security;
alter table public.support_requests enable row level security;
alter table public.support_request_attachments enable row level security;
alter table public.support_request_messages enable row level security;
alter table public.support_request_events enable row level security;
alter table public.billing_events enable row level security;
alter table public.processed_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.foundation_plan_claims enable row level security;
alter table public.support_access_requests enable row level security;
alter table public.impersonation_action_requests enable row level security;
alter table public.log_acesso_suporte enable row level security;
alter table public.system_configs enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.api_request_metrics enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.migration_runs enable row level security;
alter table public.product_events enable row level security;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_staff_select on public.profiles;
drop policy if exists profiles_select_own_or_staff on public.profiles;
drop policy if exists profiles_insert_own_or_staff on public.profiles;
drop policy if exists profiles_update_own_or_staff on public.profiles;
drop policy if exists user_settings_self_all on public.user_settings;
drop policy if exists categories_self_all on public.categories;
drop policy if exists workspaces_self_all on public.workspaces;
drop policy if exists workspace_members_self_select on public.workspace_members;
drop policy if exists workspace_invitations_self_select on public.workspace_invitations;
drop policy if exists transactions_self_all on public.transactions;
drop policy if exists payment_cards_self_all on public.payment_cards;
drop policy if exists piggy_banks_self_all on public.piggy_banks;
drop policy if exists piggy_bank_history_self_all on public.piggy_bank_history;
drop policy if exists support_access_requests_insert_requester on public.support_access_requests;
drop policy if exists support_requests_delete_staff on public.support_requests;
drop policy if exists support_requests_select_own_or_staff on public.support_requests;
drop policy if exists support_requests_insert_own on public.support_requests;
drop policy if exists support_requests_update_own_or_staff on public.support_requests;
drop policy if exists support_requests_delete_admin on public.support_requests;
drop policy if exists support_attachments_select_own on public.support_request_attachments;
drop policy if exists support_attachments_insert_own on public.support_request_attachments;
drop policy if exists support_attachments_delete_own on public.support_request_attachments;
drop policy if exists support_messages_select_own on public.support_request_messages;
drop policy if exists support_messages_insert_own on public.support_request_messages;
drop policy if exists support_events_select_own on public.support_request_events;
drop policy if exists support_evidence_select_own on storage.objects;
drop policy if exists support_evidence_insert_own on storage.objects;
drop policy if exists support_evidence_delete_own on storage.objects;
drop policy if exists system_configs_select_authenticated on public.system_configs;

-- Profiles contain authorization, plan and billing fields. All mutations go
-- through authenticated server routes that use service_role; browser clients
-- only need SELECT for their own row and Realtime subscriptions.
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Defense in depth: if a future grant accidentally restores direct writes,
-- privileged fields still cannot be forged by an authenticated browser user.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
     or current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.uid is distinct from public.current_user_uid()
       or new.email is not null
       or new.role is distinct from 'client'
       or new.plan is distinct from 'free'
       or new.status is distinct from 'active'
       or new.block_reason is not null
       or new.verified_email is distinct from false
       or new.deleted_at is not null
       or new.payment_status is distinct from 'pending'
       or new.transaction_count is distinct from 0
       or new.billing is distinct from '{}'::jsonb
       or new.raw is distinct from '{}'::jsonb then
      raise exception 'profile_privileged_fields_are_server_managed'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.uid is distinct from old.uid
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.plan is distinct from old.plan
       or new.status is distinct from old.status
       or new.block_reason is distinct from old.block_reason
       or new.verified_email is distinct from old.verified_email
       or new.deleted_at is distinct from old.deleted_at
       or new.payment_status is distinct from old.payment_status
       or new.transaction_count is distinct from old.transaction_count
       or new.billing is distinct from old.billing
       or new.raw is distinct from old.raw
       or new.created_at is distinct from old.created_at then
      raise exception 'profile_privileged_fields_are_server_managed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public;

drop trigger if exists trg_profiles_protect_privileged_fields on public.profiles;
create trigger trg_profiles_protect_privileged_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own_or_staff') then
    create policy profiles_select_own_or_staff on public.profiles
      for select to authenticated
      using (public.current_user_uid() = uid or public.is_staff_role());
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

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and policyname = 'workspaces_own_all') then
    create policy workspaces_own_all on public.workspaces
      for all using (public.current_user_uid() = uid)
      with check (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspaces' and policyname = 'workspaces_staff_read') then
    create policy workspaces_staff_read on public.workspaces
      for select using (public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_members' and policyname = 'workspace_members_visible_to_member_owner_or_staff') then
    create policy workspace_members_visible_to_member_owner_or_staff on public.workspace_members
      for select using (
        public.current_user_uid() = member_uid
        or public.current_user_uid() = workspace_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_members' and policyname = 'workspace_members_owner_or_staff_write') then
    create policy workspace_members_owner_or_staff_write on public.workspace_members
      for all using (public.current_user_uid() = workspace_uid or public.is_staff_role())
      with check (public.current_user_uid() = workspace_uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'workspace_invitations_owner_invitee_or_staff_read') then
    create policy workspace_invitations_owner_invitee_or_staff_read on public.workspace_invitations
      for select using (
        public.current_user_uid() = workspace_uid
        or public.current_user_uid() = invited_member_uid
        or public.is_staff_role()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'workspace_invitations_owner_or_staff_write') then
    create policy workspace_invitations_owner_or_staff_write on public.workspace_invitations
      for all using (public.current_user_uid() = workspace_uid or public.is_staff_role())
      with check (public.current_user_uid() = workspace_uid or public.is_staff_role());
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

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_requests' and policyname = 'support_requests_select_own') then
    create policy support_requests_select_own on public.support_requests
      for select using (public.current_user_uid() = uid);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_request_attachments' and policyname = 'support_attachments_select_own') then
    create policy support_attachments_select_own on public.support_request_attachments
      for select using (public.current_user_uid() = owner_uid and visibility = 'public');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'billing_events' and policyname = 'billing_events_select_own_or_staff') then
    create policy billing_events_select_own_or_staff on public.billing_events
      for select using (public.current_user_uid() = uid or public.is_staff_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_own_or_staff') then
    create policy subscriptions_select_own_or_staff on public.subscriptions
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
      for select to authenticated
      using (
        public.current_user_uid() is not null
        and key in ('plans', 'category_presets')
      );
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

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'performance_metrics' and policyname = 'performance_metrics_select_staff') then
    create policy performance_metrics_select_staff on public.performance_metrics
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

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_events' and policyname = 'product_events_select_staff') then
    create policy product_events_select_staff on public.product_events
      for select using (public.is_staff_role());
  end if;
end $$;
