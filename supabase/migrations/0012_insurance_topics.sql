-- Phase 3 - Spartenkatalog und Beratungsvorlagen (Architektur 2.10)
--
-- Drei Ebenen statt einer (Analyse 2.9):
--   insurance_topics            globaler Katalog, per Migration gepflegt
--   organization_topic_settings Ueberlagerung je Firma (aktiv, Reihenfolge, Name)
--   advice_template_*           die versionierte Vorlage, aus der eine
--                               Beratung instanziiert wird
--
-- Die Vorlage ist die Klammer, die Konfigurierbarkeit, Nachvollziehbarkeit
-- und spaetere Firmenkunden gemeinsam loest: Eine Beratung zeigt auf eine
-- unveraenderliche Vorlagenversion. Aendert die Firma morgen ihre Vorlage,
-- bleibt die gestrige Beratung exakt so bewertbar, wie sie gefuehrt wurde.

create type topic_category as enum (
  'PROPERTY','LIABILITY','VEHICLE','LEGAL','TRAVEL','HEALTH','ACCIDENT',
  'PENSION','LIFE','FINANCE','PET','CYBER','BUSINESS'
);

create type template_status as enum ('DRAFT','PUBLISHED','ARCHIVED');

-- Klasse B: globaler Katalog ohne organization_id (Datenbankstruktur 1.2)
create table insurance_topics (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  name                      jsonb not null,          -- { de, fr, it }
  description               jsonb not null default '{}'::jsonb,
  category                  topic_category not null,
  icon                      text,
  display_order             int not null default 0,
  applicable_customer_types customer_type[] not null
                              default '{PRIVATE,COUPLE,FAMILY}'::customer_type[],
  field_schema_key          text not null,           -- Schluessel des Zod-Schemas im Code
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (name ? 'de')                                -- Deutsch ist Pflicht (ADR-004)
);

alter table insurance_topics enable row level security;
alter table insurance_topics force  row level security;

-- Lesen fuer alle Angemeldeten, Schreiben nur ueber Migrationen.
create policy insurance_topics_read on insurance_topics
  for select to authenticated using (true);

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

create table advice_templates (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key            text not null,
  name           jsonb not null,
  customer_types customer_type[] not null default '{PRIVATE,COUPLE,FAMILY}'::customer_type[],
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references profiles(id) on delete set null,
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
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  template_version_id  uuid not null references advice_template_versions(id) on delete cascade,
  topic_id             uuid not null references insurance_topics(id) on delete restrict,
  display_order        int  not null default 0,
  -- Das fachlich wichtigste Feld des Vorlagensystems: es entscheidet, welche
  -- Sparten fuer den Abschluss zwingend ein Ergebnis brauchen. Damit wird
  -- "kein Bereich wird vergessen" je Firma konfigurierbar statt im Code
  -- festgeschrieben.
  is_required          boolean not null default false,
  field_schema_version int  not null default 1,
  unique (template_version_id, topic_id)
);

-- Eine veroeffentlichte Vorlagenversion ist unveraenderlich. Ohne diesen
-- Schutz wuerde eine nachtraegliche Aenderung rueckwirkend die Bewertung
-- bereits gefuehrter Beratungen verschieben.
create or replace function public.prevent_published_template_changes() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if old.status = 'PUBLISHED' and new.status <> 'ARCHIVED' then
    raise exception 'Veroeffentlichte Vorlagenversion ist unveraenderlich'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_freeze_template_version before update on advice_template_versions
  for each row execute function public.prevent_published_template_changes();

create or replace function public.prevent_published_template_topic_changes() returns trigger
  language plpgsql set search_path = ''
as $$
declare v_status public.template_status;
begin
  select v.status into v_status from public.advice_template_versions v
   where v.id = coalesce(new.template_version_id, old.template_version_id);
  if v_status = 'PUBLISHED' then
    raise exception 'Vorlagenversion ist veroeffentlicht und unveraenderlich'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_freeze_template_topics
  before insert or update or delete on advice_template_topics
  for each row execute function public.prevent_published_template_topic_changes();

create trigger trg_topics_touch before update on insurance_topics
  for each row execute function public.touch_updated_at();
create trigger trg_org_topic_settings_touch before update on organization_topic_settings
  for each row execute function public.touch_updated_at();
create trigger trg_templates_touch before update on advice_templates
  for each row execute function public.touch_updated_at();

create index advice_template_topics_version_idx
  on advice_template_topics (template_version_id, display_order);

select public.apply_tenant_rls();
select public.assert_rls_complete();
