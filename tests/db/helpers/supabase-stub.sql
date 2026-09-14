-- Supabase-Bestandteile, die in einer nackten Postgres-Instanz fehlen.
-- Damit laufen die RLS-Tests ohne Supabase-CLI und ohne Docker gegen ein
-- beliebiges Postgres - in CI als Service-Container, lokal als Instanz.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
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
end $$;

grant usage on schema public, auth to authenticated, anon, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
