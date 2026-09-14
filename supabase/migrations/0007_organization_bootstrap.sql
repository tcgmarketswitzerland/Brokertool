-- Phase 1 - Organisation gruenden, Einladung einloesen, Organisation wechseln
--
-- Diese drei Vorgaenge laufen als Datenbankfunktionen, weil sie atomar sein
-- muessen und weil sie Zustaende beruehren, in denen der JWT-Claim noch gar
-- nicht gesetzt ist: Bei der Registrierung existiert noch keine
-- Mitgliedschaft, aus der er abgeleitet werden koennte.

-- Profil beim Registrieren anlegen. Ohne diesen Trigger muesste der
-- Anwendungscode es tun - und bei jedem Anmeldeweg daran denken.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Organisation gruenden: Organisation, Owner-Mitgliedschaft und aktive
-- Organisation in einer Transaktion.
-- Hinweis zu public.citext in den Deklarationen: diese Funktionen laufen mit
-- set search_path = ''. Postgres prueft den Funktionsrumpf bereits beim
-- Anlegen, und ein Erweiterungstyp ist ohne Qualifizierung dann nicht
-- auflosebar. Gilt fuer jeden Typ, der nicht in pg_catalog liegt.
create or replace function public.create_organization(
  p_name text,
  p_display_name text default null
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

  -- Lesbarer Slug aus dem Namen, bei Kollision durchnummeriert.
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

  insert into public.organizations (name, slug)
  values (btrim(p_name), v_slug)
  returning id into v_org;

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email)
  values (v_org, v_user, 'OWNER', v_name, v_email);

  update public.profiles set active_organization_id = v_org, updated_at = now()
   where id = v_user;

  return v_org;
end;
$$;

-- Einladung einloesen. Der Aufrufer kennt nur das Klartext-Token; verglichen
-- wird der Hash.
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

  -- Hier bewusst KEIN "update ... set status = 'EXPIRED'": das raise darunter
  -- rollt die Transaktion zurueck, die Markierung waere also immer verloren.
  -- Fachlich genuegt die Bedingung oben; das Aufraeumen uebernimmt
  -- expire_invitations() als Wartungsaufgabe.
  if v_inv.expires_at <= now() then
    raise exception 'Einladung abgelaufen' using errcode = '22023';
  end if;

  -- Die Einladung gilt der eingeladenen Adresse, nicht dem Link. Sonst kann
  -- ein weitergeleiteter Link von einem beliebigen Konto eingeloest werden.
  if v_inv.email is distinct from v_email then
    raise exception 'Einladung gilt fuer eine andere E-Mail-Adresse' using errcode = '22023';
  end if;

  insert into public.organization_members
    (organization_id, user_id, role, display_name, email)
  values (v_inv.organization_id, v_user, v_inv.role, v_name, v_email)
  on conflict (organization_id, user_id) do update
    set is_active = true, updated_at = now();

  update public.invitations
     set status = 'ACCEPTED', accepted_at = now(), accepted_by = v_user, updated_at = now()
   where id = v_inv.id;

  update public.profiles set active_organization_id = v_inv.organization_id, updated_at = now()
   where id = v_user;

  return v_inv.organization_id;
end;
$$;

-- Organisationswechsel bei Mehrfachzugehoerigkeit. Kein impliziter Wechsel
-- und keine "erste Organisation aus der Liste"-Logik - das waere eine
-- Datenleckquelle (Architektur 7.2).
create or replace function public.switch_organization(p_organization_id uuid)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.organization_members m
     where m.user_id = v_user and m.organization_id = p_organization_id and m.is_active
  ) then
    raise exception 'Keine Mitgliedschaft in dieser Organisation' using errcode = '42501';
  end if;

  update public.profiles
     set active_organization_id = p_organization_id, updated_at = now()
   where id = v_user;
end;
$$;

-- Eine Organisation darf nie ohne Owner zurueckbleiben.
create or replace function public.guard_last_owner() returns trigger
  language plpgsql set search_path = ''
as $$
declare v_owners int;
begin
  select count(*) into v_owners
    from public.organization_members m
   where m.organization_id = old.organization_id
     and m.role = 'OWNER' and m.is_active
     and m.id <> old.id;

  if v_owners = 0 and (tg_op = 'DELETE' or new.role <> 'OWNER' or not new.is_active) then
    raise exception 'Die Organisation braucht mindestens einen Owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_guard_last_owner
  before update or delete on organization_members
  for each row when (old.role = 'OWNER')
  execute function public.guard_last_owner();

-- Abgelaufene Einladungen markieren. Laeuft als Wartungsaufgabe, nicht im
-- Einloeseweg: dort wuerde jede Markierung vom folgenden raise zurueckgerollt.
create or replace function public.expire_invitations() returns int
  language sql security definer set search_path = ''
as $$
  with aktualisiert as (
    update public.invitations
       set status = 'EXPIRED', updated_at = now()
     where status = 'PENDING' and expires_at <= now()
    returning 1
  )
  select count(*)::int from aktualisiert;
$$;
