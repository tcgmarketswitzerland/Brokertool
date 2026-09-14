-- Phase 1 - Nutzer, Mitgliedschaften, Einladungen

create type invitation_status as enum ('PENDING','ACCEPTED','REVOKED','EXPIRED');

-- Klasse C (Datenbankstruktur 1.2): gehoert dem Nutzer, nicht der Organisation.
create table profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  citext not null,
  full_name              text,
  active_organization_id uuid references organizations(id) on delete set null,
  locale                 text not null default 'de-CH',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table profiles enable row level security;
alter table profiles force  row level security;

-- Ohne Ausnahme: ein Profil sieht nur sich selbst. Die Namen der Kolleginnen
-- und Kollegen kommen aus organization_members, siehe Hinweis unten.
create policy profiles_select on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create trigger trg_profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();

-- display_name und email sind hier bewusst dupliziert. Laegen sie nur in
-- profiles, braeuchte es eine Policy, die fremde Profile lesbar macht, sobald
-- man eine Organisation teilt - ein Unterselect in einer sicherheits-
-- kritischen Policy. Die Denormalisierung ist die einfachere und sicherere
-- Loesung; ein Trigger haelt sie aktuell.
create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            org_role not null default 'ADVISOR',
  display_name    text not null,
  email           citext not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create trigger trg_members_touch before update on organization_members
  for each row execute function public.touch_updated_at();

create index organization_members_user_idx on organization_members (user_id);

-- Jede Organisation braucht mindestens einen Owner. Der Index verhindert
-- nicht das Entfernen des letzten - das prueft eine Funktion in 0007 -,
-- macht aber die Abfrage billig.
create index organization_members_owner_idx
  on organization_members (organization_id) where role = 'OWNER' and is_active;

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           citext not null,
  role            org_role not null default 'ADVISOR',
  -- Nie das Klartext-Token speichern: wer die Tabelle lesen kann, koennte
  -- sonst jede offene Einladung uebernehmen.
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  status          invitation_status not null default 'PENDING',
  invited_by      uuid references profiles(id) on delete set null,
  accepted_at     timestamptz,
  accepted_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_invitations_touch before update on invitations
  for each row execute function public.touch_updated_at();

create unique index invitations_one_pending_per_email
  on invitations (organization_id, email) where status = 'PENDING';

create index invitations_token_idx on invitations (token_hash) where status = 'PENDING';
