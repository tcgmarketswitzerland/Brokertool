-- Phase 3 - Beratungen, Statusmodell, Command-Log
--
-- Das Statusmodell trennt zwei Dimensionen, die der Konzeptentwurf in einem
-- Enum vermischt hatte (Analyse 2.9):
--   progress_status  wie weit die Bearbeitung ist
--   outcome          was fachlich herauskam
-- In einem Enum entstuenden unmoegliche Zustaende und Diskussionen wie
-- "ist REVIEWED auch COMPLETED?". Getrennt wird die Regel "kein Bereich
-- wird vergessen" erstmals maschinell pruefbar - und das ist der Produktkern.

create type advice_session_status as enum ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED');
create type topic_progress_status as enum ('NOT_STARTED','IN_PROGRESS','DISCUSSED','SKIPPED');
create type topic_outcome         as enum ('NO_ACTION_NEEDED','ACTION_REQUIRED','OFFER_REQUESTED',
                                           'CONTRACT_REQUESTED','FOLLOW_UP','CLIENT_DECLINED');
-- Dritte, faktische Dimension: Konzeptpunkt 5 vermischt in seiner Statusliste
-- auch noch die Feststellung, ob ueberhaupt eine Deckung besteht. Das ist
-- kein Status, sondern ein Befund.
create type coverage_state        as enum ('UNKNOWN','NO_COVER','COVER_EXISTS');
create type note_visibility       as enum ('INTERNAL','SHARED');

create table advice_sessions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  customer_id           uuid not null references customers(id) on delete restrict,
  template_version_id   uuid not null references advice_template_versions(id) on delete restrict,
  advisor_member_id     uuid not null references organization_members(id) on delete restrict,
  status                advice_session_status not null default 'DRAFT',
  title                 text,
  location              text,
  scheduled_at          timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,

  -- Korrekturen erzeugen eine neue Version mit Bezug auf die vorige, nie
  -- eine stille Aenderung (Konzeptpunkt 29).
  version               int not null default 1,
  supersedes_session_id uuid references advice_sessions(id) on delete set null,

  -- Geraetekonflikt-Erkennung (ADR-002). Eine echte Konfliktaufloesung waere
  -- hier ueberdimensioniert: eine Beratung wird faktisch von einem Geraet
  -- gefuehrt.
  active_device_id      text,
  active_device_seen_at timestamptz,
  last_client_seq       bigint not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references profiles(id) on delete set null,
  updated_by            uuid references profiles(id) on delete set null,
  deleted_at            timestamptz,

  check (status <> 'COMPLETED' or completed_at is not null),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table advice_session_participants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  person_id       uuid references customer_persons(id) on delete set null,
  display_name    text not null,
  attended        boolean not null default true,
  created_at      timestamptz not null default now()
);

create table advice_session_topics (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  session_id           uuid not null references advice_sessions(id) on delete cascade,
  topic_id             uuid not null references insurance_topics(id) on delete restrict,

  -- Aus der Vorlagenversion kopiert: der Snapshot-Gedanke auf Zeilenebene.
  -- Aendert die Firma morgen ihre Vorlage, bleibt die gestrige Beratung
  -- exakt so bewertbar, wie sie gefuehrt wurde.
  display_order        int not null default 0,
  is_required          boolean not null default false,
  field_schema_version int not null default 1,

  progress_status      topic_progress_status not null default 'NOT_STARTED',
  outcome              topic_outcome,
  coverage_state       coverage_state not null default 'UNKNOWN',
  priority             smallint check (priority between 1 and 3),
  details              jsonb not null default '{}'::jsonb,
  discussed_at         timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (session_id, topic_id),

  -- Zweite Instanz der Durchsetzung neben der reinen Funktion in der
  -- Domaene: hier unumgehbar.
  constraint outcome_requires_discussed
    check (outcome is null or progress_status = 'DISCUSSED'),
  constraint discussed_requires_timestamp
    check (progress_status <> 'DISCUSSED' or discussed_at is not null)
);

-- Idempotenz der Command-Pipeline (ADR-002).
--
-- Kein Default auf id: die Kennung MUSS vom Client kommen, sonst
-- funktioniert die Idempotenz nicht. Der Server schreibt mit
-- on conflict do nothing - ein wiederholt gesendeter Befehl wird dadurch
-- ignoriert statt doppelt angewendet.
create table advice_command_log (
  id              uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  command_type    text not null,
  client_seq      bigint not null,
  applied_at      timestamptz not null default now(),
  applied_by      uuid references profiles(id) on delete set null
);

create index advice_command_log_session_idx on advice_command_log (session_id, client_seq);
create index advice_command_log_org_idx on advice_command_log (organization_id);

-- advice_command_log steht auf der Ausschlussliste aus 0008: anfuegende
-- Tabellen bekommen ihren Policy-Satz von Hand, damit der Generator ihnen
-- nicht stillschweigend Update- und Delete-Rechte gibt. Die Selbstpruefung
-- in assert_rls_complete() hat das Fehlen dieser Policies sofort gemeldet.
alter table advice_command_log enable row level security;
alter table advice_command_log force  row level security;
alter table advice_command_log
  alter column organization_id set default public.auth_org_id();

create policy advice_command_log_select on advice_command_log for select to authenticated
  using (organization_id = public.auth_org_id());

create policy advice_command_log_insert on advice_command_log for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.can_write('advice_sessions'));

-- Bewusst keine Update- und keine Delete-Policy: waere der Log
-- manipulierbar, liesse sich ein Befehl ein zweites Mal anwenden und die
-- Idempotenz waere wertlos. Aufraeumen erledigt ein Wartungsjob als
-- service_role.

create table notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid references customers(id) on delete cascade,
  session_id       uuid references advice_sessions(id) on delete cascade,
  session_topic_id uuid references advice_session_topics(id) on delete cascade,
  -- Berater und Kunde schauen auf denselben Bildschirm. Eine interne Notiz
  -- darf nie im Kunden-PDF landen (Analyse 1.6).
  visibility       note_visibility not null default 'SHARED',
  body             text not null check (length(body) <= 10000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id) on delete set null,
  updated_by       uuid references profiles(id) on delete set null,
  -- Echte Fremdschluessel statt entity_type/entity_id, aber trotzdem nur ein
  -- Bezug je Notiz (Analyse 2.9).
  constraint notes_exactly_one_owner
    check (num_nonnulls(customer_id, session_id, session_topic_id) = 1)
);

create index notes_session_idx on notes (session_id);
create index notes_session_topic_idx on notes (session_topic_id);
create index notes_customer_idx on notes (customer_id);

create index advice_session_topics_session_idx
  on advice_session_topics (session_id, display_order);

create index advice_sessions_open_idx
  on advice_sessions (organization_id, updated_at desc)
  where status in ('DRAFT','IN_PROGRESS') and deleted_at is null;

create index advice_sessions_customer_idx on advice_sessions (customer_id);

create trigger trg_sessions_touch before update on advice_sessions
  for each row execute function public.touch_updated_at();
create trigger trg_session_topics_touch before update on advice_session_topics
  for each row execute function public.touch_updated_at();
create trigger trg_notes_touch before update on notes
  for each row execute function public.touch_updated_at();

create trigger trg_audit_sessions
  after insert or update or delete on advice_sessions
  for each row execute function public.audit_trigger();
create trigger trg_audit_session_topics
  after insert or update or delete on advice_session_topics
  for each row execute function public.audit_trigger();

select public.apply_tenant_rls();
select public.assert_rls_complete();
