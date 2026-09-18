-- Phase 8 - Berateransicht: jeder sieht seine eigenen Kunden
--
-- Bisher galt: wer zur Firma gehoert, sieht alles, was der Firma gehoert.
-- Das ist fuer ein Einzelbuero richtig und fuer ein Maklerbuero mit
-- mehreren Beratern falsch. Ab hier gilt:
--
--   Berater      sehen ihre eigenen Kunden und Beratungen.
--   Firmenleitung (OWNER, ADMIN) sieht alles, samt zustaendigem Berater.
--   Backoffice   sieht alles - es pflegt genau die Faelle nach, die es
--                nicht selbst gefuehrt hat.
--
-- Umgesetzt im Policy-Generator und nicht in 20 handgeschriebenen
-- Policies: die Regel muss fuer jede Tabelle gelten, die an einem Kunden
-- oder an einer Beratung haengt, auch fuer die, die es noch nicht gibt.
-- assert_rls_complete() prueft ab hier zusaetzlich, dass keine
-- Mandantentabelle durch dieses Raster faellt.

-- ---------------------------------------------------------------------
-- 1. Neue Stammdaten
-- ---------------------------------------------------------------------

-- Die FINMA-Registernummer steht im Beratungsprotokoll und auf jedem
-- Dokument, das die Firma herausgibt. Format bewusst ungeprueft: die
-- Registernummer ist keine Zahl mit fester Laenge.
alter table organizations
  add column if not exists finma_number text;

alter table organization_members
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists job_title    text,
  add column if not exists finma_number text;

-- Dieselben Angaben schon in der Einladung: der Adminaccount erfasst den
-- Berater, nicht der Berater sich selbst. Beim Einloesen wandern sie in
-- die Mitgliedschaft.
alter table invitations
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists job_title    text,
  add column if not exists finma_number text;

-- ---------------------------------------------------------------------
-- 2. Sichtbarkeit
-- ---------------------------------------------------------------------

-- member_id steht seit 0010 im JWT. Ein Unterselect auf
-- organization_members waere hier nicht nur langsamer, sondern brauchte
-- eine Lesepolicy auf einer Tabelle, die selbst in Policies vorkommt.
create or replace function public.auth_member_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'member_id', ''
  )::uuid;
$$;

/**
 * Wer sieht die Kunden der ganzen Firma?
 *
 * Backoffice ist hier absichtlich dabei: seine Aufgabe ist das Nachpflegen
 * fremder Faelle. Ein Backoffice, das nur die eigenen Kunden saehe, saehe
 * keine.
 */
create or replace function public.sees_all_customers() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.auth_org_role() in ('OWNER','ADMIN','BACKOFFICE');
$$;

create or replace function public.can_see_customer(p_customer uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  -- NULL bedeutet "haengt an keinem Kunden" und darf nicht sperren: die
  -- Mandantenpruefung steht daneben und greift weiterhin.
  select p_customer is null
      or public.sees_all_customers()
      or exists (select 1 from public.customers c
                  where c.id = p_customer
                    and c.primary_advisor_id = public.auth_member_id());
$$;

/**
 * Eine Beratung sieht, wer sie gefuehrt hat - oder wem der Kunde gehoert.
 *
 * Die zweite Haelfte ist keine Grosszuegigkeit, sondern die Voraussetzung
 * dafuer, dass ein Berater die Geschichte seines eigenen Kunden lesen
 * kann, auch wenn ein Kollege einmal eingesprungen ist.
 */
create or replace function public.can_see_session(p_session uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_session is null
      or public.sees_all_customers()
      or exists (select 1 from public.advice_sessions s
                  where s.id = p_session
                    and (s.advisor_member_id = public.auth_member_id()
                         or public.can_see_customer(s.customer_id)));
$$;

create or replace function public.can_see_policy(p_policy uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_policy is null
      or public.sees_all_customers()
      or exists (select 1 from public.policies p
                  where p.id = p_policy
                    and public.can_see_customer(p.customer_id));
$$;

comment on function public.can_see_customer(uuid) is
  'Sichtbarkeit eines Kunden fuer das angemeldete Mitglied. security definer, damit der Aufruf aus der Policy auf customers nicht rekursiv wird.';

-- ---------------------------------------------------------------------
-- 3. Zustaendigkeit
-- ---------------------------------------------------------------------

-- Ohne Vorgabewert verloere ein Berater den Kunden aus den Augen, den er
-- gerade angelegt hat. Dieselbe Mechanik wie bei organization_id.
alter table customers
  alter column primary_advisor_id set default public.auth_member_id();

-- Bestehende Kunden dem Mitglied zuordnen, das sie angelegt hat. Ohne
-- diesen Schritt saehe sie nach der Migration nur noch die Firmenleitung.
update customers c
   set primary_advisor_id = m.id
  from organization_members m
 where c.primary_advisor_id is null
   and m.user_id = c.created_by
   and m.organization_id = c.organization_id;

create index if not exists customers_advisor_idx
  on customers (organization_id, primary_advisor_id) where deleted_at is null;
create index if not exists advice_sessions_advisor_idx
  on advice_sessions (organization_id, advisor_member_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 4. Der Generator kennt die Sichtbarkeit
-- ---------------------------------------------------------------------

/**
 * Tabellen, die absichtlich der ganzen Firma gehoeren.
 *
 * Vorlagen, Mitgliedschaften, Einladungen, Spartenauswahl: daran haengt
 * kein Kunde. Die Liste ist der Gegenpol zur Pruefung weiter unten - wer
 * eine neue Mandantentabelle anlegt, muss sich entscheiden, ob sie an
 * einen Kunden haengt oder hierher gehoert. Ein Vergessen faellt in der
 * Migration auf, nicht im Betrieb.
 *
 * Als Tabelle und nicht als Funktion mit fester Liste: eine spaetere
 * Migration traegt einen Namen nach, indem sie eine Zeile einfuegt. Stuende
 * die Liste im Funktionskoerper, muesste jede spaetere Migration sie
 * vollstaendig wiederholen - und ein erneutes Einspielen dieser hier
 * wuerde die Nachtraege stillschweigend loeschen. Genau das ist beim
 * Zusammenfuehren der Migrationen zu einem Buendel passiert.
 */
create table if not exists rls_org_wide_registry (
  table_name text primary key
);

alter table rls_org_wide_registry enable row level security;
alter table rls_org_wide_registry force  row level security;

drop policy if exists rls_org_wide_registry_read on rls_org_wide_registry;
create policy rls_org_wide_registry_read on rls_org_wide_registry
  for select to authenticated using (true);

insert into rls_org_wide_registry (table_name) values
  ('organization_members'),
  ('invitations'),
  ('advice_templates'),
  ('advice_template_versions'),
  ('advice_template_topics'),
  ('organization_topic_settings'),
  ('audit_logs')
on conflict (table_name) do nothing;

-- security definer, weil die Funktion aus Policies heraus aufgerufen wird
-- und die Registratur selbst RLS traegt.
create or replace function public.rls_org_wide_tables() returns text[]
  language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(r.table_name), '{}')::text[]
    from public.rls_org_wide_registry r;
$$;

/** Die Sichtbarkeitsbedingung einer Tabelle, als SQL-Text. */
create or replace function public.rls_visibility_clause(p_table text) returns text
  language plpgsql stable set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_rel   oid := to_regclass('public.' || quote_ident(p_table));
begin
  -- to_regclass statt eines Casts: der Planer darf diese Funktion auch auf
  -- Zeilen anwenden, die den Schemafilter des Aufrufers noch nicht
  -- passiert haben. Ein Cast wuerfe dort, und die Migration braeche an
  -- einer Tabelle, die sie gar nicht meint.
  if v_rel is null then
    return '';
  end if;

  if p_table = 'customers' then
    return 'and (public.sees_all_customers() '
        || 'or primary_advisor_id = public.auth_member_id())';
  end if;

  if p_table = 'advice_sessions' then
    return 'and (public.sees_all_customers() '
        || 'or advisor_member_id = public.auth_member_id() '
        || 'or public.can_see_customer(customer_id))';
  end if;

  if p_table = any (public.rls_org_wide_tables()) then
    return '';
  end if;

  -- Alles andere haengt ueber eine dieser drei Spalten an einem Kunden.
  -- Mehrere zugleich sind kein Widerspruch, sondern eine Verschaerfung:
  -- ein Dokument mit Kunde UND Beratung muss bei beiden sichtbar sein.
  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'customer_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_customer(customer_id)');
  end if;

  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'session_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_session(session_id)');
  end if;

  if exists (select 1 from pg_attribute a
              where a.attrelid = v_rel
                and a.attname = 'policy_id' and a.attnum > 0 and not a.attisdropped) then
    v_parts := array_append(v_parts, 'public.can_see_policy(policy_id)');
  end if;

  if cardinality(v_parts) = 0 then
    return null;   -- weder Kundenbezug noch bewusst firmenweit
  end if;

  return 'and ' || array_to_string(v_parts, ' and ');
end;
$$;

create or replace function public.apply_tenant_rls(p_table text default null)
  returns int language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_see text;
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
    v_see := coalesce(public.rls_visibility_clause(r.tbl), '');

    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('alter table public.%I force  row level security', r.tbl);
    execute format('alter table public.%I alter column organization_id set default public.auth_org_id()', r.tbl);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
    execute format($p$create policy %I on public.%I for select to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_read(%L) %s)$p$,
                   r.tbl || '_select', r.tbl, r.tbl, v_see);

    -- Auch beim Schreiben: sonst legte ein Berater eine Notiz an einem
    -- fremden Kunden an, die er anschliessend selbst nicht mehr saehe.
    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
    execute format($p$create policy %I on public.%I for insert to authenticated
                     with check (organization_id = public.auth_org_id()
                                 and public.can_write(%L) %s)$p$,
                   r.tbl || '_insert', r.tbl, r.tbl, v_see);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
    execute format($p$create policy %I on public.%I for update to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_write(%L) %s)
                     with check (organization_id = public.auth_org_id() %s)$p$,
                   r.tbl || '_update', r.tbl, r.tbl, v_see, v_see);

    execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);
    execute format($p$create policy %I on public.%I for delete to authenticated
                     using (organization_id = public.auth_org_id()
                            and public.can_delete(%L) %s)$p$,
                   r.tbl || '_delete', r.tbl, r.tbl, v_see);

    execute format('create index if not exists %I on public.%I (organization_id)',
                   r.tbl || '_org_idx', r.tbl);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Die vier Tabellen mit eigenem Policy-Satz haengen alle an einer Beratung
-- und brauchen dieselbe Einschraenkung - audit_logs ausgenommen, das
-- ohnehin nur die Firmenleitung liest.
drop policy if exists snapshots_select on advice_session_snapshots;
create policy snapshots_select on advice_session_snapshots for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists snapshots_insert on advice_session_snapshots;
create policy snapshots_insert on advice_session_snapshots for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:complete')
              and public.can_see_session(session_id));

drop policy if exists signatures_select on signatures;
create policy signatures_select on signatures for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists signatures_insert on signatures;
create policy signatures_insert on signatures for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.has_permission('advice:sign')
              and public.can_see_session(session_id));

drop policy if exists advice_command_log_select on advice_command_log;
create policy advice_command_log_select on advice_command_log for select to authenticated
  using (organization_id = public.auth_org_id() and public.can_see_session(session_id));

drop policy if exists advice_command_log_insert on advice_command_log;
create policy advice_command_log_insert on advice_command_log for insert to authenticated
  with check (organization_id = public.auth_org_id()
              and public.can_write('advice_sessions')
              and public.can_see_session(session_id));

-- ---------------------------------------------------------------------
-- 5. Die Selbstpruefung kennt die Sichtbarkeit mit
-- ---------------------------------------------------------------------

create or replace function public.assert_rls_complete() returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  v_offenders text;
begin
  -- (1) Jede Tabelle braucht RLS und FORCE RLS.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (not c.relrowsecurity or not c.relforcerowsecurity);

  if v_offenders is not null then
    raise exception 'Tabellen ohne vollstaendiges RLS: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (2) Jede Tabelle mit RLS braucht mindestens eine Policy.
  select string_agg(c.relname, ', ' order by c.relname) into v_offenders
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if v_offenders is not null then
    raise exception 'Tabellen ohne Policy: %', v_offenders
      using errcode = 'check_violation';
  end if;

  -- (3) organization_id darf nie nullable sein.
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

  -- (5) Neu ab 0026: jede Mandantentabelle muss entweder an einem Kunden
  --     haengen oder ausdruecklich firmenweit sein. Eine Tabelle mit
  --     Kundendaten, die durch beide Raster faellt, waere fuer jeden
  --     Berater der Firma sichtbar - und niemandem faellt es auf.
  --     Das "offset 0" haelt den Planer davon ab, den Funktionsaufruf vor
  --     den Schemafilter zu ziehen.
  select string_agg(t.relname, ', ' order by t.relname) into v_offenders
    from (select c.relname
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and exists (select 1 from pg_attribute a
                          where a.attrelid = c.oid and a.attname = 'organization_id'
                            and a.attnum > 0 and not a.attisdropped)
           offset 0) t
   where public.rls_visibility_clause(t.relname) is null;

  if v_offenders is not null then
    raise exception 'Mandantentabellen ohne Kundenbezug und ohne Eintrag in rls_org_wide_tables(): %',
      v_offenders using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Berater erfassen und Firma eroeffnen
-- ---------------------------------------------------------------------

/**
 * Firma eroeffnen.
 *
 * Die Zusatzangaben sind optional in der Signatur und Pflicht im
 * Formular: bestehende Aufrufe - Tests, aeltere Clients - sollen nicht
 * brechen, aber eine neue Firma wird ueber die Oberflaeche vollstaendig
 * erfasst.
 */
-- Eine zusaetzliche Signatur ist eine Ueberladung, keine Ersetzung: ohne
-- dieses drop stuenden zwei Funktionen nebeneinander und jeder Aufruf mit
-- einem Argument waere mehrdeutig.
drop function if exists public.create_organization(text, text);

create or replace function public.create_organization(
  p_name         text,
  p_display_name text default null,
  p_email        text default null,
  p_phone        text default null,
  p_street       text default null,
  p_postal_code  text default null,
  p_city         text default null,
  p_finma_number text default null
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_org   uuid;
  v_slug  public.citext;
  v_email public.citext;
  v_name  text;
  v_try   int := 0;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Name der Organisation fehlt' using errcode = '22023';
  end if;

  select p.email, coalesce(nullif(btrim(coalesce(p_display_name,'')),''), p.full_name, p.email)
    into v_email, v_name
    from public.profiles p where p.id = v_user;

  if v_email is null then
    raise exception 'Profil nicht gefunden' using errcode = '28000';
  end if;

  v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'org'; end if;

  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Kein freier Slug gefunden' using errcode = '23505';
    end if;
    v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g') || '-' || v_try;
  end loop;

  insert into public.organizations
    (name, slug, email, phone, street, postal_code, city, finma_number)
  values (btrim(p_name), v_slug,
          nullif(btrim(coalesce(p_email,'')),''),
          nullif(btrim(coalesce(p_phone,'')),''),
          nullif(btrim(coalesce(p_street,'')),''),
          nullif(btrim(coalesce(p_postal_code,'')),''),
          nullif(btrim(coalesce(p_city,'')),''),
          nullif(btrim(coalesce(p_finma_number,'')),''))
  returning id into v_org;

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'OWNER', v_name, v_email);

  update public.profiles set active_organization_id = v_org, updated_at = now()
   where id = v_user;

  perform public.create_default_template(v_org);

  return v_org;
end;
$$;

/**
 * Einladung einloesen.
 *
 * Neu: Name, Jobtitel und FINMA-Nummer kommen aus der Einladung, nicht
 * vom Eingeladenen. Der Adminaccount hat den Berater erfasst; was auf dem
 * Protokoll steht, soll nicht davon abhaengen, was jemand bei der
 * Anmeldung in ein Namensfeld tippt.
 */
create or replace function public.accept_invitation(p_token text)
  returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_inv   public.invitations;
  v_email public.citext;
  v_name  text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  select p.email, coalesce(p.full_name, p.email) into v_email, v_name
    from public.profiles p where p.id = v_user;

  select * into v_inv
    from public.invitations i
   where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and i.status = 'PENDING'
   for update;

  if not found then
    raise exception 'Einladung ungueltig oder bereits eingeloest' using errcode = '22023';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Einladung abgelaufen' using errcode = '22023';
  end if;

  if v_inv.email is distinct from v_email then
    raise exception 'Einladung gilt fuer eine andere E-Mail-Adresse' using errcode = '22023';
  end if;

  -- Der erfasste Name gewinnt; nur wenn keiner erfasst wurde, bleibt der
  -- aus dem Profil.
  v_name := coalesce(
    nullif(btrim(concat_ws(' ', v_inv.first_name, v_inv.last_name)), ''),
    v_name);

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email,
     first_name, last_name, job_title, finma_number)
  values (v_inv.organization_id, v_user, v_inv.role, v_name, v_email,
          v_inv.first_name, v_inv.last_name, v_inv.job_title, v_inv.finma_number)
  on conflict (organization_id, user_id) do update
    set is_active    = true,
        display_name = excluded.display_name,
        first_name   = coalesce(excluded.first_name,   organization_members.first_name),
        last_name    = coalesce(excluded.last_name,    organization_members.last_name),
        job_title    = coalesce(excluded.job_title,    organization_members.job_title),
        finma_number = coalesce(excluded.finma_number, organization_members.finma_number),
        updated_at   = now();

  update public.invitations
     set status = 'ACCEPTED', accepted_at = now(), accepted_by = v_user, updated_at = now()
   where id = v_inv.id;

  update public.profiles set active_organization_id = v_inv.organization_id, updated_at = now()
   where id = v_user;

  return v_inv.organization_id;
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
