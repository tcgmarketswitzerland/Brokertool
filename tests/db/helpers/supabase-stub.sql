-- Supabase-Bestandteile, die in einer nackten Postgres-Instanz fehlen.
-- Damit laufen die RLS-Tests ohne Supabase-CLI und ohne Docker gegen ein
-- beliebiges Postgres - in CI als Service-Container, lokal als Instanz.
create schema if not exists auth;

-- Nachbildung der Spalten von auth.users, die unsere Migrationen tatsaechlich
-- lesen. Bewusst nicht vollstaendig: was hier fehlt, benutzen wir auch nicht -
-- und wenn doch, faellt es genau hier auf.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
  language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  -- Rolle, unter der Supabase den Access-Token-Hook ausfuehrt
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin;
  end if;
end $$;

grant usage on schema public, auth to authenticated, anon, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

