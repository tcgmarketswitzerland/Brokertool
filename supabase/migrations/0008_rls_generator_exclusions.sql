-- Korrektur zu 0004: Tabellen mit eigenem Policy-Satz ausnehmen
--
-- Gefunden durch den Test "Audit-Log ist fuer niemanden aenderbar oder
-- loeschbar": Der Generator erkennt Mandantentabellen an der Spalte
-- organization_id und hat deshalb auch audit_logs erfasst - inklusive
-- Update- und Delete-Policy. Postgres verknuepft mehrere permissive Policies
-- mit ODER, die handgeschriebene Beschraenkung aus 0006 war damit wirkungslos
-- und ein Owner haette das Audit-Log umschreiben koennen.
--
-- Anfuegende Tabellen (append-only) brauchen einen eigenen, engeren
-- Policy-Satz. Sie stehen deshalb auf einer Ausschlussliste, die der
-- Generator respektiert.

create or replace function public.rls_manual_tables() returns text[]
  language sql immutable
as $$
  select array[
    'audit_logs',                 -- nur einfuegen (durch Trigger) und lesen
    'advice_session_snapshots',   -- unveraenderlich (Konzeptpunkt 29)
    'signatures',                 -- unveraenderlich
    'advice_command_log'          -- Idempotenz darf nicht manipulierbar sein
  ]::text[];
$$;

comment on function public.rls_manual_tables() is
  'Tabellen mit handgeschriebenem Policy-Satz. apply_tenant_rls() laesst sie unberuehrt.';

create or replace function public.apply_tenant_rls(p_table text default null)
  returns int language plpgsql security definer set search_path = ''
as $$
declare
  r record;
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
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('alter table public.%I force  row level security', r.tbl);
    execute format('alter table public.%I alter column organization_id set default public.auth_org_id()', r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
    execute format($p$create policy %I on public.%I for select to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_read(%L))$p$, r.tbl || '_select', r.tbl, r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
    execute format($p$create policy %I on public.%I for insert to authenticated
                     with check (organization_id = public.auth_org_id()
                                 and public.can_write(%L))$p$, r.tbl || '_insert', r.tbl, r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
    execute format($p$create policy %I on public.%I for update to authenticated
                     using (organization_id = public.auth_org_id() and public.can_write(%L))
                     with check (organization_id = public.auth_org_id())$p$,
                   r.tbl || '_update', r.tbl, r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);
    execute format($p$create policy %I on public.%I for delete to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_delete(%L))$p$, r.tbl || '_delete', r.tbl, r.tbl);

    execute format('create index if not exists %I on public.%I (organization_id)',
                   r.tbl || '_org_idx', r.tbl);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Bereits erzeugte Policies auf den Ausnahmetabellen wieder entfernen.
do $$
declare t text; p text;
begin
  foreach t in array public.rls_manual_tables() loop
    if to_regclass('public.' || quote_ident(t)) is null then
      continue;
    end if;
    for p in
      select pol.polname from pg_policy pol
       where pol.polrelid = ('public.' || quote_ident(t))::regclass
         and pol.polname in (t || '_select', t || '_insert', t || '_update', t || '_delete')
    loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- audit_logs braucht seine Lesepolicy zurueck, falls sie mit abgeraeumt wurde.
drop policy if exists audit_logs_read on audit_logs;
create policy audit_logs_read on audit_logs for select to authenticated
  using (organization_id = public.auth_org_id()
         and public.auth_org_role() in ('OWNER','ADMIN'));
