-- Brokertool - Migrationen 0018 bis 0027 in einer Datei
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


-- ======================================================================
-- 0025_organization_profile.sql
-- ======================================================================

-- Phase 8 - Firmenangaben und Erscheinungsbild
--
-- Das Beratungsprotokoll ist ein Dokument, das der Kunde behaelt und im
-- Streitfall vorlegt. Darauf gehoert, von wem es stammt: Name, Adresse und
-- eine Kontaktmoeglichkeit. Bisher stand dort nur der Firmenname.
--
-- Eigene Spalten statt eines weiteren Schluessels in `settings`: das sind
-- fachliche Angaben mit Laengen- und Formatregeln, keine Vorlieben. Ein
-- jsonb-Feld gaebe dafuer keine Pruefung her.

alter table organizations
  add column if not exists street           text,
  add column if not exists postal_code      text,
  add column if not exists city             text,
  add column if not exists phone            text,
  add column if not exists email            text,
  add column if not exists website          text,
  -- Das Logo liegt in der Zeile und nicht im Objektspeicher. Es ist klein,
  -- wird bei jedem Protokoll gebraucht und muss im PDF als Datenstrom
  -- vorliegen - ein Umweg ueber eine signierte URL brauchte dort einen
  -- zweiten Netzzugriff mitten im Rendern. Dieselbe Ueberlegung wie bei
  -- der Unterschrift (Migration 0020).
  add column if not exists logo_base64      text,
  add column if not exists logo_content_type text,
  add column if not exists brand_color      text;

do $$
begin
  -- Guard, damit die Migration mehrfach laufen darf: ein zweites
  -- `add constraint` scheitert sonst.
  if not exists (select 1 from pg_constraint where conname = 'organizations_postal_code_ch') then
    alter table organizations add constraint organizations_postal_code_ch
      check (postal_code is null or postal_code ~ '^[1-9][0-9]{3}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_brand_color_hex') then
    alter table organizations add constraint organizations_brand_color_hex
      check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_pair') then
    -- Ein Bild ohne Typ liesse sich nicht anzeigen, ein Typ ohne Bild
    -- nichts. Entweder beides oder keines.
    alter table organizations add constraint organizations_logo_pair
      check (num_nonnulls(logo_base64, logo_content_type) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_type') then
    alter table organizations add constraint organizations_logo_type
      check (logo_content_type is null
             or logo_content_type in ('image/png','image/jpeg'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_size') then
    -- Rund 1 MB in base64. Ein Logo, das groesser ist, ist kein Logo.
    alter table organizations add constraint organizations_logo_size
      check (logo_base64 is null or length(logo_base64) between 100 and 1400000);
  end if;
end $$;

-- Die Firmenzeile steht in jedem Protokoll; ohne Audit liesse sich spaeter
-- nicht mehr sagen, wie sie zum Zeitpunkt eines Gespraechs lautete.
--
-- Eigene Funktion, weil der allgemeine Trigger die Spalte
-- organization_id liest. Die hat diese Tabelle nicht: sie IST die
-- Organisation, und ihre eigene id ist der Mandant.
create or replace function public.audit_organization() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(key) into v_changed
      from jsonb_each(to_jsonb(new))
     where to_jsonb(old) -> key is distinct from to_jsonb(new) -> key
       and key not in ('updated_at','updated_by');
    if v_changed is null then
      return null;   -- nichts Fachliches geaendert, kein Eintrag
    end if;
  end if;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_table, entity_id, changed_fields)
  values (new.id, auth.uid(), tg_op::public.audit_action, 'organizations', new.id, v_changed);

  return null;   -- AFTER-Trigger
end;
$$;

-- Nur Anlegen und Aendern: eine geloeschte Organisation hat keine
-- Mandanten-id mehr, unter der ein Eintrag stehen koennte. Geloescht wird
-- ohnehin weich, ueber deleted_at - und das ist ein UPDATE.
drop trigger if exists trg_audit_organizations on organizations;
create trigger trg_audit_organizations
  after insert or update on organizations
  for each row execute function public.audit_organization();

select public.apply_tenant_rls();
select public.assert_rls_complete();


-- ======================================================================
-- 0026_advisor_visibility.sql
-- ======================================================================

-- Phase 8 - Berateransicht: jeder sieht seine eigenen Kunden
--
-- Bisher galt: wer zur Firma gehoert, sieht alles, was der Firma gehoert.
-- Das ist fuer ein Einzelbuero richtig und fuer ein Maklerbuero mit
-- mehreren Beratern falsch. Ab hier gilt:
--
--   Berater      sehen ihre eigenen Kunden und Beratungen.
--   Firmenleitung (OWNER, ADMIN) sieht alles, samt zustaendigem Berater.
--   Backoffice   sieht alles - es pflegt genau die Faelle nach, die es
--                nicht selbst gefuehrt hat.
--
-- Umgesetzt im Policy-Generator und nicht in 20 handgeschriebenen
-- Policies: die Regel muss fuer jede Tabelle gelten, die an einem Kunden
-- oder an einer Beratung haengt, auch fuer die, die es noch nicht gibt.
-- assert_rls_complete() prueft ab hier zusaetzlich, dass keine
-- Mandantentabelle durch dieses Raster faellt.

-- ---------------------------------------------------------------------
-- 1. Neue Stammdaten
-- ---------------------------------------------------------------------

-- Die FINMA-Registernummer steht im Beratungsprotokoll und auf jedem
-- Dokument, das die Firma herausgibt. Format bewusst ungeprueft: die
-- Registernummer ist keine Zahl mit fester Laenge.
alter table organizations
  add column if not exists finma_number text;

alter table organization_members
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists job_title    text,
  add column if not exists finma_number text;

-- Dieselben Angaben schon in der Einladung: der Adminaccount erfasst den
-- Berater, nicht der Berater sich selbst. Beim Einloesen wandern sie in
-- die Mitgliedschaft.
alter table invitations
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists job_title    text,
  add column if not exists finma_number text;

-- ---------------------------------------------------------------------
-- 2. Sichtbarkeit
-- ---------------------------------------------------------------------

-- member_id steht seit 0010 im JWT. Ein Unterselect auf
-- organization_members waere hier nicht nur langsamer, sondern brauchte
-- eine Lesepolicy auf einer Tabelle, die selbst in Policies vorkommt.
create or replace function public.auth_member_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'member_id', ''
  )::uuid;
$$;

/**
 * Wer sieht die Kunden der ganzen Firma?
 *
 * Backoffice ist hier absichtlich dabei: seine Aufgabe ist das Nachpflegen
 * fremder Faelle. Ein Backoffice, das nur die eigenen Kunden saehe, saehe
 * keine.
 */
create or replace function public.sees_all_customers() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.auth_org_role() in ('OWNER','ADMIN','BACKOFFICE');
$$;

create or replace function public.can_see_customer(p_customer uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  -- NULL bedeutet "haengt an keinem Kunden" und darf nicht sperren: die
  -- Mandantenpruefung steht daneben und greift weiterhin.
  select p_customer is null
      or public.sees_all_customers()
      or exists (select 1 from public.customers c
                  where c.id = p_customer
                    and c.primary_advisor_id = public.auth_member_id());
$$;

/**
 * Eine Beratung sieht, wer sie gefuehrt hat - oder wem der Kunde gehoert.
 *
 * Die zweite Haelfte ist keine Grosszuegigkeit, sondern die Voraussetzung
 * dafuer, dass ein Berater die Geschichte seines eigenen Kunden lesen
 * kann, auch wenn ein Kollege einmal eingesprungen ist.
 */
create or replace function public.can_see_session(p_session uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_session is null
      or public.sees_all_customers()
      or exists (select 1 from public.advice_sessions s
                  where s.id = p_session
                    and (s.advisor_member_id = public.auth_member_id()
                         or public.can_see_customer(s.customer_id)));
$$;

create or replace function public.can_see_policy(p_policy uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_policy is null
      or public.sees_all_customers()
      or exists (select 1 from public.policies p
                  where p.id = p_policy
                    and public.can_see_customer(p.customer_id));
$$;

comment on function public.can_see_customer(uuid) is
  'Sichtbarkeit eines Kunden fuer das angemeldete Mitglied. security definer, damit der Aufruf aus der Policy auf customers nicht rekursiv wird.';

-- ---------------------------------------------------------------------
-- 3. Zustaendigkeit
-- ---------------------------------------------------------------------

-- Ohne Vorgabewert verloere ein Berater den Kunden aus den Augen, den er
-- gerade angelegt hat. Dieselbe Mechanik wie bei organization_id.
alter table customers
  alter column primary_advisor_id set default public.auth_member_id();

-- Bestehende Kunden dem Mitglied zuordnen, das sie angelegt hat. Ohne
-- diesen Schritt saehe sie nach der Migration nur noch die Firmenleitung.
update customers c
   set primary_advisor_id = m.id
  from organization_members m
 where c.primary_advisor_id is null
   and m.user_id = c.created_by
   and m.organization_id = c.organization_id;

create index if not exists customers_advisor_idx
  on customers (organization_id, primary_advisor_id) where deleted_at is null;
create index if not exists advice_sessions_advisor_idx
  on advice_sessions (organization_id, advisor_member_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 4. Der Generator kennt die Sichtbarkeit
-- ---------------------------------------------------------------------

/**
 * Tabellen, die absichtlich der ganzen Firma gehoeren.
 *
 * Vorlagen, Mitgliedschaften, Einladungen, Spartenauswahl: daran haengt
 * kein Kunde. Die Liste ist der Gegenpol zur Pruefung weiter unten - wer
 * eine neue Mandantentabelle anlegt, muss sich entscheiden, ob sie an
 * einen Kunden haengt oder hierher gehoert. Ein Vergessen faellt in der
 * Migration auf, nicht im Betrieb.
 *
 * Als Tabelle und nicht als Funktion mit fester Liste: eine spaetere
 * Migration traegt einen Namen nach, indem sie eine Zeile einfuegt. Stuende
 * die Liste im Funktionskoerper, muesste jede spaetere Migration sie
 * vollstaendig wiederholen - und ein erneutes Einspielen dieser hier
 * wuerde die Nachtraege stillschweigend loeschen. Genau das ist beim
 * Zusammenfuehren der Migrationen zu einem Buendel passiert.
 */
create table if not exists rls_org_wide_registry (
  table_name text primary key
);

alter table rls_org_wide_registry enable row level security;
alter table rls_org_wide_registry force  row level security;

drop policy if exists rls_org_wide_registry_read on rls_org_wide_registry;
create policy rls_org_wide_registry_read on rls_org_wide_registry
  for select to authenticated using (true);

insert into rls_org_wide_registry (table_name) values
  ('organization_members'),
  ('invitations'),
  ('advice_templates'),
  ('advice_template_versions'),
  ('advice_template_topics'),
  ('organization_topic_settings'),
  ('audit_logs')
on conflict (table_name) do nothing;

-- security definer, weil die Funktion aus Policies heraus aufgerufen wird
-- und die Registratur selbst RLS traegt.
create or replace function public.rls_org_wide_tables() returns text[]
  language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(r.table_name), '{}')::text[]
    from public.rls_org_wide_registry r;
$$;

/** Die Sichtbarkeitsbedingung einer Tabelle, als SQL-Text. */
create or replace function public.rls_visibility_clause(p_table text) returns text
  language plpgsql stable set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_rel   oid := to_regclass('public.' || quote_ident(p_table));
begin
  -- to_regclass statt eines Casts: der Planer darf diese Funktion auch auf
  -- Zeilen anwenden, die den Schemafilter des Aufrufers noch nicht
  -- passiert haben. Ein Cast wuerfe dort, und die Migration braeche an
  -- einer Tabelle, die sie gar nicht meint.
  if v_rel is null then
    return '';
  end if;

  if p_table = 'customers' then
    return 'and (public.sees_all_customers() '
        || 'or primary_advisor_id = public.auth_member_id())';
  end if;

  if p_table = 'advice_sessions' then
    return 'and (public.sees_all_customers() '
        || 'or advisor_member_id = public.auth_member_id() '
        || 'or public.can_see_customer(customer_id))';
  end if;

  if p_table = any (public.rls_org_wide_tables()) then
    return '';
  end if;

  -- Alles andere haengt ueber eine dieser drei Spalten an einem Kunden.
  -- Mehrere zugleich sind kein Widerspruch, sondern eine Verschaerfung:
  -- ein Dokument mit Kunde UND Beratung muss bei beiden sichtbar sein.
  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'customer_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_customer(customer_id)');
  end if;

  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'session_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_session(session_id)');
  end if;

  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'policy_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_policy(policy_id)');
  end if;

  if cardinality(v_parts) = 0 then
    return null;   -- weder Kundenbezug noch bewusst firmenweit
  end if;

  return 'and ' || array_to_string(v_parts, ' and ');
end;
$$;

create or replace function public.apply_tenant_rls(p_table text default null)
  returns int language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_see text;
  n int := 0;
begin
  for r in
    select c.relname as tbl
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a  on a.attrelid = c.oid
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and a.attname = 'organization_id'
       and a.attnum > 0 and not a.attisdropped
       and not (c.relname = any (public.rls_manual_tables()))
       and (p_table is null or c.relname = p_table)
  loop
    v_see := coalesce(public.rls_visibility_clause(r.tbl), '');

    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('alter table public.%I force  row level security', r.tbl);
    execute format('alter table public.%I alter column organization_id set default public.auth_org_id()', r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
    execute format($p$create policy %I on public.%I for select to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_read(%L) %s)$p$,
                   r.tbl || '_select', r.tbl, r.tbl, v_see);

    -- Auch beim Schreiben: sonst legte ein Berater eine Notiz an einem
    -- fremden Kunden an, die er anschliessend selbst nicht mehr saehe.
    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
    execute format($p$create policy %I on public.%I for insert to authenticated
                     with check (organization_id = public.auth_org_id()
                                 and public.can_write(%L) %s)$p$,
                   r.tbl || '_insert', r.tbl, r.tbl, v_see);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
    execute format($p$create policy %I on public.%I for update to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_write(%L) %s)
                     with check (organization_id = public.auth_org_id() %s)$p$,
                   r.tbl || '_update', r.tbl, r.tbl, v_see, v_see);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);
    execute format($p$create policy %I on public.%I for delete to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_delete(%L) %s)$p$,
                   r.tbl || '_delete', r.tbl, r.tbl, v_see);

    execute format('create index if not exists %I on public.%I (organization_id)',
                   r.tbl || '_org_idx', r.tbl);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Die vier Tabellen mit eigenem Policy-Satz haengen alle an einer Beratung
-- und brauchen dieselbe Einschraenkung - audit_logs ausgenommen, das
-- ohnehin nur die Firmenleitung liest.
drop policy if exists snapshots_select on advice_session_snapshots;
create policy snapshots_select on advice_session_snapshots for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists snapshots_insert on advice_session_snapshots;
create policy snapshots_insert on advice_session_snapshots for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:complete')
              and public.can_see_session(session_id));

drop policy if exists signatures_select on signatures;
create policy signatures_select on signatures for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists signatures_insert on signatures;
create policy signatures_insert on signatures for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:sign')
              and public.can_see_session(session_id));

drop policy if exists advice_command_log_select on advice_command_log;
create policy advice_command_log_select on advice_command_log for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists advice_command_log_insert on advice_command_log;
create policy advice_command_log_insert on advice_command_log for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.can_write('advice_sessions')
              and public.can_see_session(session_id));

-- ---------------------------------------------------------------------
-- 5. Die Selbstpruefung kennt die Sichtbarkeit mit
-- ---------------------------------------------------------------------

create or replace function public.assert_rls_complete() returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  v_offenders text;
begin
  -- (1) Jede Tabelle braucht RLS und FORCE RLS.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (not c.relrowsecurity or not c.relforcerowsecurity);

  if v_offenders is not null then
    raise exception 'Tabellen ohne vollstaendiges RLS: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (2) Jede Tabelle mit RLS braucht mindestens eine Policy.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if v_offenders is not null then
    raise exception 'Tabellen ohne Policy: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (3) organization_id darf nie nullable sein.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
   where n.nspname = 'public' and c.relkind = 'r'
     and a.attname = 'organization_id' and not a.attnotnull and not a.attisdropped;

  if v_offenders is not null then
    raise exception 'Tabellen mit nullable organization_id: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (4) Anfuegende Tabellen duerfen keine Update- oder Delete-Policy haben.
  select string_agg(format('%s.%s', c.relname, p.polname), ', ') into v_offenders
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (public.rls_manual_tables())
     and p.polcmd in ('w', 'd', '*');

  if v_offenders is not null then
    raise exception 'Anfuegende Tabellen mit Schreibpolicy: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (5) Neu ab 0026: jede Mandantentabelle muss entweder an einem Kunden
  --     haengen oder ausdruecklich firmenweit sein. Eine Tabelle mit
  --     Kundendaten, die durch beide Raster faellt, waere fuer jeden
  --     Berater der Firma sichtbar - und niemandem faellt es auf.
  --     Das "offset 0" haelt den Planer davon ab, den Funktionsaufruf vor
  --     den Schemafilter zu ziehen.
  select string_agg(t.relname, ', ' order by t.relname) into v_offenders
    from (select c.relname
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and exists (select 1 from pg_attribute a
                          where a.attrelid = c.oid and a.attname = 'organization_id'
                            and a.attnum > 0 and not a.attisdropped)
           offset 0) t
   where public.rls_visibility_clause(t.relname) is null;

  if v_offenders is not null then
    raise exception 'Mandantentabellen ohne Kundenbezug und ohne Eintrag in rls_org_wide_tables(): %',
      v_offenders using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Berater erfassen und Firma eroeffnen
-- ---------------------------------------------------------------------

/**
 * Firma eroeffnen.
 *
 * Die Zusatzangaben sind optional in der Signatur und Pflicht im
 * Formular: bestehende Aufrufe - Tests, aeltere Clients - sollen nicht
 * brechen, aber eine neue Firma wird ueber die Oberflaeche vollstaendig
 * erfasst.
 */
-- Eine zusaetzliche Signatur ist eine Ueberladung, keine Ersetzung: ohne
-- dieses drop stuenden zwei Funktionen nebeneinander und jeder Aufruf mit
-- einem Argument waere mehrdeutig.
drop function if exists public.create_organization(text, text);

create or replace function public.create_organization(
  p_name         text,
  p_display_name text default null,
  p_email        text default null,
  p_phone        text default null,
  p_street       text default null,
  p_postal_code  text default null,
  p_city         text default null,
  p_finma_number text default null
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_org   uuid;
  v_slug  public.citext;
  v_email public.citext;
  v_name  text;
  v_try   int := 0;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Name der Organisation fehlt' using errcode = '22023';
  end if;

  select p.email, coalesce(nullif(btrim(coalesce(p_display_name,'')),''), p.full_name, p.email)
    into v_email, v_name
    from public.profiles p where p.id = v_user;

  if v_email is null then
    raise exception 'Profil nicht gefunden' using errcode = '28000';
  end if;

  v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'org'; end if;

  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Kein freier Slug gefunden' using errcode = '23505';
    end if;
    v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g') || '-' || v_try;
  end loop;

  insert into public.organizations
    (name, slug, email, phone, street, postal_code, city, finma_number)
  values (btrim(p_name), v_slug,
          nullif(btrim(coalesce(p_email,'')),''),
          nullif(btrim(coalesce(p_phone,'')),''),
          nullif(btrim(coalesce(p_street,'')),''),
          nullif(btrim(coalesce(p_postal_code,'')),''),
          nullif(btrim(coalesce(p_city,'')),''),
          nullif(btrim(coalesce(p_finma_number,'')),''))
  returning id into v_org;

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'OWNER', v_name, v_email);

  update public.profiles set active_organization_id = v_org, updated_at = now()
   where id = v_user;

  perform public.create_default_template(v_org);

  return v_org;
end;
$$;

/**
 * Einladung einloesen.
 *
 * Neu: Name, Jobtitel und FINMA-Nummer kommen aus der Einladung, nicht
 * vom Eingeladenen. Der Adminaccount hat den Berater erfasst; was auf dem
 * Protokoll steht, soll nicht davon abhaengen, was jemand bei der
 * Anmeldung in ein Namensfeld tippt.
 */
create or replace function public.accept_invitation(p_token text)
  returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_inv   public.invitations;
  v_email public.citext;
  v_name  text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  select p.email, coalesce(p.full_name, p.email) into v_email, v_name
    from public.profiles p where p.id = v_user;

  select * into v_inv
    from public.invitations i
   where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and i.status = 'PENDING'
   for update;

  if not found then
    raise exception 'Einladung ungueltig oder bereits eingeloest' using errcode = '22023';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Einladung abgelaufen' using errcode = '22023';
  end if;

  if v_inv.email is distinct from v_email then
    raise exception 'Einladung gilt fuer eine andere E-Mail-Adresse' using errcode = '22023';
  end if;

  -- Der erfasste Name gewinnt; nur wenn keiner erfasst wurde, bleibt der
  -- aus dem Profil.
  v_name := coalesce(
    nullif(btrim(concat_ws(' ', v_inv.first_name, v_inv.last_name)), ''),
    v_name);

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email,
     first_name, last_name, job_title, finma_number)
  values (v_inv.organization_id, v_user, v_inv.role, v_name, v_email,
          v_inv.first_name, v_inv.last_name, v_inv.job_title, v_inv.finma_number)
  on conflict (organization_id, user_id) do update
    set is_active    = true,
        display_name = excluded.display_name,
        first_name   = coalesce(excluded.first_name,   organization_members.first_name),
        last_name    = coalesce(excluded.last_name,    organization_members.last_name),
        job_title    = coalesce(excluded.job_title,    organization_members.job_title),
        finma_number = coalesce(excluded.finma_number, organization_members.finma_number),
        updated_at   = now();

  update public.invitations
     set status = 'ACCEPTED', accepted_at = now(), accepted_by = v_user, updated_at = now()
   where id = v_inv.id;

  update public.profiles set active_organization_id = v_inv.organization_id, updated_at = now()
   where id = v_user;

  return v_inv.organization_id;
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();


-- ======================================================================
-- 0027_billing.sql
-- ======================================================================

-- Phase 8 - Abrechnung: Zahlungsmittel der Brokerfirma
--
-- Was hier NICHT steht, ist der wichtigste Teil: keine Kartennummer, kein
-- Ablaufdatum mit Pruefziffer, kein Sicherheitscode. Diese Daten nimmt
-- ausschliesslich der Zahlungsanbieter entgegen; Brokertool speichert nur
-- dessen Kennungen und einen Text, den man dem Kunden zeigen kann
-- ("Visa ···· 4242"). Wer Kartendaten selbst entgegennimmt, faellt unter
-- PCI-DSS - eine Pflicht, die eine Beratungssoftware nicht tragen sollte
-- und auch nicht muss.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_kind') then
    create type payment_kind as enum ('CARD','PAYPAL','APPLE_PAY');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_status') then
    create type payment_method_status as enum ('PENDING','ACTIVE','EXPIRED','FAILED');
  end if;
end $$;

create table if not exists payment_methods (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  kind                 payment_kind not null,
  -- PENDING heisst: das Mittel ist gewaehlt, aber noch nicht autorisiert.
  -- Erst der Zahlungsanbieter setzt ACTIVE.
  status               payment_method_status not null default 'PENDING',

  provider             text,      -- 'stripe', 'datatrans', ... - noch keiner verbunden
  provider_customer_id text,
  provider_method_id   text,

  -- Anzeigetext, kein Zahlungsmerkmal.
  label                text,
  exp_month            smallint check (exp_month between 1 and 12),
  exp_year             smallint check (exp_year between 2024 and 2099),

  is_default           boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references profiles(id) on delete set null,

  -- Ein Riegel gegen den Fall, dass jemand doch eine Kartennummer in das
  -- Anzeigefeld tippt. Zwoelf zusammenhaengende Ziffern sind kein Label.
  constraint payment_methods_label_no_pan
    check (label is null or label !~ '[0-9]{12}')
);

create unique index if not exists payment_methods_one_default
  on payment_methods (organization_id) where is_default;

drop trigger if exists trg_payment_methods_touch on payment_methods;
create trigger trg_payment_methods_touch before update on payment_methods
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_payment_methods on payment_methods;
create trigger trg_audit_payment_methods
  after insert or update or delete on payment_methods
  for each row execute function public.audit_trigger();

-- Die Tabelle haengt an keinem Kunden, sondern an der Firma. Ohne diesen
-- Eintrag verweigerte assert_rls_complete() ab 0026 den Dienst - genau
-- dafuer ist die Pruefung da.
insert into rls_org_wide_registry (table_name) values ('payment_methods')
on conflict (table_name) do nothing;

select public.apply_tenant_rls('payment_methods');

-- Zusaetzlich einschraenkend statt ersetzend: eine restriktive Policy wird
-- mit UND verknuepft, nicht mit ODER. Der Generator darf seinen Satz also
-- behalten, und trotzdem kommt nur durch, wer die Abrechnung fuehrt - das
-- ist der Inhaber, nicht der Administrator (ROLE_DESCRIPTION).
drop policy if exists payment_methods_billing on payment_methods;
create policy payment_methods_billing on payment_methods
  as restrictive to authenticated
  using (public.has_permission('organization:billing'))
  with check (public.has_permission('organization:billing'));

select public.apply_tenant_rls();
select public.assert_rls_complete();

