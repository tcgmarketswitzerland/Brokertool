-- Phase 2 - Kunden (ADR-003)
--
-- customers ist die Klammer: ein Mandant, also ein Haushalt, ein Paar, eine
-- Familie oder spaeter ein Unternehmen. Die natuerlichen Personen liegen
-- darunter. Vertraege und Vorsorgeanalysen verweisen spaeter optional auf
-- eine Person; ohne Personenbezug gelten sie fuer den ganzen Haushalt.
--
-- Hausrat gehoert dem Haushalt, Saeule 3a einer einzelnen Person. Ohne diese
-- Trennung waere beides dasselbe - und die spaetere Migration betraefe
-- Vertraege, Vorsorgeanalysen und abgeschlossene Protokolle zugleich.

create type customer_type   as enum ('PRIVATE','COUPLE','FAMILY','COMPANY');
create type person_role     as enum ('PRIMARY','PARTNER','CHILD','OTHER');
create type sex             as enum ('FEMALE','MALE','UNSPECIFIED');
create type marital_status  as enum ('SINGLE','MARRIED','REGISTERED_PARTNERSHIP',
                                     'DIVORCED','WIDOWED','SEPARATED');
create type employment_type as enum ('EMPLOYED','SELF_EMPLOYED','UNEMPLOYED',
                                     'RETIRED','STUDENT','HOMEMAKER','OTHER');
create type address_kind    as enum ('HOME','BILLING','WORK');
create type consent_type    as enum ('DATA_PROCESSING','MARKETING','DOCUMENT_SHARING');

create table customers (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations(id) on delete cascade,
  customer_type           customer_type not null default 'PRIVATE',
  -- Per Trigger aus den Personen gebildet. Ohne dieses Feld braeuchte jede
  -- Kundenliste einen Join samt Aggregation ueber customer_persons - bei
  -- einer Suchliste im Gespraech spuerbar.
  --
  -- Die Vorgabe ist bewusst ein lesbarer Platzhalter und kein Leerstring:
  -- ein Kunde ohne Person loest den Personen-Trigger nie aus und bliebe
  -- sonst als namenlose Zeile in der Liste stehen.
  display_name            text not null default 'Ohne Namen',
  correspondence_language text not null default 'de'
                            check (correspondence_language in ('de','fr','it','en')),
  primary_advisor_id      uuid references organization_members(id) on delete set null,
  external_ref            text,                 -- Kennung im CRM des Brokers
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references profiles(id) on delete set null,
  updated_by              uuid references profiles(id) on delete set null,
  -- Kein physisches Loeschen: Loeschrecht und Aufbewahrungspflicht stehen im
  -- Konflikt (Analyse 1.10). Die Anonymisierungsfunktion folgt, sobald die
  -- Aufbewahrungsfrist juristisch geklaert ist.
  deleted_at              timestamptz,
  anonymized_at           timestamptz
);

create table customer_persons (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  person_role         person_role not null default 'PRIMARY',
  first_name          text not null check (length(btrim(first_name)) between 1 and 100),
  last_name           text not null check (length(btrim(last_name)) between 1 and 100),
  date_of_birth       date check (date_of_birth > '1900-01-01' and date_of_birth <= current_date),
  -- Fuer die spaetere Vorsorgeberechnung fachlich noetig (Referenzalter,
  -- Rentenhoehen), nicht als demografisches Merkmal. Vorgabe UNSPECIFIED,
  -- damit die Schnellanlage nicht danach fragen muss.
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

create index customer_persons_customer_idx on customer_persons (customer_id);

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

create index customer_addresses_customer_idx on customer_addresses (customer_id);

create table consents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  consent_type    consent_type not null,
  granted         boolean not null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  source          text,
  created_at      timestamptz not null default now()
);

create index consents_customer_idx on consents (customer_id);

-- Anzeigename aus den Personen bilden: "Max Muster", "Max und Anna Muster",
-- "Familie Muster". Gleiche Nachnamen werden zusammengefasst, weil sonst
-- jede Kundenliste doppelt so breit wird wie noetig.
create or replace function public.refresh_customer_display_name(p_customer uuid)
  returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_type    public.customer_type;
  v_names   text;
  v_surname text;
  v_count   int;
begin
  select c.customer_type into v_type from public.customers c where c.id = p_customer;
  if not found then return; end if;

  select count(*) into v_count
    from public.customer_persons p
   where p.customer_id = p_customer and p.deleted_at is null
     and p.person_role in ('PRIMARY','PARTNER');

  if v_count = 0 then
    update public.customers set display_name = 'Ohne Namen' where id = p_customer;
    return;
  end if;

  -- Ein gemeinsamer Nachname? Dann nur einmal nennen.
  select case when count(distinct p.last_name) = 1 then min(p.last_name) end
    into v_surname
    from public.customer_persons p
   where p.customer_id = p_customer and p.deleted_at is null
     and p.person_role in ('PRIMARY','PARTNER');

  if v_type = 'FAMILY' and v_surname is not null then
    update public.customers set display_name = 'Familie ' || v_surname where id = p_customer;
    return;
  end if;

  if v_surname is not null then
    select string_agg(p.first_name, ' und ' order by p.person_role, p.first_name)
      into v_names
      from public.customer_persons p
     where p.customer_id = p_customer and p.deleted_at is null
       and p.person_role in ('PRIMARY','PARTNER');
    update public.customers set display_name = v_names || ' ' || v_surname where id = p_customer;
  else
    select string_agg(p.first_name || ' ' || p.last_name, ' und ' order by p.person_role, p.first_name)
      into v_names
      from public.customer_persons p
     where p.customer_id = p_customer and p.deleted_at is null
       and p.person_role in ('PRIMARY','PARTNER');
    update public.customers set display_name = v_names where id = p_customer;
  end if;
end;
$$;

create or replace function public.trg_refresh_display_name() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.refresh_customer_display_name(coalesce(new.customer_id, old.customer_id));
  return null;
end;
$$;

create trigger trg_persons_display_name
  after insert or update or delete on customer_persons
  for each row execute function public.trg_refresh_display_name();

create trigger trg_customers_touch before update on customers
  for each row execute function public.touch_updated_at();
create trigger trg_persons_touch before update on customer_persons
  for each row execute function public.touch_updated_at();
create trigger trg_addresses_touch before update on customer_addresses
  for each row execute function public.touch_updated_at();

create trigger trg_audit_customers
  after insert or update or delete on customers
  for each row execute function public.audit_trigger();
create trigger trg_audit_persons
  after insert or update or delete on customer_persons
  for each row execute function public.audit_trigger();

-- Suche im Gespraech: Namensteile, nicht nur Praefixe.
create index customers_display_name_trgm
  on customers using gin (display_name gin_trgm_ops);
create index customer_persons_name_trgm
  on customer_persons using gin ((first_name || ' ' || last_name) gin_trgm_ops);

create index customers_active_idx
  on customers (organization_id, display_name) where deleted_at is null;

select public.apply_tenant_rls();
select public.assert_rls_complete();
