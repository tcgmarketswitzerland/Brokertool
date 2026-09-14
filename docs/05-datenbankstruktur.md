# Schritt 4 — Datenbankstruktur

Grundlage: Analyse (01), ADR-001 bis ADR-004 (02), Architektur (03), Projektplan (04).
Zielsystem: PostgreSQL 15+ (Supabase).
Datum: 2026-09-14

Dieses Dokument ist die Vorlage für die Migrationen. Es ist bewusst als lauffähiges DDL
geschrieben, wird aber in Schritt 5/6 in nummerierte Migrationsdateien aufgeteilt.

---

## 1. Grundsätze

### 1.1 Konventionen

| Regel | Begründung |
|---|---|
| Alle Primärschlüssel sind `uuid` mit `gen_random_uuid()` | Konzeptpunkt 26; client-generierbar, wichtig für die Command-Idempotenz (ADR-002) |
| Tabellen- und Spaltennamen `snake_case`, Tabellen im Plural | Postgres-Konvention |
| Enums als native Postgres-Enums | Typsicherheit bis in die DB; Werte erscheinen so auch in den generierten TS-Typen |
| Geldbeträge als `bigint` in **Rappen** | Keine Float-Rundungsfehler in Versorgungslücken |
| Zeitstempel immer `timestamptz` | Nie `timestamp` ohne Zone |
| `created_at`, `updated_at` auf jeder fachlichen Tabelle | Konzeptpunkt 26 |
| `created_by`, `updated_by` wo fachlich relevant | Konzeptpunkt 26 |
| `deleted_at` statt physischem Löschen bei personenbezogenen Daten | Analyse 1.10 |
| Spartenspezifische Felder in `jsonb`, per Zod validiert | Analyse 2.8 — Konfigurierbarkeit ohne Metadaten-Engine |

### 1.2 Die wichtigste Strukturregel

> **Es gibt keine Tabelle mit einer nullable `organization_id`.**

Eine Tabelle gehört genau einer von drei Klassen an:

| Klasse | Beispiel | `organization_id` | RLS |
|---|---|---|---|
| **A — Mandantendaten** | `customers`, `advice_sessions` | `NOT NULL` | Generator, gegen `auth_org_id()` |
| **B — Globale Kataloge** | `insurance_topics`, `insurers`, `legal_parameters` | Spalte existiert nicht | Lesen für alle Angemeldeten, Schreiben nur `service_role` |
| **C — Selbstbezug** | `profiles` | Spalte existiert nicht | `id = auth.uid()` |

Diese Regel klingt pedantisch, ist aber der Grund, warum der Policy-Generator (Architektur 8.3)
überhaupt funktionieren kann: Er erkennt Klasse A allein am Vorhandensein der Spalte. Eine nullable
`organization_id` wäre eine Zeile, die zu niemandem gehört — und damit ein Loch in der Isolation.

**Konsequenz für Beratungsvorlagen:** Statt einer globalen Vorlage mit `organization_id IS NULL`
bekommt jede Organisation bei der Registrierung eine eigene Kopie der Standardvorlage. Das kostet
ein paar Zeilen pro Organisation und erspart eine Sonderregel im gesamten Sicherheitsmodell.

### 1.3 Was gegenüber dem Konzeptentwurf (Punkt 26) geändert wurde

| Konzept | Hier | Grund |
|---|---|---|
| `advice_topics` + `advice_topic_results` | `insurance_topics` + `organization_topic_settings` + `advice_session_topics` | Analyse 2.9 — ein Ergebnis ohne Topic existiert nicht |
| `customer_household_members` | `customer_persons` als vollwertige Person | ADR-003 |
| `documents` + `policy_documents` | nur `documents` mit optionalen Bezügen | Analyse 2.9 |
| — | `advice_templates` + `advice_template_versions` + `advice_template_topics` | Architektur 2.10 |
| — | `advice_command_log` | ADR-002, Idempotenz |
| — | `signatures`, `consents`, `invitations`, `legal_parameters`, `insurers` | Analyse 1.2, 1.5, 1.11 |
| `notes` polymorph | `notes` mit drei nullable FKs und `num_nonnulls`-Constraint | Analyse 2.9 |

---

## 2. Erweiterungen und Enums

```sql
-- gen_random_uuid() und sha256() sind seit PostgreSQL 13 bzw. 11 eingebaut;
-- pgcrypto wird dafuer nicht benoetigt.
create extension if not exists "citext";      -- case-insensitive E-Mail
create extension if not exists "pg_trgm";     -- Kundensuche

-- Organisation und Zugriff
create type org_role          as enum ('OWNER','ADMIN','ADVISOR','BACKOFFICE');
create type invitation_status as enum ('PENDING','ACCEPTED','REVOKED','EXPIRED');

-- Kunden
create type customer_type    as enum ('PRIVATE','COUPLE','FAMILY','COMPANY');
create type person_role      as enum ('PRIMARY','PARTNER','CHILD','OTHER');
create type sex              as enum ('FEMALE','MALE','UNSPECIFIED');
create type marital_status   as enum ('SINGLE','MARRIED','REGISTERED_PARTNERSHIP',
                                      'DIVORCED','WIDOWED','SEPARATED');
create type employment_type  as enum ('EMPLOYED','SELF_EMPLOYED','UNEMPLOYED',
                                      'RETIRED','STUDENT','HOMEMAKER','OTHER');
create type address_kind     as enum ('HOME','BILLING','WORK');
create type consent_type     as enum ('DATA_PROCESSING','MARKETING','DOCUMENT_SHARING');

-- Sparten und Vorlagen
create type topic_category   as enum ('PROPERTY','LIABILITY','VEHICLE','LEGAL','TRAVEL',
                                      'HEALTH','ACCIDENT','PENSION','LIFE','FINANCE',
                                      'PET','CYBER','BUSINESS');
create type template_status  as enum ('DRAFT','PUBLISHED','ARCHIVED');

-- Beratung  (Statusmodell, Architektur 10.2)
create type advice_session_status as enum ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED');
create type topic_progress_status as enum ('NOT_STARTED','IN_PROGRESS','DISCUSSED','SKIPPED');
create type topic_outcome         as enum ('NO_ACTION_NEEDED','ACTION_REQUIRED','OFFER_REQUESTED',
                                           'CONTRACT_REQUESTED','FOLLOW_UP','CLIENT_DECLINED');
create type coverage_state        as enum ('UNKNOWN','NO_COVER','COVER_EXISTS');
create type note_visibility       as enum ('INTERNAL','SHARED');
create type signature_kind        as enum ('CUSTOMER','ADVISOR');

-- Verträge und Dokumente
create type policy_status      as enum ('ACTIVE','CANCELLED','EXPIRED','REPLACED','UNKNOWN');
create type premium_frequency  as enum ('MONTHLY','QUARTERLY','SEMIANNUAL','YEARLY','SINGLE');
create type document_kind      as enum ('POLICY','OFFER','CORRESPONDENCE','IDENTITY',
                                        'PENSION_CERTIFICATE','ADVICE_REPORT','OTHER');

-- Aufgaben
create type task_owner_type as enum ('CUSTOMER','ADVISOR');
create type task_status     as enum ('OPEN','IN_PROGRESS','DONE','CANCELLED');
create type task_priority   as enum ('LOW','NORMAL','HIGH');

-- Vorsorge (Schema jetzt, Umsetzung nach MVP)
create type pension_scenario as enum ('DISABILITY_ACCIDENT','DISABILITY_ILLNESS',
                                      'DEATH','RETIREMENT');

-- Audit
create type audit_action as enum ('INSERT','UPDATE','DELETE');
```

**Zur Trennung `DISABILITY_ACCIDENT` / `DISABILITY_ILLNESS`:** Das ist die in Analyse 1.5
begründete Entscheidung, hier als Enum-Wert festgeschrieben. Sie lässt sich später nicht mehr
folgenlos zusammenlegen — und genau das ist beabsichtigt.

**Zu `coverage_state`:** Konzeptpunkt 5 vermischt in seiner Statusliste drei Dinge —
Bearbeitungsfortschritt, Kundenentscheid und die Tatsache, ob überhaupt eine Deckung besteht.
Letzteres ist eine Feststellung, kein Status, und bekommt deshalb ein eigenes Feld.

---

## 3. Hilfsfunktionen

```sql
-- Aktive Organisation aus dem JWT-Claim (Architektur 7.1)
create or replace function public.auth_org_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'organization_id', ''
  )::uuid;
$$;

create or replace function public.auth_org_role() returns org_role
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'organization_role', ''
  )::public.org_role;
$$;

-- Rechtematrix an genau einer Stelle (Konzeptpunkt 20, Architektur 8.3)
create or replace function public.has_permission(action text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case public.auth_org_role()
    when 'OWNER'     then true
    when 'ADMIN'     then action <> 'organization:billing'
    when 'ADVISOR'   then action in ('customer:read','customer:write',
                                     'advice:read','advice:write','advice:complete',
                                     'policy:read','policy:write',
                                     'task:read','task:write','document:read','document:write')
    when 'BACKOFFICE' then action in ('customer:read','customer:write',
                                      'advice:read',
                                      'policy:read','policy:write',
                                      'task:read','task:write','document:read','document:write')
    else false
  end;
$$;

-- updated_at automatisch pflegen
create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
```

Beachte: `stable` bei `auth_org_id()` ist kein Kosmetik-Detail. Ohne dieses Schlüsselwort wertet der
Planer die Funktion pro Zeile aus statt einmal pro Query — bei einer Kundenliste mit 2'000 Zeilen
ist das der Unterschied zwischen wenigen Millisekunden und einer spürbaren Verzögerung.

Beachte weiter: `BACKOFFICE` hat bewusst **kein** `advice:write` und kein `advice:complete`. Das
Backoffice pflegt Verträge und Aufgaben nach, führt aber keine Beratung — Konzeptpunkt 20.

---

## 4. Organisation und Zugriff

```sql
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 200),
  slug          citext not null unique,
  plan          text not null default 'trial',     -- Platzhalter Billing (Konzeptpunkt 31)
  seats         int  not null default 1 check (seats > 0),
  default_locale text not null default 'de-CH',
  require_mfa   boolean not null default false,
  branding      jsonb not null default '{}'::jsonb, -- { logo_path, primary_color }
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Klasse C: gehört dem Nutzer, nicht der Organisation
create table profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  citext not null,
  full_name              text,
  active_organization_id uuid references organizations(id) on delete set null,
  locale                 text not null default 'de-CH',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            org_role not null default 'ADVISOR',
  display_name    text not null,          -- denormalisiert, siehe Hinweis unten
  email           citext not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           citext not null,
  role            org_role not null default 'ADVISOR',
  token_hash      text not null unique,   -- nie das Klartext-Token speichern
  expires_at      timestamptz not null,
  status          invitation_status not null default 'PENDING',
  invited_by      uuid references profiles(id) on delete set null,
  accepted_at     timestamptz,
  accepted_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index invitations_one_pending_per_email
  on invitations (organization_id, email) where status = 'PENDING';
```

**Warum `display_name` und `email` in `organization_members` dupliziert sind:** Die Mitgliederliste
und jede Beratung müssen den Namen des Beraters anzeigen. Läge er nur in `profiles`, bräuchte es
eine RLS-Policy, die das Lesen fremder Profile erlaubt, sobald man eine Organisation teilt — ein
Subselect in einer sicherheitskritischen Policy. Die Denormalisierung ist hier die deutlich
einfachere und sicherere Lösung: `profiles` bleibt strikt bei `id = auth.uid()`. Preis ist eine
Synchronisation bei Namensänderung, die ein Trigger übernimmt.

---

## 5. Globale Kataloge (Klasse B)

```sql
create table insurance_topics (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  name                     jsonb not null,   -- { "de": "Hausrat", "fr": "...", "it": "..." }
  description              jsonb not null default '{}'::jsonb,
  category                 topic_category not null,
  icon                     text,
  display_order            int not null default 0,
  applicable_customer_types customer_type[] not null
                             default '{PRIVATE,COUPLE,FAMILY}'::customer_type[],
  field_schema_key         text not null,    -- Schlüssel des Zod-Schemas im Code
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (name ? 'de')                        -- Deutsch ist Pflicht (ADR-004)
);

create table insurers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short_name text,
  country    char(2) not null default 'CH',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Versionierte gesetzliche Parameter (Analyse 1.5)
create table legal_parameters (
  id          uuid primary key default gen_random_uuid(),
  valid_year  int  not null check (valid_year between 2020 and 2100),
  key         text not null,        -- z.B. 'bvg.coordination_deduction'
  value       numeric not null,
  unit        text not null default 'CHF',
  source_note text,
  created_at  timestamptz not null default now(),
  unique (valid_year, key)
);
```

`legal_parameters` ist der Grund, warum eine Vorsorgeanalyse von 2026 im Jahr 2029 noch
reproduzierbar ist. Die Berechnungsfunktion bekommt die Parameter als Argument übergeben und
importiert sie nie (Architektur 10.4).

---

## 6. Beratungsvorlagen (Architektur 2.10)

```sql
create table advice_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key             text not null,
  name            jsonb not null,
  customer_types  customer_type[] not null default '{PRIVATE,COUPLE,FAMILY}'::customer_type[],
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null,
  unique (organization_id, key)
);

create unique index advice_templates_one_default_per_org
  on advice_templates (organization_id) where is_default;

create table advice_template_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  template_id     uuid not null references advice_templates(id) on delete cascade,
  version         int  not null check (version > 0),
  status          template_status not null default 'DRAFT',
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null,
  unique (template_id, version),
  check (status <> 'PUBLISHED' or published_at is not null)
);

create table advice_template_topics (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  template_version_id uuid not null references advice_template_versions(id) on delete cascade,
  topic_id            uuid not null references insurance_topics(id),
  display_order       int  not null default 0,
  is_required         boolean not null default false,
  field_schema_version int not null default 1,
  unique (template_version_id, topic_id)
);
```

`is_required` ist das fachlich wichtigste Feld des ganzen Vorlagensystems: Es entscheidet, welche
Sparten für den Abschluss zwingend ein Ergebnis brauchen. Damit wird „kein Bereich wird vergessen"
pro Organisation konfigurierbar, statt im Code festzustehen.

Eine veröffentlichte Vorlagenversion ist unveränderlich (Trigger in Abschnitt 12).

```sql
create table organization_topic_settings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  topic_id        uuid not null references insurance_topics(id) on delete cascade,
  is_enabled      boolean not null default true,
  display_order   int,
  custom_name     jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, topic_id)
);
```

---

## 7. Kunden (ADR-003)

```sql
create table customers (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  customer_type          customer_type not null default 'PRIVATE',
  display_name           text not null,            -- per Trigger gepflegt, für Suche und Listen
  correspondence_language text not null default 'de' check (correspondence_language in ('de','fr','it','en')),
  primary_advisor_id     uuid references organization_members(id) on delete set null,
  external_ref           text,                     -- ID im CRM des Brokers
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references profiles(id) on delete set null,
  updated_by             uuid references profiles(id) on delete set null,
  deleted_at             timestamptz,
  anonymized_at          timestamptz               -- Analyse 1.10
);

create table customer_persons (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  person_role         person_role not null default 'PRIMARY',
  first_name          text not null,
  last_name           text not null,
  date_of_birth       date check (date_of_birth > '1900-01-01' and date_of_birth <= current_date),
  sex                 sex not null default 'UNSPECIFIED',
  marital_status      marital_status,
  nationality         char(2),
  phone               text,
  email               citext,
  occupation          text,
  employer            text,
  employment_type     employment_type,
  annual_income_cents bigint check (annual_income_cents >= 0),
  is_insured_person   boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references profiles(id) on delete set null,
  updated_by          uuid references profiles(id) on delete set null,
  deleted_at          timestamptz
);

create unique index customer_persons_one_primary
  on customer_persons (customer_id) where person_role = 'PRIMARY' and deleted_at is null;

create table customer_addresses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  person_id       uuid references customer_persons(id) on delete cascade,
  kind            address_kind not null default 'HOME',
  street          text,
  street_number   text,
  postal_code     text,
  city            text,
  country         char(2) not null default 'CH',
  valid_from      date not null default current_date,
  valid_to        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create table consents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  consent_type    consent_type not null,
  granted         boolean not null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  source          text,                              -- 'ADVICE_SESSION', 'PORTAL', 'PAPER'
  document_id     uuid,                              -- FK wird nach documents nachgezogen
  created_at      timestamptz not null default now()
);
```

**Bewusst nicht aufgenommen:** die AHV-Nummer. Sie wäre für eine spätere automatische
Vorsorgeberechnung nützlich, ist aber ein besonders schützenswertes Identifikationsmerkmal mit
eigenen gesetzlichen Auflagen. Ohne zwingenden fachlichen Bedarf im MVP gilt Datensparsamkeit.

**`sex` ist enthalten**, weil es für die spätere Vorsorgeberechnung (Referenzalter, Rentenhöhen)
fachlich benötigt wird — nicht als demografisches Merkmal. Standardwert `UNSPECIFIED`, damit die
Schnellanlage nicht danach fragen muss.

**`display_name`** wird per Trigger aus den Personen gebildet („Max und Anna Muster"). Ohne dieses
Feld bräuchte jede Kundenliste einen Join plus Aggregation über `customer_persons` — bei einer
Suchliste im Gespräch spürbar.

---

## 8. Beratung — das Herzstück

```sql
create table advice_sessions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  customer_id          uuid not null references customers(id) on delete restrict,
  template_version_id  uuid not null references advice_template_versions(id) on delete restrict,
  advisor_member_id    uuid not null references organization_members(id) on delete restrict,
  status               advice_session_status not null default 'DRAFT',
  title                text,
  location             text,
  scheduled_at         timestamptz,
  started_at           timestamptz,
  completed_at         timestamptz,

  -- Versionierung / Korrekturen (Konzeptpunkt 29)
  version              int  not null default 1,
  supersedes_session_id uuid references advice_sessions(id) on delete set null,

  -- Gerätekonflikt-Erkennung (ADR-002)
  active_device_id     text,
  active_device_seen_at timestamptz,
  last_client_seq      bigint not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references profiles(id) on delete set null,
  updated_by           uuid references profiles(id) on delete set null,
  deleted_at           timestamptz,

  check (status <> 'COMPLETED' or completed_at is not null),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
```

`on delete restrict` bei `customer_id` und `template_version_id` ist Absicht: Ein Kunde mit
abgeschlossener Beratung darf nicht per Kaskade verschwinden, sonst wäre das Protokoll verwaist.
Löschung läuft über `deleted_at`.

```sql
create table advice_session_participants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  person_id       uuid references customer_persons(id) on delete set null,
  display_name    text not null,        -- auch für Teilnehmende ohne Kundendatensatz
  attended        boolean not null default true,
  created_at      timestamptz not null default now()
);

create table advice_session_topics (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  session_id           uuid not null references advice_sessions(id) on delete cascade,
  topic_id             uuid not null references insurance_topics(id) on delete restrict,

  -- aus der Vorlagenversion kopiert: die Beratung bleibt nachvollziehbar,
  -- auch wenn die Vorlage später geändert wird
  display_order        int  not null default 0,
  is_required          boolean not null default false,
  field_schema_version int  not null default 1,

  progress_status      topic_progress_status not null default 'NOT_STARTED',
  outcome              topic_outcome,
  coverage_state       coverage_state not null default 'UNKNOWN',
  priority             smallint check (priority between 1 and 3),
  details              jsonb not null default '{}'::jsonb,
  discussed_at         timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (session_id, topic_id),

  -- Statusmodell, zweite Instanz der Durchsetzung (Architektur 10.2)
  constraint outcome_requires_discussed
    check (outcome is null or progress_status = 'DISCUSSED'),
  constraint discussed_requires_timestamp
    check (progress_status <> 'DISCUSSED' or discussed_at is not null)
);
```

Die drei kopierten Felder (`display_order`, `is_required`, `field_schema_version`) sind der
Snapshot-Gedanke auf Zeilenebene: Ändert die Organisation morgen ihre Vorlage, bleibt die gestrige
Beratung exakt so bewertbar, wie sie geführt wurde.

```sql
-- Idempotenz der Command-Pipeline (ADR-002, Architektur 5.2)
create table advice_command_log (
  id              uuid primary key,        -- vom Client erzeugt, KEIN Default
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  command_type    text not null,
  client_seq      bigint not null,
  applied_at      timestamptz not null default now(),
  applied_by      uuid references profiles(id) on delete set null
);
```

Das fehlende `default gen_random_uuid()` ist hier die entscheidende Zeile: Die ID **muss** vom
Client kommen, sonst funktioniert die Idempotenz nicht. Der Server schreibt mit
`on conflict (id) do nothing` — ein wiederholt gesendetes Command wird dadurch ignoriert statt
doppelt angewendet.

```sql
create table advice_session_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade unique,
  schema_version  int  not null default 1,
  document        jsonb not null,          -- das SummaryDocument (Architektur 10.3)
  content_hash    text not null,           -- sha256, hex
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles(id) on delete set null
);

create table signatures (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  snapshot_id     uuid not null references advice_session_snapshots(id) on delete restrict,
  kind            signature_kind not null default 'CUSTOMER',
  signer_person_id uuid references customer_persons(id) on delete set null,
  signer_name     text not null,
  storage_path    text not null,
  signed_at       timestamptz not null default now(),
  signed_ip       inet,
  user_agent      text
);
```

**Zu `signed_ip` und `user_agent`:** Diese Felder werden bewusst im Klartext gespeichert, nicht
gehasht. Ihr einziger Zweck ist der Nachweis im Streitfall, und ein Hash wäre dafür wertlos. Das ist
eine begründete Bearbeitung und gehört als solche ins Bearbeitungsverzeichnis — nicht als
Standard-Protokollierung, sondern gebunden an den Signaturvorgang.

Der Snapshot referenziert die Session, nicht umgekehrt. Dadurch entsteht kein Ringbezug im Schema,
und die Regel „abgeschlossen heisst: es gibt genau einen Snapshot" wird durch `unique` erzwungen.

---

## 9. Verträge, Dokumente, Notizen, Aufgaben

```sql
create table policies (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  customer_id            uuid not null references customers(id) on delete cascade,
  person_id              uuid references customer_persons(id) on delete set null,  -- NULL = Haushalt
  topic_id               uuid not null references insurance_topics(id) on delete restrict,

  insurer_id             uuid references insurers(id) on delete set null,
  insurer_name           text,                        -- Freitext-Rückfallebene
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
  next_cancellation_date date,                        -- speist das Dashboard
  coverage               jsonb not null default '{}'::jsonb,

  source_session_id      uuid references advice_sessions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references profiles(id) on delete set null,
  updated_by             uuid references profiles(id) on delete set null,
  deleted_at             timestamptz,

  check (insurer_id is not null or nullif(btrim(coalesce(insurer_name,'')),'') is not null),
  check (end_date is null or start_date is null or end_date >= start_date)
);

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
  check (num_nonnulls(customer_id, policy_id, session_id) >= 1)
);

alter table consents
  add constraint consents_document_fk
  foreign key (document_id) references documents(id) on delete set null;

create table notes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid references customers(id) on delete cascade,
  session_id       uuid references advice_sessions(id) on delete cascade,
  session_topic_id uuid references advice_session_topics(id) on delete cascade,
  visibility       note_visibility not null default 'SHARED',
  body             text not null check (length(body) <= 10000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id) on delete set null,
  updated_by       uuid references profiles(id) on delete set null,
  constraint notes_exactly_one_owner
    check (num_nonnulls(customer_id, session_id, session_topic_id) = 1)
);

create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  customer_id        uuid references customers(id) on delete cascade,
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
  check (owner_type <> 'ADVISOR' or assignee_member_id is not null),
  check (status <> 'DONE' or completed_at is not null)
);
```

`notes_exactly_one_owner` mit `num_nonnulls` löst das polymorphe Notizproblem aus der Analyse (2.9)
sauber: echte Fremdschlüssel mit Kaskadenverhalten, aber trotzdem nur ein Bezug pro Notiz.

---

## 10. Vorsorge (Schema jetzt, Umsetzung nach dem MVP)

```sql
create table pension_analyses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  person_id       uuid not null references customer_persons(id) on delete cascade,
  parameter_year  int  not null,
  assumptions     jsonb not null default '{}'::jsonb,
  disclaimer_version int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, person_id)
);

create table pension_analysis_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  analysis_id         uuid not null references pension_analyses(id) on delete cascade,
  scenario            pension_scenario not null,
  target_income_cents bigint not null check (target_income_cents >= 0),
  benefits            jsonb not null default '{}'::jsonb,  -- { ahv_iv, bvg, uvg, ktg, private }
  total_benefits_cents bigint not null default 0,
  gap_cents           bigint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (analysis_id, scenario)
);
```

Die Analyse hängt an **einer Person**, nicht am Kunden — bei einem Paar gibt es zwei Analysen
(ADR-003). `parameter_year` friert die verwendeten gesetzlichen Grundlagen ein.

---

## 11. Zusammenfassung, Audit, Integration

```sql
create table email_summaries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null references advice_sessions(id) on delete cascade,
  language        text not null default 'de',
  subject         text not null,
  body            text not null,
  status          text not null default 'DRAFT' check (status in ('DRAFT','SENT')),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_user_id   uuid,
  action          audit_action not null,
  entity_table    text not null,
  entity_id       uuid,
  changed_fields  text[],
  recorded_values jsonb,            -- NUR Whitelist-Felder, siehe Hinweis
  occurred_at     timestamptz not null default now()
);

create table webhook_endpoints (       -- reserviert, Phase 3 (Konzeptpunkt 15)
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  url             text not null,
  secret_hash     text not null,
  events          text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

**`audit_logs.id` ist bewusst `bigint identity` statt `uuid`** — als einzige Tabelle im Schema.
Begründung: Das Audit-Log ist keine fachliche Entität, sondern ein Anhang mit hohem Schreibvolumen;
eine monoton steigende Zahl ist dafür deutlich effizienter und liefert die Reihenfolge gratis.

**Zu `recorded_values`:** Vollständige Vorher/Nachher-Abbilder würden Personendaten ein zweites Mal
speichern und damit das Löschkonzept unterlaufen (Analyse 1.10). Der Trigger schreibt deshalb
standardmässig **nur die Namen** der geänderten Felder. Werte werden ausschliesslich für eine kurze
Whitelist entscheidungsrelevanter Felder festgehalten — `progress_status`, `outcome`,
`coverage_state`, `advice_sessions.status`, `organization_members.role`. Genau diese Änderungen
sind es, die im Streitfall interessieren.

`audit_logs` trägt bewusst **keinen Fremdschlüssel** auf `organizations`: Der Eintrag muss eine
gelöschte Organisation überleben.

---

## 12. Trigger und Datenbankfunktionen

```sql
-- (a) updated_at auf allen Tabellen mit dieser Spalte — per Schleife erzeugt
-- (b) display_name der Kunden aus den Personen pflegen
-- (c) display_name/email in organization_members bei Profiländerung synchronisieren
-- (d) Audit-Trigger auf: customers, customer_persons, advice_sessions,
--     advice_session_topics, policies, documents, organization_members

-- (e) Schreibschutz für abgeschlossene Beratungen (Konzeptpunkt 29, Phase 6)
--     Zwei Funktionen, nicht eine: ein Feldzugriff auf new.session_id scheitert auf
--     advice_sessions selbst mit "record new has no field session_id" — coalesce
--     schützt davor nicht, weil plpgsql das Feld trotzdem auflöst.

-- e1: Kindtabellen mit session_id
create or replace function public.prevent_completed_session_changes()
  returns trigger language plpgsql set search_path = ''
as $$
declare
  v_status public.advice_session_status;
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
-- angewendet auf: advice_session_topics, notes,
--                 advice_session_participants, email_summaries

-- e2: advice_sessions selbst. old.status statt Unterabfrage — billiger, und der
--     Abschluss-Update selbst kommt durch, weil old.status dort noch IN_PROGRESS ist.
create or replace function public.prevent_completed_session_self_changes()
  returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'COMPLETED' then
    raise exception 'Abgeschlossene Beratung % ist unveraenderlich', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_freeze_session before update on advice_sessions
  for each row execute function public.prevent_completed_session_self_changes();

-- (f) Veröffentlichte Vorlagenversionen sind unveränderlich
-- (g) Abschlussfunktion (Architektur 6.3) — atomar
create or replace function public.complete_advice_session(
  p_session_id uuid,
  p_document   jsonb
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_snapshot_id uuid;
  v_open int;
begin
  -- Mandantenprüfung
  perform 1 from public.advice_sessions
    where id = p_session_id
      and organization_id = public.auth_org_id()
      and status in ('DRAFT','IN_PROGRESS');
  if not found then
    raise exception 'Beratung nicht gefunden oder bereits abgeschlossen';
  end if;

  if not public.has_permission('advice:complete') then
    raise exception 'Keine Berechtigung zum Abschliessen';
  end if;

  -- Abschlussregel: kein Pflicht-Topic ohne Ergebnis (Architektur 10.2)
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
  select organization_id, id, p_document,
         encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex'), auth.uid()
    from public.advice_sessions where id = p_session_id
  returning id into v_snapshot_id;

  update public.advice_sessions
     set status = 'COMPLETED', completed_at = now(), updated_at = now()
   where id = p_session_id;

  return v_snapshot_id;
end;
$$;
```

Der Schreibschutz liegt bewusst in der Datenbank und nicht im Anwendungscode. Eine
Nachvollziehbarkeit, die sich durch einen vergessenen Codepfad aushebeln lässt, ist keine.

---

## 13. Indexe

```sql
-- Mandantenzugriff: jede Klasse-A-Tabelle bekommt einen Index auf organization_id,
-- weil jede Policy danach filtert. Per Generator erzeugt.
create index on customers            (organization_id) where deleted_at is null;
create index on advice_sessions      (organization_id, status);
create index on policies             (organization_id) where deleted_at is null;
create index on tasks                (organization_id, status);

-- Kundensuche im Gespräch
create index customers_display_name_trgm
  on customers using gin (display_name gin_trgm_ops);
create index customer_persons_name_trgm
  on customer_persons using gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- Beratungsmodus: Topics einer Session in Anzeigereihenfolge
create index on advice_session_topics (session_id, display_order);

-- Command-Pipeline
create index on advice_command_log (session_id, client_seq);

-- Dashboard (Konzeptpunkt 18)
create index tasks_open_by_due
  on tasks (organization_id, due_date) where status in ('OPEN','IN_PROGRESS');
create index policies_upcoming_cancellation
  on policies (organization_id, next_cancellation_date)
  where deleted_at is null and next_cancellation_date is not null;
create index advice_sessions_open
  on advice_sessions (organization_id, updated_at desc)
  where status in ('DRAFT','IN_PROGRESS') and deleted_at is null;

-- Beziehungen
create index on customer_persons (customer_id);
create index on policies         (customer_id, topic_id);
create index on documents        (customer_id);
create index on notes            (session_id);
create index on notes            (session_topic_id);
create index on audit_logs       (organization_id, occurred_at desc);
create index on audit_logs       (entity_table, entity_id);
```

Die partiellen Indexe für das Dashboard sind kein vorzeitiges Optimieren: Das Dashboard ist die
Startseite nach jedem Login und läuft bei jedem Aufruf.

---

## 14. RLS-Konzept

### 14.1 Grundschema je Tabellenklasse

**Klasse A — Mandantendaten.** Generiert für jede Tabelle mit `organization_id`:

```sql
alter table <t> enable row level security;
alter table <t> force row level security;

create policy <t>_select on <t> for select to authenticated
  using (organization_id = auth_org_id());

create policy <t>_insert on <t> for insert to authenticated
  with check (organization_id = auth_org_id() and has_permission('<entity>:write'));

create policy <t>_update on <t> for update to authenticated
  using (organization_id = auth_org_id() and has_permission('<entity>:write'))
  with check (organization_id = auth_org_id());

create policy <t>_delete on <t> for delete to authenticated
  using (organization_id = auth_org_id() and has_permission('<entity>:delete'));
```

Zusätzlich `alter table <t> alter column organization_id set default auth_org_id();` — damit die
Anwendung die Spalte gar nicht erst setzen muss und Regel R5 (Architektur 1) automatisch eingehalten
wird.

**Klasse B — globale Kataloge:** `for select to authenticated using (true)`, keine Schreibpolicy.
Änderungen laufen ausschliesslich über Migrationen.

**Klasse C — `profiles`:** `using (id = auth.uid())`, ohne Ausnahme.

### 14.2 Sonderfälle

| Tabelle | Abweichung | Grund |
|---|---|---|
| `organizations` | `using (id = auth_org_id())`, UPDATE nur `has_permission('organization:write')` | Eigene Struktur |
| `audit_logs` | kein UPDATE, kein DELETE für niemanden; SELECT nur OWNER/ADMIN; INSERT nur durch Trigger | Ein änderbares Audit-Log ist wertlos |
| `advice_session_snapshots` | kein UPDATE, kein DELETE | Unveränderlichkeit (Konzeptpunkt 29) |
| `signatures` | kein UPDATE, kein DELETE | dito |
| `advice_command_log` | kein UPDATE; DELETE nur `service_role` (Aufräumjob) | Idempotenz darf nicht manipulierbar sein |
| `invitations` | SELECT/INSERT nur `has_permission('member:write')` | Nur Admins laden ein |
| `advice_sessions` | zusätzlich `status <> 'COMPLETED'` im UPDATE-`using` | zweite Verteidigungslinie neben dem Trigger |

### 14.3 Storage

```sql
create policy "org isolated read" on storage.objects for select to authenticated
  using (
    bucket_id in ('documents','advice-exports','signatures','branding')
    and (storage.foldername(name))[1] = auth_org_id()::text
  );
-- analog für insert, update, delete
```

Pfadschema `{organization_id}/{customer_id}/{uuid}.{ext}` (Architektur 9.2).

### 14.4 Nachweis statt Vertrauen

Die beiden generischen Tests aus Architektur 8.4 sind Teil dieses Konzepts, nicht ein Anhängsel:

1. **Vollständigkeit:** Jede Tabelle in `public` hat RLS und FORCE RLS aktiv und mindestens eine
   Policy. Eine neue Tabelle ohne Policy bricht den Build.
2. **Isolation:** Zwei Nutzer in zwei Organisationen versuchen über **jede** Tabelle
   kreuzweise SELECT, UPDATE, DELETE und INSERT mit fremder `organization_id`. Erwartung: null
   Zeilen beziehungsweise Fehler.

---

## 15. Tabellenübersicht nach Phase

| Phase | Tabellen |
|---|---|
| 0 | `organizations` (minimal, für den Testharness) |
| 1 | `profiles`, `organization_members`, `invitations`, `audit_logs` |
| 2 | `customers`, `customer_persons`, `customer_addresses`, `consents` |
| 3 | `insurance_topics`, `organization_topic_settings`, `advice_templates`, `advice_template_versions`, `advice_template_topics`, `advice_sessions`, `advice_session_participants`, `advice_session_topics`, `advice_command_log`, `notes` |
| 4 | `insurers`, `policies`, `documents` |
| 5 | `tasks` |
| 6 | `advice_session_snapshots`, `signatures` |
| 7 | `email_summaries` |
| 8 | — (nur Lesezugriffe und Einstellungen) |
| nach MVP | `legal_parameters`, `pension_analyses`, `pension_analysis_items`, `webhook_endpoints`, Offertvergleich |

Insgesamt 24 Tabellen im MVP, 29 mit den vorbereiteten Erweiterungen.

---

## 16. Offene Punkte zum Schema

1. **Offertvergleich** (Konzeptpunkt 7) ist hier noch nicht modelliert, weil er nicht im MVP ist.
   Vorgesehene Richtung: `offers` (ein Vergleich je Sparte und Beratung), `offer_options` (die
   Spalten: aktuell, Angebot 1, Angebot 2) und `offer_rows` (frei definierbare Vergleichsparameter
   mit Label, Typ und Einheit). Das erfüllt die Forderung „nicht hardcoded" ohne Schema-Engine
   (Analyse 2.8).
2. **Aufbewahrung und Anonymisierung** (Analyse 1.10): Die Felder `deleted_at` und `anonymized_at`
   sind vorhanden, die Anonymisierungsfunktion ist bewusst noch nicht geschrieben — sie braucht
   zuerst eine juristisch geklärte Aufbewahrungsfrist (offener Punkt O-3).
3. **`advice_command_log`-Aufräumung:** Einträge älter als 90 Tage können gelöscht werden, sobald
   die zugehörige Beratung abgeschlossen ist. Ein einfacher Wartungsjob, noch nicht spezifiziert.

---

## 17. Validierung dieses Entwurfs

Das Schema wurde nicht nur entworfen, sondern gegen PostgreSQL 16 ausgeführt und fachlich getestet.

**Angelegt:** 30 Tabellen, 25 Enums, 66 Indexe — fehlerfrei.

**Getestete fachliche Regeln (alle bestanden):**

| Test | Erwartung | Ergebnis |
|---|---|---|
| `outcome` ohne `progress_status = DISCUSSED` | abgelehnt | `outcome_requires_discussed` |
| `DISCUSSED` ohne `discussed_at` | abgelehnt | `discussed_requires_timestamp` |
| Gültiger Statusübergang | akzeptiert | ok |
| Zweite PRIMARY-Person je Kunde | abgelehnt | `customer_persons_one_primary` |
| Notiz mit zwei Bezügen | abgelehnt | `notes_exactly_one_owner` |
| Notiz ohne Bezug | abgelehnt | `notes_exactly_one_owner` |
| Berater-Aufgabe ohne Zuständigen | abgelehnt | CHECK |
| Police ohne Versicherer | abgelehnt | CHECK |
| Command zweimal mit gleicher ID | genau eine Zeile | Idempotenz bestätigt |
| Abschluss mit offenem Pflichtbereich | abgelehnt | „Es sind noch 1 Pflichtbereiche offen" |
| Backoffice schliesst Beratung ab | abgelehnt | „Keine Berechtigung" |
| Advisor schliesst ab | Snapshot mit Hash | ok |
| Topic einer abgeschlossenen Beratung ändern | abgelehnt | Freeze-Trigger |
| Abgeschlossene Beratung selbst ändern | abgelehnt | Freeze-Trigger |
| Fremder Mandant schliesst ab | abgelehnt | Mandantenprüfung |

**Drei Fehler, die der Test gefunden hat und die bereits korrigiert sind:**

1. **`digest()` war nicht auflösbar.** Die Funktion läuft mit `set search_path = ''`; `digest` aus
   `pgcrypto` liegt bei Supabase im Schema `extensions` und wäre unqualifiziert gescheitert.
   Korrigiert auf das eingebaute `sha256()` aus `pg_catalog`, das auch bei leerem `search_path`
   auflösbar ist. Nebeneffekt: `pgcrypto` wird gar nicht mehr gebraucht — eine Abhängigkeit weniger.

2. **Der Freeze-Trigger war für `advice_sessions` selbst defekt.** Eine gemeinsame Funktion für
   Eltern- und Kindtabellen scheiterte mit `record "new" has no field "session_id"`. `coalesce`
   schützt davor nicht, weil plpgsql den Feldzugriff unabhängig vom Ergebnis auflöst. Korrigiert
   durch zwei getrennte Funktionen; die Variante für `advice_sessions` nutzt zusätzlich `old.status`
   statt einer Unterabfrage.

3. **Eine naheliegende Folgefalle**, die durch Fix 2 mit erledigt ist: Ein Trigger, der den Status
   per `SELECT` aus der Tabelle liest, hätte den Abschluss-Update selbst blockieren können. Mit
   `old.status` ist das ausgeschlossen — beim abschliessenden `UPDATE` steht dort noch
   `IN_PROGRESS`.

Das ist der Grund, DDL vor der Umsetzung einmal laufen zu lassen: Alle drei Fehler hätten in
Phase 6 unter Zeitdruck gefunden werden müssen, und Fehler 2 wäre erst beim ersten Korrekturversuch
an einer abgeschlossenen Beratung aufgefallen — also genau dann, wenn die Nachvollziehbarkeit
gebraucht wird.


---

## 18. Migrationskonvention

Jede Migration, die Mandantentabellen anlegt oder verändert, endet mit:

```sql
select public.apply_tenant_rls();
select public.assert_rls_complete();
```

`assert_rls_complete()` wirft, wenn eine der vier Zusicherungen verletzt ist:

1. eine Tabelle ohne `ROW LEVEL SECURITY` **und** `FORCE ROW LEVEL SECURITY`
2. eine Tabelle mit RLS, aber ohne jede Policy — sie wäre sonst für alle gesperrt, und das fällt
   erst im Betrieb auf
3. eine nullable `organization_id` — eine solche Zeile gehörte zu niemandem
4. eine Update- oder Delete-Policy auf einer anfügenden Tabelle — genau das, was der Generator dem
   Audit-Log stillschweigend gegeben hatte

Die Prüfung läuft damit **in der Migration**, nicht als Schritt daneben. Das hat zwei Vorteile: Der
Migrationsworkflow braucht keine Datenbank-URL als Zugangsdatum, und die Absicherung lässt sich
nicht übergehen, indem jemand eine Migration von Hand einspielt.

Nachgewiesen: Drei absichtlich eingebaute Verstösse (Mandantentabelle ohne Policy, nullable
`organization_id`, Schreibpolicy auf `audit_logs`) werden alle erkannt und brechen die Migration ab.
