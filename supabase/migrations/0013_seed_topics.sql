-- Phase 3 - Spartenkatalog fuer Privatkunden (Konzeptpunkt 4)
--
-- Die Reihenfolge folgt dem tatsaechlichen Gespraechsverlauf: zuerst das
-- Naheliegende und Konkrete (Wohnen, Fahrzeug), dann Absicherung, zuletzt
-- Vorsorge und Finanzierung - die Themen, die am meisten Vertrauen
-- voraussetzen.
--
-- is_required markiert die Sparten, die jeder Schweizer Haushalt betreffen
-- und die deshalb nicht unbesprochen bleiben duerfen. Das ist eine
-- fachliche Vorgabe, keine technische: jede Firma kann sie in ihrer
-- eigenen Vorlage anders setzen.

insert into insurance_topics
  (slug, name, category, icon, display_order, field_schema_key, applicable_customer_types)
values
  ('hausrat',        '{"de":"Hausrat","fr":"Ménage","it":"Economia domestica"}',
                     'PROPERTY',  'sofa',          10, 'household',   '{PRIVATE,COUPLE,FAMILY}'),
  ('privathaftpflicht','{"de":"Privathaftpflicht","fr":"RC privée","it":"RC privata"}',
                     'LIABILITY', 'shield',        20, 'liability',   '{PRIVATE,COUPLE,FAMILY}'),
  ('gebaeude',       '{"de":"Gebäude","fr":"Bâtiment","it":"Edificio"}',
                     'PROPERTY',  'home',          30, 'building',    '{PRIVATE,COUPLE,FAMILY}'),
  ('motorfahrzeug',  '{"de":"Motorfahrzeuge","fr":"Véhicules","it":"Veicoli"}',
                     'VEHICLE',   'car',           40, 'vehicle',     '{PRIVATE,COUPLE,FAMILY}'),
  ('rechtsschutz',   '{"de":"Rechtsschutz","fr":"Protection juridique","it":"Tutela giuridica"}',
                     'LEGAL',     'scale',         50, 'legal',       '{PRIVATE,COUPLE,FAMILY}'),
  ('reise',          '{"de":"Reise","fr":"Voyage","it":"Viaggio"}',
                     'TRAVEL',    'plane',         60, 'travel',      '{PRIVATE,COUPLE,FAMILY}'),
  ('cyber',          '{"de":"Cyber","fr":"Cyber","it":"Cyber"}',
                     'CYBER',     'wifi',          70, 'cyber',       '{PRIVATE,COUPLE,FAMILY}'),
  ('haustiere',      '{"de":"Haustiere","fr":"Animaux","it":"Animali"}',
                     'PET',       'paw',           80, 'pet',         '{PRIVATE,COUPLE,FAMILY}'),
  ('krankenkasse',   '{"de":"Krankenkasse","fr":"Assurance maladie","it":"Cassa malati"}',
                     'HEALTH',    'stethoscope',   90, 'health',      '{PRIVATE,COUPLE,FAMILY}'),
  ('unfall',         '{"de":"Unfall","fr":"Accident","it":"Infortunio"}',
                     'ACCIDENT',  'bandage',      100, 'accident',    '{PRIVATE,COUPLE,FAMILY}'),
  ('erwerbsunfaehigkeit','{"de":"Erwerbsunfähigkeit","fr":"Incapacité de gain","it":"Incapacità di guadagno"}',
                     'PENSION',   'activity',     110, 'disability',  '{PRIVATE,COUPLE,FAMILY}'),
  ('todesfall',      '{"de":"Todesfall","fr":"Décès","it":"Decesso"}',
                     'LIFE',      'heart',        120, 'death',       '{PRIVATE,COUPLE,FAMILY}'),
  ('vorsorge',       '{"de":"Vorsorge und Pensionierung","fr":"Prévoyance et retraite","it":"Previdenza e pensionamento"}',
                     'PENSION',   'piggy-bank',   130, 'retirement',  '{PRIVATE,COUPLE,FAMILY}'),
  ('saeule3a',       '{"de":"Säule 3a","fr":"Pilier 3a","it":"Pilastro 3a"}',
                     'FINANCE',   'wallet',       140, 'pillar3a',    '{PRIVATE,COUPLE,FAMILY}'),
  ('hypothek',       '{"de":"Hypothek und Wohneigentum","fr":"Hypothèque et propriété","it":"Ipoteca e proprietà"}',
                     'FINANCE',   'key',          150, 'mortgage',    '{PRIVATE,COUPLE,FAMILY}')
on conflict (slug) do nothing;

-- Standardvorlage bei der Firmengruendung mit anlegen.
--
-- Statt einer globalen Vorlage mit organization_id IS NULL bekommt jede
-- Firma eine eigene Kopie: die Regel "keine nullable organization_id" ist
-- der Grund, warum der Policy-Generator ueberhaupt funktionieren kann
-- (Datenbankstruktur 1.2).
create or replace function public.create_default_template(p_organization_id uuid)
  returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_template uuid;
  v_version  uuid;
  v_pflicht  constant text[] := array[
    'hausrat', 'privathaftpflicht', 'krankenkasse',
    'erwerbsunfaehigkeit', 'vorsorge'
  ];
begin
  insert into public.advice_templates (organization_id, key, name, is_default)
  values (p_organization_id, 'privatkunden',
          '{"de":"Privatkunden","fr":"Clients privés","it":"Clienti privati"}'::jsonb, true)
  returning id into v_template;

  insert into public.advice_template_versions
    (organization_id, template_id, version, status, published_at)
  values (p_organization_id, v_template, 1, 'DRAFT', null)
  returning id into v_version;

  insert into public.advice_template_topics
    (organization_id, template_version_id, topic_id, display_order, is_required)
  select p_organization_id, v_version, t.id, t.display_order,
         t.slug = any (v_pflicht)
    from public.insurance_topics t
   where t.is_active
     and 'PRIVATE' = any (t.applicable_customer_types);

  -- Erst jetzt veroeffentlichen: der Schreibschutz auf den Topics greift,
  -- sobald die Version auf PUBLISHED steht.
  update public.advice_template_versions
     set status = 'PUBLISHED', published_at = now()
   where id = v_version;

  return v_version;
end;
$$;

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

  -- Neu gegenueber 0007: jede Firma startet mit einer fertigen Vorlage.
  -- Ohne sie koennte der erste Berater keine Beratung starten.
  perform public.create_default_template(v_org);

  return v_org;
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
