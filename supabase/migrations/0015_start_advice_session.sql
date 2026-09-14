-- Phase 3 - Beratung starten
--
-- Als Datenbankfunktion, weil das Instanziieren atomar sein muss: eine
-- Beratung ohne ihre Themen waere unbrauchbar, und der Berater sitzt beim
-- Kunden - ein halb angelegter Zustand ist dort teurer als anderswo.

create or replace function public.start_advice_session(
  p_customer_id uuid,
  p_title       text default null
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_user     uuid := auth.uid();
  v_member   uuid;
  v_version  uuid;
  v_session  uuid;
  v_type     public.customer_type;
begin
  if v_org is null or v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  if not public.can_write('advice_sessions') then
    raise exception 'Keine Berechtigung, eine Beratung zu fuehren' using errcode = '42501';
  end if;

  select m.id into v_member
    from public.organization_members m
   where m.organization_id = v_org and m.user_id = v_user and m.is_active;
  if v_member is null then
    raise exception 'Keine aktive Mitgliedschaft' using errcode = '42501';
  end if;

  select c.customer_type into v_type
    from public.customers c
   where c.id = p_customer_id and c.organization_id = v_org and c.deleted_at is null;
  if v_type is null then
    raise exception 'Kunde nicht gefunden' using errcode = '22023';
  end if;

  -- Die zuletzt veroeffentlichte Version der Standardvorlage. Bewusst nicht
  -- "irgendeine passende": eine Beratung zeigt auf genau eine
  -- Vorlagenversion, und die bleibt fuer ihre gesamte Lebensdauer gueltig.
  select v.id into v_version
    from public.advice_template_versions v
    join public.advice_templates t on t.id = v.template_id
   where t.organization_id = v_org
     and t.is_default
     and v.status = 'PUBLISHED'
   order by v.version desc
   limit 1;

  if v_version is null then
    raise exception 'Keine veroeffentlichte Beratungsvorlage vorhanden' using errcode = '22023';
  end if;

  insert into public.advice_sessions
    (organization_id, customer_id, template_version_id, advisor_member_id,
     status, title, started_at, created_by)
  values
    (v_org, p_customer_id, v_version, v_member,
     'IN_PROGRESS', nullif(btrim(coalesce(p_title,'')),''), now(), v_user)
  returning id into v_session;

  -- Themen aus der Vorlage kopieren. display_order, is_required und
  -- field_schema_version wandern mit: der Snapshot-Gedanke auf Zeilenebene.
  -- Aendert die Firma morgen ihre Vorlage, bleibt diese Beratung exakt so
  -- bewertbar, wie sie gefuehrt wurde.
  --
  -- organization_topic_settings ueberlagert den Katalog: eine abgeschaltete
  -- Sparte erscheint in neuen Beratungen nicht mehr, in bestehenden
  -- unveraendert.
  insert into public.advice_session_topics
    (organization_id, session_id, topic_id, display_order, is_required, field_schema_version)
  select v_org, v_session, tt.topic_id,
         coalesce(s.display_order, tt.display_order),
         tt.is_required,
         tt.field_schema_version
    from public.advice_template_topics tt
    join public.insurance_topics it on it.id = tt.topic_id
    left join public.organization_topic_settings s
      on s.organization_id = v_org and s.topic_id = tt.topic_id
   where tt.template_version_id = v_version
     and it.is_active
     and coalesce(s.is_enabled, true)
     and v_type = any (it.applicable_customer_types);

  -- Die Personen des Haushalts als Teilnehmende vormerken. Wer am Tisch
  -- sass, ist protokollrelevant; abwaehlen kann der Berater im Gespraech.
  insert into public.advice_session_participants
    (organization_id, session_id, person_id, display_name)
  select v_org, v_session, p.id, p.first_name || ' ' || p.last_name
    from public.customer_persons p
   where p.customer_id = p_customer_id
     and p.deleted_at is null
     and p.person_role in ('PRIMARY','PARTNER');

  return v_session;
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
