-- Phase 6 - Abschluss, Snapshot und Unterschrift (Konzeptpunkt 29, ADR-001)
--
-- Eine abgeschlossene Beratung darf ihre Aussage spaeter nicht veraendern,
-- nur weil sich eine Police geaendert hat. Statt jede Tabelle bi-temporal
-- zu fuehren - fuer ein Ein-Personen-Projekt zu schwer - wird der fachliche
-- Zustand beim Abschluss einmal als JSON eingefroren, mit Hash.
--
-- Ab diesem Moment greift der Schreibschutz in der Datenbank, nicht nur in
-- der Anwendung. Eine Nachvollziehbarkeit, die sich durch einen vergessenen
-- Codepfad aushebeln laesst, ist keine.

create type signature_kind as enum ('CUSTOMER','ADVISOR');

create table advice_session_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade unique,
  schema_version  int  not null default 1,
  document        jsonb not null,
  content_hash    text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null
);

create table signatures (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  session_id       uuid not null references advice_sessions(id) on delete cascade,
  snapshot_id      uuid not null references advice_session_snapshots(id) on delete restrict,
  kind             signature_kind not null default 'CUSTOMER',
  signer_person_id uuid references customer_persons(id) on delete set null,
  signer_name      text not null,
  storage_path     text not null,
  signed_at        timestamptz not null default now(),
  -- Klartext, nicht gehasht: der einzige Zweck ist der Nachweis im
  -- Streitfall, und ein Hash waere dafuer wertlos. Begruendete Bearbeitung,
  -- gehoert so ins Bearbeitungsverzeichnis.
  signed_ip        inet,
  user_agent       text
);

create index signatures_session_idx on signatures (session_id);

-- Anfuegende Tabellen: eigener Policy-Satz, kein Update, kein Delete.
alter table advice_session_snapshots enable row level security;
alter table advice_session_snapshots force  row level security;
alter table advice_session_snapshots
  alter column organization_id set default public.auth_org_id();

create policy snapshots_select on advice_session_snapshots for select to authenticated
  using (organization_id = public.auth_org_id());
create policy snapshots_insert on advice_session_snapshots for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:complete'));

alter table signatures enable row level security;
alter table signatures force  row level security;
alter table signatures alter column organization_id set default public.auth_org_id();

create policy signatures_select on signatures for select to authenticated
  using (organization_id = public.auth_org_id());
create policy signatures_insert on signatures for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:sign'));

-- Schreibschutz. Zwei Funktionen, weil ein Feldzugriff auf new.session_id
-- auf advice_sessions selbst scheitert.
create or replace function public.prevent_completed_session_changes() returns trigger
  language plpgsql set search_path = ''
as $$
declare v_status public.advice_session_status;
begin
  select s.status into v_status
    from public.advice_sessions s where s.id = new.session_id;
  if v_status = 'COMPLETED' then
    raise exception 'Abgeschlossene Beratung % ist unveraenderlich', new.session_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_completed_session_self_changes() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  -- old.status statt Unterabfrage: billiger, und der Abschluss-Update
  -- selbst kommt durch, weil dort noch IN_PROGRESS steht.
  if old.status = 'COMPLETED' then
    raise exception 'Abgeschlossene Beratung % ist unveraenderlich', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_freeze_session before update on advice_sessions
  for each row execute function public.prevent_completed_session_self_changes();
create trigger trg_freeze_topics before update on advice_session_topics
  for each row execute function public.prevent_completed_session_changes();
create trigger trg_freeze_notes before update on notes
  for each row when (new.session_id is not null)
  execute function public.prevent_completed_session_changes();

-- Auch das nachtraegliche Einfuegen: eine Notiz, die nach dem Abschluss in
-- eine Beratung wandert, veraendert deren Aussage genauso wie eine
-- geaenderte. Waehrend des Gespraechs steht die Beratung auf IN_PROGRESS,
-- der normale Weg bleibt also offen.
create trigger trg_freeze_notes_insert before insert on notes
  for each row when (new.session_id is not null)
  execute function public.prevent_completed_session_changes();

-- Abschluss als atomare Funktion (Architektur 6.3).
create or replace function public.complete_advice_session(
  p_session_id uuid,
  p_document   jsonb
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_snapshot uuid;
  v_open int;
  v_org uuid;
begin
  select s.organization_id into v_org
    from public.advice_sessions s
   where s.id = p_session_id
     and s.organization_id = public.auth_org_id()
     and s.status in ('DRAFT','IN_PROGRESS');
  if v_org is null then
    raise exception 'Beratung nicht gefunden oder bereits abgeschlossen' using errcode = '22023';
  end if;

  if not public.has_permission('advice:complete') then
    raise exception 'Keine Berechtigung zum Abschliessen' using errcode = '42501';
  end if;

  -- Die zentrale Produktregel: kein Pflichtthema ohne Ergebnis.
  select count(*) into v_open
    from public.advice_session_topics t
   where t.session_id = p_session_id
     and t.is_required
     and t.outcome is null
     and t.progress_status <> 'SKIPPED';

  if v_open > 0 then
    raise exception 'Es sind noch % Pflichtbereiche offen', v_open
      using errcode = 'check_violation';
  end if;

  insert into public.advice_session_snapshots
    (organization_id, session_id, document, content_hash, created_by)
  values
    (v_org, p_session_id, p_document,
     encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex'), auth.uid())
  returning id into v_snapshot;

  update public.advice_sessions
     set status = 'COMPLETED', completed_at = now(), updated_at = now()
   where id = p_session_id;

  return v_snapshot;
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
