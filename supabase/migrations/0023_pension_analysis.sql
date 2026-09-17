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
