-- Absicherung als Teil der Migration statt als Schritt daneben
--
-- Bisher liefen der Policy-Generator und die RLS-Pruefung als eigene
-- psql-Schritte im CI-Workflow. Das hatte zwei Nachteile: es brauchte eine
-- Datenbank-URL als Secret, und die Absicherung haette sich uebergehen
-- lassen, indem jemand die Migration von Hand einspielt.
--
-- Beides laeuft jetzt in der Migration. Eine Migration, die eine
-- Mandantentabelle anlegt und sie nicht absichert, schlaegt damit fehl -
-- in jeder Umgebung, ohne Zutun.

create or replace function public.assert_rls_complete() returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  v_offenders text;
begin
  -- (1) Jede Tabelle braucht RLS und FORCE RLS. Ohne FORCE umgeht der
  --     Tabelleneigentuemer saemtliche Policies.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (not c.relrowsecurity or not c.relforcerowsecurity);

  if v_offenders is not null then
    raise exception 'Tabellen ohne vollstaendiges RLS: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (2) Jede Tabelle mit RLS braucht mindestens eine Policy, sonst ist sie
  --     fuer alle gesperrt - das faellt sonst erst im Betrieb auf.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if v_offenders is not null then
    raise exception 'Tabellen ohne Policy: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (3) organization_id darf nie nullable sein - eine solche Zeile gehoerte
  --     zu niemandem und waere ein Loch in der Mandantentrennung.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
   where n.nspname = 'public' and c.relkind = 'r'
     and a.attname = 'organization_id' and not a.attnotnull and not a.attisdropped;

  if v_offenders is not null then
    raise exception 'Tabellen mit nullable organization_id: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (4) Anfuegende Tabellen duerfen keine Update- oder Delete-Policy haben.
  --     Genau das hatte der Generator dem Audit-Log stillschweigend gegeben.
  select string_agg(format('%s.%s', c.relname, p.polname), ', ') into v_offenders
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (public.rls_manual_tables())
     and p.polcmd in ('w', 'd', '*');

  if v_offenders is not null then
    raise exception 'Anfuegende Tabellen mit Schreibpolicy: %', v_offenders
      using errcode = 'check_violation';
  end if;
end;
$$;

comment on function public.assert_rls_complete() is
  'Wirft, wenn die Mandantentrennung Luecken hat. Am Ende jeder Migration aufrufen.';

-- Ab hier gilt fuer jede weitere Migration die Konvention:
--   select public.apply_tenant_rls();
--   select public.assert_rls_complete();
-- als letzte beiden Zeilen.
select public.apply_tenant_rls();
select public.assert_rls_complete();
