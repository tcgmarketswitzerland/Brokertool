-- Phase 0 - Policy-Generator (Architektur 8.3)
--
-- 20 handgeschriebene Policy-Saetze waeren 20 Gelegenheiten fuer einen
-- Tippfehler mit Datenleck-Folge. Der Generator erkennt Mandantentabellen
-- allein am Vorhandensein der Spalte organization_id - deshalb die Regel,
-- dass diese Spalte nie nullable ist (Datenbankstruktur 1.2).

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

    -- Jede Policy filtert nach organization_id, also braucht jede Tabelle
    -- den passenden Index.
    execute format('create index if not exists %I on public.%I (organization_id)',
                   r.tbl || '_org_idx', r.tbl);
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function public.apply_tenant_rls(text) is
  'Erzeugt das Standard-Policy-Set fuer alle Tabellen mit organization_id. Nach jeder Migration erneut ausfuehren.';
