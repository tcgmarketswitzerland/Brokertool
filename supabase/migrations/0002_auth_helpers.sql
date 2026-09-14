-- Phase 0 - Zugriffskontext aus dem JWT (Architektur 7.1, 8.2)
--
-- 'stable' ist hier kein Kosmetik-Detail: ohne das Schluesselwort wertet der
-- Planer die Funktion pro Zeile aus statt einmal pro Query. Bei einer
-- Kundenliste mit 2000 Zeilen ist das der Unterschied zwischen wenigen
-- Millisekunden und einer spuerbaren Verzoegerung.

-- Das innere nullif ist nicht optional: ein leerer Claim-String laesst
-- ''::jsonb mit "invalid input syntax for type json" scheitern. Eine
-- Zugriffsfunktion muss bei fehlendem JWT sauber NULL liefern statt zu
-- werfen - sonst wird aus einem fehlenden Login ein Serverfehler.
create or replace function public.auth_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'organization_id', ''
  )::uuid;
$$;

create or replace function public.auth_org_role() returns public.org_role
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'organization_role', ''
  )::public.org_role;
$$;

-- Rechtematrix an genau einer Stelle (Konzeptpunkt 20).
-- Die Tabellenname-basierte Form erlaubt dem Policy-Generator, die Aufrufe
-- mechanisch zu erzeugen, statt fuer jede Tabelle eine Aktion zu erfinden.

create or replace function public.can_read(p_table text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case public.auth_org_role()
    when 'OWNER' then true
    when 'ADMIN' then true
    when 'ADVISOR' then p_table <> 'audit_logs'
    when 'BACKOFFICE' then p_table not in ('audit_logs','invitations')
    else false
  end;
$$;

create or replace function public.can_write(p_table text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case public.auth_org_role()
    when 'OWNER' then true
    when 'ADMIN' then true
    when 'ADVISOR' then p_table in (
      'customers','customer_persons','customer_addresses','consents',
      'advice_sessions','advice_session_topics','advice_session_participants',
      'advice_command_log','notes','policies','documents','tasks',
      'pension_analyses','pension_analysis_items','email_summaries')
    -- Backoffice pflegt nach, fuehrt aber keine Beratung (Konzeptpunkt 20).
    when 'BACKOFFICE' then p_table in (
      'customers','customer_persons','customer_addresses',
      'policies','documents','tasks')
    else false
  end;
$$;

create or replace function public.can_delete(p_table text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case public.auth_org_role()
    when 'OWNER' then true
    when 'ADMIN' then p_table not in ('audit_logs','advice_session_snapshots','signatures')
    else false
  end;
$$;

-- Aktionsbasierte Variante fuer fachliche Sonderrechte ausserhalb der Policies.
create or replace function public.has_permission(p_action text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case public.auth_org_role()
    when 'OWNER'      then true
    when 'ADMIN'      then p_action <> 'organization:billing'
    when 'ADVISOR'    then p_action in ('advice:complete','advice:sign')
    when 'BACKOFFICE' then false
    else false
  end;
$$;

create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
