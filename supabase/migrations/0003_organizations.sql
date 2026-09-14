-- Phase 0/1 - Organisation als erste Mandantentabelle

create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) between 1 and 200),
  slug           citext not null unique,
  plan           text not null default 'trial',
  seats          int  not null default 1 check (seats > 0),
  default_locale text not null default 'de-CH',
  require_mfa    boolean not null default false,
  branding       jsonb not null default '{}'::jsonb,
  settings       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create trigger trg_organizations_touch before update on organizations
  for each row execute function public.touch_updated_at();

-- organizations traegt selbst keine organization_id und wird deshalb nicht
-- vom Generator erfasst (Datenbankstruktur 14.2).
alter table organizations enable row level security;
alter table organizations force  row level security;

create policy organizations_select on organizations for select to authenticated
  using (id = public.auth_org_id());

create policy organizations_update on organizations for update to authenticated
  using (id = public.auth_org_id() and public.has_permission('organization:write'))
  with check (id = public.auth_org_id());
