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
  workspace_id text,
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

create table if not exists public.workspaces (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  source_id text not null,
  name text not null,
  workspace_type text not null default 'personal',
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (uid, source_id)
);

create table if not exists public.workspace_members (
  id text primary key,
  workspace_uid text not null references public.profiles(uid) on delete cascade,
  workspace_id text not null,
  member_uid text not null references public.profiles(uid) on delete cascade,
  email text,
  display_name text,
  member_role text not null default 'guest_member',
  permissions text[] not null default '{}',
  member_status text not null default 'active',
  invited_by_uid text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_uid, workspace_id, member_uid)
);

create table if not exists public.workspace_invitations (
  id text primary key,
  workspace_uid text not null references public.profiles(uid) on delete cascade,
  workspace_id text not null,
  email text not null,
  member_role text not null default 'guest_member',
  permissions text[] not null default '{}',
  invitation_status text not null default 'pending',
  invited_by_uid text not null,
  invited_member_uid text,
  expires_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.reserve_business_workspace_invitation(
  p_workspace_uid text,
  p_workspace_id text,
  p_capacity integer,
  p_member jsonb,
  p_invitation jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  occupied_slots integer;
begin
  if p_workspace_uid is null or btrim(p_workspace_uid) = ''
    or p_workspace_id is null or btrim(p_workspace_id) = ''
    or p_capacity is null or p_capacity < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('wevenfinance:workspace-seat:' || p_workspace_uid || ':' || p_workspace_id));

  select count(distinct member_uid) into occupied_slots
  from public.workspace_members
  where workspace_uid = p_workspace_uid
    and workspace_id = p_workspace_id
    and member_status in ('active', 'pending');

  if not exists (
    select 1 from public.workspace_members
    where workspace_uid = p_workspace_uid
      and workspace_id = p_workspace_id
      and member_uid = p_workspace_uid
      and member_status in ('active', 'pending')
  ) then
    occupied_slots := occupied_slots + 1;
  end if;

  if occupied_slots >= p_capacity then
    return false;
  end if;

  insert into public.workspace_members (
    id, workspace_uid, workspace_id, member_uid, email, display_name, member_role,
    permissions, member_status, invited_by_uid, raw, created_at, updated_at
  ) values (
    p_member->>'id', p_workspace_uid, p_workspace_id, p_member->>'member_uid',
    p_member->>'email', p_member->>'display_name', p_member->>'member_role',
    array(select jsonb_array_elements_text(coalesce(p_member->'permissions', '[]'::jsonb))),
    coalesce(p_member->>'member_status', 'pending'), p_member->>'invited_by_uid',
    coalesce(p_member->'raw', '{}'::jsonb),
    coalesce((p_member->>'created_at')::timestamptz, timezone('utc', now())),
    coalesce((p_member->>'updated_at')::timestamptz, timezone('utc', now()))
  ) on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    member_role = excluded.member_role,
    permissions = excluded.permissions,
    member_status = excluded.member_status,
    invited_by_uid = excluded.invited_by_uid,
    raw = excluded.raw,
    updated_at = excluded.updated_at;

  insert into public.workspace_invitations (
    id, workspace_uid, workspace_id, email, member_role, permissions,
    invitation_status, invited_by_uid, invited_member_uid, expires_at, raw, created_at, updated_at
  ) values (
    p_invitation->>'id', p_workspace_uid, p_workspace_id, p_invitation->>'email',
    p_invitation->>'member_role',
    array(select jsonb_array_elements_text(coalesce(p_invitation->'permissions', '[]'::jsonb))),
    coalesce(p_invitation->>'invitation_status', 'pending'), p_invitation->>'invited_by_uid',
    p_invitation->>'invited_member_uid', (p_invitation->>'expires_at')::timestamptz,
    coalesce(p_invitation->'raw', '{}'::jsonb),
    coalesce((p_invitation->>'created_at')::timestamptz, timezone('utc', now())),
    coalesce((p_invitation->>'updated_at')::timestamptz, timezone('utc', now()))
  );

  return true;
end;
$$;

revoke all on function public.reserve_business_workspace_invitation(text, text, integer, jsonb, jsonb) from public;
grant execute on function public.reserve_business_workspace_invitation(text, text, integer, jsonb, jsonb) to service_role;

create table if not exists public.transactions (
  id text primary key,
  uid text not null references public.profiles(uid) on delete cascade,
  workspace_id text,
  created_by_uid text,
  source_id text not null,
  title text,
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
  workspace_id text,
  source_id text not null,
  bank_name text,
  last4 text,
  card_type text,
  brand text,
  bin text,
  due_date integer,
  closing_day integer,
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
  workspace_id text,
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
  workspace_id text,
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

create table if not exists public.processed_events (
  id text not null,
  provider text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (id, provider)
);

create table if not exists public.subscriptions (
  uid text primary key references public.profiles(uid) on delete cascade,
  provider text not null default 'mercadopago',
  provider_subscription_id text not null unique,
  plan text not null default 'free',
  status text not null default 'pending',
  current_period_end timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.foundation_plan_claims (
  uid text primary key references public.profiles(uid) on delete cascade,
  claim_status text not null default 'pending' check (claim_status in ('pending', 'active')),
  claimed_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.claim_foundation_plan_slot(p_uid text, p_max_users integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_claim public.foundation_plan_claims%rowtype;
  occupied_slots integer;
begin
  if p_uid is null or btrim(p_uid) = '' or p_max_users is null or p_max_users < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('wevenfinance:foundation-plan'));

  delete from public.foundation_plan_claims
  where claim_status = 'pending'
    and expires_at is not null
    and expires_at <= timezone('utc', now());

  select * into existing_claim
  from public.foundation_plan_claims
  where uid = p_uid;

  if found then
    if existing_claim.claim_status = 'pending' then
      update public.foundation_plan_claims
      set expires_at = timezone('utc', now()) + interval '24 hours', updated_at = timezone('utc', now())
      where uid = p_uid;
    end if;
    return true;
  end if;

  select count(*) into occupied_slots from public.foundation_plan_claims;
  if occupied_slots >= p_max_users then
    return false;
  end if;

  insert into public.foundation_plan_claims (uid, claim_status, expires_at)
  values (p_uid, 'pending', timezone('utc', now()) + interval '24 hours');
  return true;
end;
$$;

revoke all on function public.claim_foundation_plan_slot(text, integer) from public;
grant execute on function public.claim_foundation_plan_slot(text, integer) to service_role;

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
alter table if exists public.categories add column if not exists workspace_id text;
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

alter table if exists public.workspaces add column if not exists uid text;
alter table if exists public.workspaces add column if not exists source_id text;
alter table if exists public.workspaces add column if not exists name text;
alter table if exists public.workspaces add column if not exists workspace_type text default 'personal';
alter table if exists public.workspaces add column if not exists is_default boolean default false;
alter table if exists public.workspaces add column if not exists settings jsonb default '{}'::jsonb;
alter table if exists public.workspaces add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.workspaces add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.workspaces add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.workspace_members add column if not exists workspace_uid text;
alter table if exists public.workspace_members add column if not exists workspace_id text;
alter table if exists public.workspace_members add column if not exists member_uid text;
alter table if exists public.workspace_members add column if not exists email text;
alter table if exists public.workspace_members add column if not exists display_name text;
alter table if exists public.workspace_members add column if not exists member_role text default 'guest_member';
alter table if exists public.workspace_members add column if not exists permissions text[] default '{}';
alter table if exists public.workspace_members add column if not exists member_status text default 'active';
alter table if exists public.workspace_members add column if not exists invited_by_uid text;
alter table if exists public.workspace_members add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.workspace_members add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.workspace_members add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.workspace_invitations add column if not exists workspace_uid text;
alter table if exists public.workspace_invitations add column if not exists workspace_id text;
alter table if exists public.workspace_invitations add column if not exists email text;
alter table if exists public.workspace_invitations add column if not exists member_role text default 'guest_member';
alter table if exists public.workspace_invitations add column if not exists permissions text[] default '{}';
alter table if exists public.workspace_invitations add column if not exists invitation_status text default 'pending';
alter table if exists public.workspace_invitations add column if not exists invited_by_uid text;
alter table if exists public.workspace_invitations add column if not exists invited_member_uid text;
alter table if exists public.workspace_invitations add column if not exists expires_at timestamptz;
alter table if exists public.workspace_invitations add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.workspace_invitations add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.workspace_invitations add column if not exists updated_at timestamptz default timezone('utc', now());

create index if not exists idx_workspace_invitations_member_status
  on public.workspace_invitations(invited_member_uid, invitation_status, created_at desc);

with duplicate_pending_invitations as (
  select id,
    row_number() over (
      partition by workspace_uid, workspace_id, lower(email)
      order by created_at desc, id desc
    ) as position
  from public.workspace_invitations
  where invitation_status = 'pending'
)
update public.workspace_invitations
set invitation_status = 'revoked', updated_at = timezone('utc', now())
where id in (select id from duplicate_pending_invitations where position > 1);

create unique index if not exists idx_workspace_invitations_one_pending_per_email
  on public.workspace_invitations(workspace_uid, workspace_id, lower(email))
  where invitation_status = 'pending';

alter table if exists public.transactions add column if not exists uid text;
alter table if exists public.transactions add column if not exists workspace_id text;
alter table if exists public.transactions add column if not exists created_by_uid text;
alter table if exists public.transactions add column if not exists source_id text;
alter table if exists public.transactions add column if not exists title text;
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
alter table if exists public.payment_cards add column if not exists workspace_id text;
alter table if exists public.payment_cards add column if not exists source_id text;
alter table if exists public.payment_cards add column if not exists bank_name text;
alter table if exists public.payment_cards add column if not exists last4 text;
alter table if exists public.payment_cards add column if not exists card_type text;
alter table if exists public.payment_cards add column if not exists brand text;
alter table if exists public.payment_cards add column if not exists bin text;
alter table if exists public.payment_cards add column if not exists due_date integer;
alter table if exists public.payment_cards add column if not exists closing_day integer;
alter table if exists public.payment_cards add column if not exists limit_enabled boolean;
alter table if exists public.payment_cards add column if not exists credit_limit numeric(17,2);
alter table if exists public.payment_cards add column if not exists alert_threshold_pct numeric(6,2);
alter table if exists public.payment_cards add column if not exists block_on_limit_exceeded boolean;
alter table if exists public.payment_cards add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.payment_cards add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.payment_cards add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.piggy_banks add column if not exists uid text;
alter table if exists public.piggy_banks add column if not exists workspace_id text;
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
alter table if exists public.piggy_bank_history add column if not exists workspace_id text;
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

alter table if exists public.processed_events add column if not exists id text;
alter table if exists public.processed_events add column if not exists provider text;
alter table if exists public.processed_events add column if not exists created_at timestamptz default timezone('utc', now());

alter table if exists public.subscriptions add column if not exists uid text;
alter table if exists public.subscriptions add column if not exists provider text default 'mercadopago';
alter table if exists public.subscriptions add column if not exists provider_subscription_id text;
alter table if exists public.subscriptions add column if not exists plan text default 'free';
alter table if exists public.subscriptions add column if not exists status text default 'pending';
alter table if exists public.subscriptions add column if not exists current_period_end timestamptz;
alter table if exists public.subscriptions add column if not exists raw jsonb default '{}'::jsonb;
alter table if exists public.subscriptions add column if not exists created_at timestamptz default timezone('utc', now());
alter table if exists public.subscriptions add column if not exists updated_at timestamptz default timezone('utc', now());

alter table if exists public.foundation_plan_claims add column if not exists claim_status text default 'pending';
alter table if exists public.foundation_plan_claims add column if not exists claimed_at timestamptz default timezone('utc', now());
alter table if exists public.foundation_plan_claims add column if not exists activated_at timestamptz;
alter table if exists public.foundation_plan_claims add column if not exists expires_at timestamptz;
alter table if exists public.foundation_plan_claims add column if not exists updated_at timestamptz default timezone('utc', now());

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

drop trigger if exists trg_workspaces_set_updated_at on public.workspaces;
create trigger trg_workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_members_set_updated_at on public.workspace_members;
create trigger trg_workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger trg_workspace_invitations_set_updated_at before update on public.workspace_invitations
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

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_foundation_plan_claims_set_updated_at on public.foundation_plan_claims;
create trigger trg_foundation_plan_claims_set_updated_at before update on public.foundation_plan_claims
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

create table if not exists public.product_events (
  id uuid primary key,
  uid text null,
  session_id text null,
  event_name text not null,
  path text null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
