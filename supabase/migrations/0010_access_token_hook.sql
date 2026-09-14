-- Custom Access Token Hook (Architektur 7.1)
--
-- Ohne diesen Hook liefert auth_org_id() NULL und saemtliche Policies sperren
-- alles - die Anwendung waere funktionsfaehig angemeldet, saehe aber nichts.
--
-- Der Hook schreibt die aktive Organisation und die Rolle darin ins JWT.
-- Dadurch pruefen die Policies gegen einen Claim statt gegen einen Unterselect
-- auf organization_members. Das vermeidet zugleich die Rekursion, die
-- entsteht, sobald diese Tabelle selbst RLS traegt.
--
-- ACHTUNG: Der Hook muss zusaetzlich im Supabase-Dashboard aktiviert werden
-- unter Authentication -> Hooks -> Customize Access Token (JWT) Claims.
-- Migration allein genuegt nicht.

create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_user   uuid;
  v_org    uuid;
  v_role   public.org_role;
  v_member uuid;
  v_claims jsonb;
  v_app    jsonb;
begin
  v_user := (event ->> 'user_id')::uuid;

  -- Aktive Organisation des Profils, aber nur wenn die Mitgliedschaft
  -- wirklich noch besteht und aktiv ist. Ein deaktiviertes Mitglied behaelt
  -- sonst bis zum Ablauf des Tokens vollen Zugriff.
  select m.organization_id, m.role, m.id
    into v_org, v_role, v_member
    from public.profiles p
    join public.organization_members m
      on m.organization_id = p.active_organization_id
     and m.user_id = p.id
     and m.is_active
   where p.id = v_user;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_app    := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);

  if v_org is not null then
    v_app := v_app
      || jsonb_build_object(
           'organization_id',   v_org::text,
           'organization_role', v_role::text,
           'member_id',         v_member::text
         );
  else
    -- Ausdruecklich leeren statt stehen lassen: sonst traegt ein Nutzer nach
    -- dem Verlassen einer Organisation deren Claim weiter mit sich herum.
    v_app := v_app - 'organization_id' - 'organization_role' - 'member_id';
  end if;

  return jsonb_set(event, '{claims,app_metadata}', v_app);
end;
$$;

-- Nur der Auth-Dienst darf den Hook aufrufen. Waere er fuer angemeldete
-- Nutzer ausfuehrbar, koennte sich jemand eigene Claims zusammenbauen.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
    grant select on table public.profiles, public.organization_members to supabase_auth_admin;
  end if;
end $$;

revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

comment on function public.custom_access_token_hook(jsonb) is
  'Schreibt organization_id, organization_role und member_id ins JWT. Muss im Dashboard unter Authentication -> Hooks aktiviert werden.';

select public.apply_tenant_rls();
select public.assert_rls_complete();
