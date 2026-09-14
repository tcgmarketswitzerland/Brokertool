-- Phase 4 - Bestehende Vertraege und Dokumente
--
-- Bewusst schlank gehalten (ADR-001): Pflicht sind Versicherer und
-- Praemie, alles Weitere ist optional. Konzeptpunkt 6 verlangt neun
-- strukturierte Felder - das ist waehrend eines laufenden Gespraechs auf
-- einem iPad zu viel Tipparbeit, und der Kunde hat die Police meist gar
-- nicht dabei. Er weiss: "Hausrat ist bei der AXA, etwa 480 im Jahr."
--
-- Das Datenmodell ist trotzdem vollstaendig; nur die Oberflaeche ist
-- schlank. Das Backoffice erfasst spaeter nach.

create type policy_status     as enum ('ACTIVE','CANCELLED','EXPIRED','REPLACED','UNKNOWN');
create type premium_frequency as enum ('MONTHLY','QUARTERLY','SEMIANNUAL','YEARLY','SINGLE');
create type document_kind     as enum ('POLICY','OFFER','CORRESPONDENCE','IDENTITY',
                                       'PENSION_CERTIFICATE','ADVICE_REPORT','OTHER');

-- Klasse B: globaler Katalog ohne organization_id
create table insurers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short_name text,
  country    char(2) not null default 'CH',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table insurers enable row level security;
alter table insurers force  row level security;
create policy insurers_read on insurers for select to authenticated using (true);

create table policies (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  customer_id            uuid not null references customers(id) on delete cascade,
  -- NULL bedeutet: gehoert dem Haushalt. Hausrat und Haftpflicht sind
  -- Haushaltssachen, Vorsorge und Risiko haengen an einer Person (ADR-003).
  person_id              uuid references customer_persons(id) on delete set null,
  topic_id               uuid not null references insurance_topics(id) on delete restrict,

  insurer_id             uuid references insurers(id) on delete set null,
  insurer_name           text,
  product_name           text,
  policy_number          text,
  status                 policy_status not null default 'ACTIVE',

  start_date             date,
  end_date               date,
  premium_cents          bigint check (premium_cents >= 0),
  premium_frequency      premium_frequency not null default 'YEARLY',
  sum_insured_cents      bigint check (sum_insured_cents >= 0),
  deductible_cents       bigint check (deductible_cents >= 0),
  notice_period_months   smallint check (notice_period_months between 0 and 24),
  next_cancellation_date date,
  coverage               jsonb not null default '{}'::jsonb,

  source_session_id      uuid references advice_sessions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references profiles(id) on delete set null,
  updated_by             uuid references profiles(id) on delete set null,
  deleted_at             timestamptz,

  -- Entweder aus dem Katalog oder als Freitext, aber nicht namenlos: ein
  -- Vertrag ohne Versicherer ist im Gespraech wertlos.
  constraint policies_needs_insurer
    check (insurer_id is not null or nullif(btrim(coalesce(insurer_name,'')),'') is not null),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index policies_customer_idx on policies (customer_id, topic_id) where deleted_at is null;
create index policies_topic_idx on policies (organization_id, topic_id) where deleted_at is null;

-- Speist die Dashboard-Kachel "bald kuendbar". Teilindex, weil die Abfrage
-- bei jedem Login laeuft.
create index policies_upcoming_cancellation
  on policies (organization_id, next_cancellation_date)
  where deleted_at is null and next_cancellation_date is not null;

create table documents (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  customer_id       uuid references customers(id) on delete cascade,
  policy_id         uuid references policies(id) on delete cascade,
  session_id        uuid references advice_sessions(id) on delete cascade,
  kind              document_kind not null default 'OTHER',
  storage_path      text not null unique,
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  checksum          text,
  uploaded_by       uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  -- Ein Dokument ohne Bezug waere spaeter nicht mehr auffindbar.
  check (num_nonnulls(customer_id, policy_id, session_id) >= 1)
);

create index documents_customer_idx on documents (customer_id) where deleted_at is null;
create index documents_policy_idx on documents (policy_id) where deleted_at is null;

create trigger trg_policies_touch before update on policies
  for each row execute function public.touch_updated_at();
create trigger trg_insurers_touch before update on insurers
  for each row execute function public.touch_updated_at();

create trigger trg_audit_policies
  after insert or update or delete on policies
  for each row execute function public.audit_trigger();
create trigger trg_audit_documents
  after insert or update or delete on documents
  for each row execute function public.audit_trigger();

-- Versichererkatalog. Bewusst kurz gehalten: die Liste deckt den Grossteil
-- des Schweizer Marktes ab, und fuer alles andere gibt es das Freitextfeld.
-- Eine vollstaendige Liste zu pflegen waere Arbeit ohne Gegenwert.
insert into insurers (name, short_name) values
  ('AXA', 'AXA'),
  ('Allianz Suisse', 'Allianz'),
  ('Baloise', 'Baloise'),
  ('CSS', 'CSS'),
  ('Concordia', 'Concordia'),
  ('Die Mobiliar', 'Mobiliar'),
  ('Generali', 'Generali'),
  ('Groupe Mutuel', 'Groupe Mutuel'),
  ('Helsana', 'Helsana'),
  ('Helvetia', 'Helvetia'),
  ('KPT', 'KPT'),
  ('Pax', 'Pax'),
  ('Sanitas', 'Sanitas'),
  ('Smile', 'Smile'),
  ('Basler Versicherungen', 'Basler'),
  ('Swica', 'Swica'),
  ('Swiss Life', 'Swiss Life'),
  ('Sympany', 'Sympany'),
  ('TCS', 'TCS'),
  ('Vaudoise', 'Vaudoise'),
  ('Visana', 'Visana'),
  ('Zurich', 'Zurich')
on conflict (name) do nothing;

select public.apply_tenant_rls();
select public.assert_rls_complete();
