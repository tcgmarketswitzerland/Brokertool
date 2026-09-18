-- Brokertool - Migrationen 0018 bis 0024 in einer Datei
--
-- Zum Einspielen im Supabase SQL Editor: alles markieren, einfuegen,
-- ausfuehren.
--
-- Mehrfaches Ausfuehren ist unschaedlich: jeder Schritt prueft, ob er
-- schon getan ist.
--
-- Erzeugt am 2026-09-18 aus supabase/migrations/.


-- ======================================================================
-- 0018_all_topics_required.sql
-- ======================================================================

-- Phase 3 - Alle Sparten sind Pflicht (fachliche Vorgabe)
--
-- Damit laesst sich eine Beratung erst abschliessen, wenn jede der elf
-- Sparten ein Ergebnis hat oder ausdruecklich uebersprungen wurde. Das ist
-- die strengste sinnvolle Auslegung von "kein Bereich wird vergessen" -
-- und sie funktioniert nur, weil Ueberspringen eine vollwertige,
-- protokollierte Entscheidung ist und kein Schlupfloch.

create or replace function public.default_required_slugs() returns text[]
  language sql stable
as $$
  select coalesce(array_agg(t.slug), '{}')
    from public.insurance_topics t
   where t.is_active;
$$;

comment on function public.default_required_slugs() is
  'Pflichtsparten. Derzeit alle aktiven: eine Beratung ist erst abschliessbar, wenn jede ein Ergebnis hat oder ausdruecklich uebersprungen wurde.';

-- Neue Vorlagenversion je Firma statt Aenderung der alten: laufende
-- Beratungen behalten ihre Version und bleiben unveraendert bewertbar.
do $$
declare
  r record;
  v_version uuid;
begin
  for r in
    select t.id as template_id, t.organization_id,
           coalesce(max(v.version), 0) + 1 as next_version
      from public.advice_templates t
      left join public.advice_template_versions v on v.template_id = t.id
     where t.is_default
     group by t.id, t.organization_id
     -- Nur, wenn die aktuelle Version nicht bereits alle Sparten als
     -- Pflicht fuehrt. Sonst legte jedes erneute Einspielen eine weitere
     -- Version an, und die Firma haette einen Stapel identischer Vorlagen.
    having not exists (
      select 1
        from public.advice_template_versions cur
       where cur.template_id = t.id
         and cur.status = 'PUBLISHED'
         and not exists (
           select 1 from public.advice_template_topics tt
            where tt.template_version_id = cur.id and not tt.is_required)
         and (select count(*) from public.advice_template_topics tt
               where tt.template_version_id = cur.id)
             = (select count(*) from public.insurance_topics it
                 where it.is_active and 'PRIVATE' = any (it.applicable_customer_types)))
  loop
    insert into public.advice_template_versions
      (organization_id, template_id, version, status)
    values (r.organization_id, r.template_id, r.next_version, 'DRAFT')
    returning id into v_version;

    insert into public.advice_template_topics
      (organization_id, template_version_id, topic_id, display_order, is_required)
    select r.organization_id, v_version, it.id, it.display_order, true
      from public.insurance_topics it
     where it.is_active
       and 'PRIVATE' = any (it.applicable_customer_types);

    update public.advice_template_versions
       set status = 'PUBLISHED', published_at = now()
     where id = v_version;
  end loop;
end $$;

select public.apply_tenant_rls();
select public.assert_rls_complete();


-- ======================================================================
-- 0019_tasks.sql
-- ======================================================================

-- Phase 5 - Aufgaben fuer Kunde und Berater (Konzeptpunkt 11)

-- Mit Schutz gegen erneutes Einspielen: die Migrationen laufen im
-- Supabase SQL Editor von Hand, und ein abgebrochener Durchgang darf nicht
-- dazu fuehren, dass der naechste an einem bereits angelegten Typ scheitert.
do $$ begin
  create type task_owner_type as enum ('CUSTOMER','ADVISOR');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_status as enum ('OPEN','IN_PROGRESS','DONE','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_priority as enum ('LOW','NORMAL','HIGH');
exception when duplicate_object then null; end $$;

create table if not exists tasks (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  customer_id        uuid references customers(id) on delete cascade,
  -- Bezug zur Beratung und zur Sparte: eine Aufgabe entsteht im Gespraech
  -- und soll spaeter zeigen, woraus sie stammt.
  session_id         uuid references advice_sessions(id) on delete set null,
  session_topic_id   uuid references advice_session_topics(id) on delete set null,

  owner_type         task_owner_type not null,
  assignee_member_id uuid references organization_members(id) on delete set null,

  title              text not null check (length(btrim(title)) between 1 and 300),
  description        text,
  status             task_status not null default 'OPEN',
  priority           task_priority not null default 'NORMAL',
  due_date           date,
  completed_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references profiles(id) on delete set null,
  updated_by         uuid references profiles(id) on delete set null,

  -- Eine Berateraufgabe ohne Zustaendigen bleibt liegen. Kundenaufgaben
  -- brauchen keinen: dort ist der Kunde der Zustaendige.
  constraint tasks_advisor_needs_assignee
    check (owner_type <> 'ADVISOR' or assignee_member_id is not null),
  constraint tasks_done_needs_timestamp
    check (status <> 'DONE' or completed_at is not null)
);

create index if not exists tasks_open_by_due
  on tasks (organization_id, due_date) where status in ('OPEN','IN_PROGRESS');
create index if not exists tasks_session_idx on tasks (session_id);
create index if not exists tasks_customer_idx on tasks (customer_id);

drop trigger if exists trg_tasks_touch on tasks;
create trigger trg_tasks_touch before update on tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_tasks on tasks;
create trigger trg_audit_tasks
  after insert or update or delete on tasks
  for each row execute function public.audit_trigger();

select public.apply_tenant_rls();
select public.assert_rls_complete();


-- ======================================================================
-- 0020_snapshots_signatures.sql
-- ======================================================================

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

do $$ begin
  create type signature_kind as enum ('CUSTOMER','ADVISOR');
exception when duplicate_object then null; end $$;

create table if not exists advice_session_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade unique,
  schema_version  int  not null default 1,
  document        jsonb not null,
  content_hash    text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null
);

create table if not exists signatures (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  session_id       uuid not null references advice_sessions(id) on delete cascade,
  snapshot_id      uuid not null references advice_session_snapshots(id) on delete restrict,
  kind             signature_kind not null default 'CUSTOMER',
  signer_person_id uuid references customer_persons(id) on delete set null,
  signer_name      text not null,
  -- Das Bild liegt hier und nicht im Objektspeicher.
  --
  -- Der erste Entwurf legte es in einen Supabase-Bucket. Die Begruendung -
  -- Abfragen nicht aufblaehen, ablaufende URLs ausliefern - hielt der
  -- Wirklichkeit nicht stand: die Spalte wird nur beim Erzeugen des PDF
  -- gelesen, und ausgeliefert wird nie eine URL, sondern das fertige PDF
  -- vom Server. Dafuer verlangte der Objektspeicher Policies auf
  -- storage.objects, einer Tabelle, die in Supabase supabase_storage_admin
  -- gehoert - im SQL Editor nicht anlegbar, also ein Handgriff im
  -- Dashboard bei jeder Installation. Ein manueller Schritt an der
  -- Produktionsdatenbank ist genau das, was dieses Projekt ausschliesst.
  --
  -- Base64 statt bytea, weil PostgREST bytea als Hex-Zeichenkette
  -- durchreicht und der Umweg an zwei Stellen umgerechnet werden muesste.
  -- Eine Unterschrift misst rund 40 KB; bei 200 Beratungen im Jahr sind
  -- das 8 MB.
  image_base64     text not null check (length(image_base64) between 100 and 2000000),
  content_type     text not null default 'image/png'
    check (content_type in ('image/png','image/jpeg','image/svg+xml')),
  signed_at        timestamptz not null default now(),
  -- Klartext, nicht gehasht: der einzige Zweck ist der Nachweis im
  -- Streitfall, und ein Hash waere dafuer wertlos. Begruendete Bearbeitung,
  -- gehoert so ins Bearbeitungsverzeichnis.
  signed_ip        inet,
  user_agent       text
);

create index if not exists signatures_session_idx on signatures (session_id);

-- Anfuegende Tabellen: eigener Policy-Satz, kein Update, kein Delete.
alter table advice_session_snapshots enable row level security;
alter table advice_session_snapshots force  row level security;
alter table advice_session_snapshots
  alter column organization_id set default public.auth_org_id();

drop policy if exists snapshots_select on advice_session_snapshots;
create policy snapshots_select on advice_session_snapshots for select to authenticated
  using (organization_id = public.auth_org_id());
drop policy if exists snapshots_insert on advice_session_snapshots;
create policy snapshots_insert on advice_session_snapshots for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:complete'));

alter table signatures enable row level security;
alter table signatures force  row level security;
alter table signatures alter column organization_id set default public.auth_org_id();

drop policy if exists signatures_select on signatures;
create policy signatures_select on signatures for select to authenticated
  using (organization_id = public.auth_org_id());
drop policy if exists signatures_insert on signatures;
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

drop trigger if exists trg_freeze_session on advice_sessions;
create trigger trg_freeze_session before update on advice_sessions
  for each row execute function public.prevent_completed_session_self_changes();
drop trigger if exists trg_freeze_topics on advice_session_topics;
create trigger trg_freeze_topics before update on advice_session_topics
  for each row execute function public.prevent_completed_session_changes();
drop trigger if exists trg_freeze_notes on notes;
create trigger trg_freeze_notes before update on notes
  for each row when (new.session_id is not null)
  execute function public.prevent_completed_session_changes();

-- Auch das nachtraegliche Einfuegen: eine Notiz, die nach dem Abschluss in
-- eine Beratung wandert, veraendert deren Aussage genauso wie eine
-- geaenderte. Waehrend des Gespraechs steht die Beratung auf IN_PROGRESS,
-- der normale Weg bleibt also offen.
drop trigger if exists trg_freeze_notes_insert on notes;
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


-- ======================================================================
-- 0021_session_bootstrap.sql
-- ======================================================================

-- Einrichtung und Sitzungsdiagnose
--
-- Zwei Luecken, die beide dasselbe Bild erzeugen: angemeldet, aber die
-- Anwendung ist leer - und das sieht wie ein Fehler aus, obwohl die
-- Sicherheitsregeln genau richtig arbeiten.
--
--   1. Ist in Supabase die E-Mail-Bestaetigung eingeschaltet (Standard),
--      liefert signUp keine Sitzung. Die Firma wurde deshalb nie angelegt,
--      denn create_organization lief nur im Zweig mit sofortiger Sitzung.
--
--   2. Auch wenn die Firma entsteht, wurde das Zugriffstoken davor
--      ausgestellt. Es traegt die Mandantenkennung noch nicht, bis es
--      erneuert wird.
--
-- Beides laesst sich in der Anwendung nur beheben, wenn sie die Lage
-- ueberhaupt erkennen kann. Genau dafuer ist diese Funktion da. Sie muss
-- SECURITY DEFINER sein: ohne Mandantenkennung im Token sperren die
-- Policies auch den Blick auf die eigene Mitgliedschaft.

create or replace function public.session_bootstrap()
  returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    -- Besteht ueberhaupt eine aktive Mitgliedschaft?
    'has_membership', exists (
      select 1 from public.organization_members m
       where m.user_id = auth.uid() and m.is_active),
    -- Steht sie auch im Token? Ist das eine wahr und das andere nicht,
    -- ist das Token veraltet oder der Access-Token-Hook nicht aktiviert.
    'claim_org', public.auth_org_id()
  );
$$;

comment on function public.session_bootstrap() is
  'Sagt der Anwendung, ob eine Firma eingerichtet ist und ob das Token sie kennt.';

revoke all on function public.session_bootstrap() from public;
grant execute on function public.session_bootstrap() to authenticated;

select public.assert_rls_complete();


-- ======================================================================
-- 0022_completion_one_topic.sql
-- ======================================================================

-- Abschluss ohne Pflichtsparten (fachliche Vorgabe, ersetzt 0018)
--
-- Bisher war eine Beratung erst abschliessbar, wenn jede Sparte ein
-- Ergebnis hatte. Im echten Gespraech passt das nicht: ein Kunde kommt
-- wegen der Motorfahrzeugversicherung und hat vierzig Minuten Zeit.
--
-- Die Regel wird deshalb umgedreht, ohne das Versprechen aufzugeben:
-- abschliessen laesst sich ab einer besprochenen Sparte, und alle uebrigen
-- werden dabei ausdruecklich auf "im Gespraech nicht thematisiert"
-- gesetzt. Damit steht im Protokoll weiterhin zu jeder Sparte ein Satz -
-- nur eben die Wahrheit, dass sie nicht behandelt wurde, statt einer
-- Luecke. Das ist der entscheidende Unterschied: eine Luecke muss man
-- spaeter erklaeren, einen dokumentierten Satz nicht.

create or replace function public.complete_advice_session(
  p_session_id uuid,
  p_document   jsonb
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_snapshot uuid;
  v_settled int;
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

  -- Eine Beratung ohne eine einzige besprochene Sparte ist keine Beratung.
  -- Sie abzuschliessen wuerde ein Protokoll erzeugen, das nichts belegt.
  select count(*) into v_settled
    from public.advice_session_topics t
   where t.session_id = p_session_id
     and t.outcome is not null;

  if v_settled = 0 then
    raise exception 'Mindestens eine Sparte braucht ein Ergebnis'
      using errcode = 'check_violation';
  end if;

  -- Alles Uebrige wird festgehalten, nicht verschwiegen.
  update public.advice_session_topics
     set progress_status = 'SKIPPED', outcome = null
   where session_id = p_session_id
     and outcome is null
     and progress_status <> 'SKIPPED';

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

comment on function public.complete_advice_session(uuid, jsonb) is
  'Schliesst eine Beratung ab. Nicht besprochene Sparten werden als "nicht thematisiert" festgehalten.';

-- Die Kennzeichnung als Pflichtsparte bleibt im Datenmodell: sie steuert,
-- was die Oberflaeche hervorhebt. Sie sperrt den Abschluss nicht mehr.
select public.assert_rls_complete();


-- ======================================================================
-- 0023_pension_analysis.sql
-- ======================================================================

-- Vorsorgeanalyse (Konzeptpunkt 13)
--
-- Eine Analyse je Beratung. Sie haelt fest, was der Berater vom
-- Vorsorgeausweis abgelesen hat - nicht, was ein Rechner geschaetzt hat.
-- Genau deshalb gehoert sie ins Protokoll: die Zahlen stammen vom Kunden,
-- der Berater hat sie erfasst, beide haben dasselbe angesehen.
--
-- Die Einzelposten liegen als JSONB in einer Spalte und nicht in einer
-- Kindtabelle. Sie werden als Einheit erfasst, als Einheit gelesen und als
-- Einheit eingefroren; ueber sie hinweg wird nie abgefragt. Eine
-- Kindtabelle brauchte an jeder dieser Stellen einen Verbund und braechte
-- nichts dafuer ein.

create table if not exists pension_analyses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid not null references customers(id) on delete cascade,
  -- Eine Analyse je Beratung: sie ist Teil des Gespraechs, nicht ein
  -- Stammdatum des Kunden.
  session_id       uuid not null references advice_sessions(id) on delete cascade unique,
  person_id        uuid references customer_persons(id) on delete set null,

  -- Haushalt. Betraege in Rappen, wie ueberall im System.
  annual_income_cents  bigint check (annual_income_cents is null or annual_income_cents >= 0),
  has_partner          boolean not null default false,
  partner_income_cents bigint check (partner_income_cents is null or partner_income_cents >= 0),
  child_count          int not null default 0 check (child_count between 0 and 12),
  -- Leer, bis der Berater sie mit dem Kunden festlegt. Ein Vorgabewert
  -- waere eine Aussage, die niemand getroffen hat.
  target_percent       numeric(5,2) check (target_percent is null
                                           or target_percent between 0 and 200),

  /*
    Aufbau: { "<fall>": [ { "key", "pillar", "label",
                            "annualCents", "perChildCents", "requiresPartner" } ] }
    Faelle: DEATH, DISABILITY_ILLNESS, DISABILITY_ACCIDENT, RETIREMENT.
  */
  items            jsonb not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id) on delete set null,
  updated_by       uuid references profiles(id) on delete set null
);

create index if not exists pension_analyses_customer_idx on pension_analyses (customer_id);

drop trigger if exists trg_pension_touch on pension_analyses;
create trigger trg_pension_touch before update on pension_analyses
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_pension on pension_analyses;
create trigger trg_audit_pension
  after insert or update or delete on pension_analyses
  for each row execute function public.audit_trigger();

-- Auch hier gilt der Schreibschutz: nach dem Abschluss steht die Analyse
-- so im Protokoll, wie sie im Gespraech aussah.
drop trigger if exists trg_freeze_pension on pension_analyses;
create trigger trg_freeze_pension before update on pension_analyses
  for each row execute function public.prevent_completed_session_changes();

select public.apply_tenant_rls();
select public.assert_rls_complete();


-- ======================================================================
-- 0024_document_topic.sql
-- ======================================================================

-- Phase 7 - Dokumente in der Spartenansicht
--
-- Bisher hing ein Dokument am Kunden, an einer Police oder an einer
-- Beratung. Im Gespraech wird es aber in einer Sparte gebraucht: der
-- Berater oeffnet "Hausrat" und will die Police sehen, die dort erfasst
-- ist - nicht die Dokumentenliste des ganzen Kunden durchsuchen.
--
-- Die Spalte ist bewusst optional und ohne Pflichtbezug: ein Ausweis
-- gehoert zum Kunden und zu keiner Sparte.

alter table documents
  add column if not exists topic_id uuid references insurance_topics(id) on delete set null;

create index if not exists documents_topic_idx
  on documents (customer_id, topic_id)
  where deleted_at is null and topic_id is not null;

-- Ein Dokument, das im Gespraech hochgeladen wurde, darf danach nicht mehr
-- verschwinden: das Protokoll verweist darauf. Geloescht wird weich, und
-- auch das erst nach dem Abschluss nicht mehr.
drop trigger if exists trg_freeze_documents on documents;
create trigger trg_freeze_documents before update on documents
  for each row when (new.session_id is not null)
  execute function public.prevent_completed_session_changes();

select public.apply_tenant_rls();
select public.assert_rls_complete();

