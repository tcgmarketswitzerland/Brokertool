-- Phase 5 - Aufgaben fuer Kunde und Berater (Konzeptpunkt 11)

create type task_owner_type as enum ('CUSTOMER','ADVISOR');
create type task_status     as enum ('OPEN','IN_PROGRESS','DONE','CANCELLED');
create type task_priority   as enum ('LOW','NORMAL','HIGH');

create table tasks (
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

create index tasks_open_by_due
  on tasks (organization_id, due_date) where status in ('OPEN','IN_PROGRESS');
create index tasks_session_idx on tasks (session_id);
create index tasks_customer_idx on tasks (customer_id);

create trigger trg_tasks_touch before update on tasks
  for each row execute function public.touch_updated_at();

create trigger trg_audit_tasks
  after insert or update or delete on tasks
  for each row execute function public.audit_trigger();

select public.apply_tenant_rls();
select public.assert_rls_complete();
