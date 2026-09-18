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
