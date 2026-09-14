-- Phase 3 - Spartenkatalog nach fachlicher Vorgabe
--
-- Der Katalog aus 0013 war mein Vorschlag. Die verbindliche Liste umfasst
-- elf Sparten in dieser Reihenfolge:
--   Hausrat, Privathaftpflicht, Gebaeude, Motorfahrzeuge, Rechtsschutz,
--   Reise, Cyber, Krankenkasse, Risiko, Vorsorge, Hypothek
--
-- Entfallen: Haustiere, Unfall, Erwerbsunfaehigkeit, Todesfall, Saeule 3a.
-- Erwerbsunfaehigkeit und Todesfall gehen in "Risiko" auf, Saeule 3a in
-- "Vorsorge".
--
-- Wichtig: Die Szenarien der spaeteren Vorsorgeanalyse bleiben davon
-- unberuehrt. Die Trennung zwischen Erwerbsunfaehigkeit durch Unfall und
-- durch Krankheit ist eine Frage der Berechnung, nicht der Gespraechs-
-- gliederung - sie steckt im Enum pension_scenario und bleibt bestehen
-- (Analyse 1.5).
--
-- Entfernte Sparten werden deaktiviert, nicht geloescht: an ihnen koennen
-- bereits Beratungen haengen, die nachvollziehbar bleiben muessen.

update insurance_topics set is_active = false
 where slug in ('haustiere', 'unfall', 'erwerbsunfaehigkeit', 'todesfall', 'saeule3a');

-- Namen, Symbole und Reihenfolge der verbleibenden Sparten setzen.
update insurance_topics set
  name = '{"de":"Hausratversicherung","fr":"Assurance ménage","it":"Assicurazione economia domestica"}',
  icon = 'sofa', display_order = 10, is_active = true
 where slug = 'hausrat';

update insurance_topics set
  name = '{"de":"Privathaftpflicht","fr":"RC privée","it":"RC privata"}',
  icon = 'shield', display_order = 20, is_active = true
 where slug = 'privathaftpflicht';

update insurance_topics set
  name = '{"de":"Gebäude","fr":"Bâtiment","it":"Edificio"}',
  icon = 'building', display_order = 30, is_active = true
 where slug = 'gebaeude';

update insurance_topics set
  name = '{"de":"Motorfahrzeugversicherung","fr":"Assurance véhicules","it":"Assicurazione veicoli"}',
  icon = 'car', display_order = 40, is_active = true
 where slug = 'motorfahrzeug';

update insurance_topics set
  name = '{"de":"Rechtsschutz","fr":"Protection juridique","it":"Tutela giuridica"}',
  icon = 'scale', display_order = 50, is_active = true
 where slug = 'rechtsschutz';

update insurance_topics set
  name = '{"de":"Reise","fr":"Voyage","it":"Viaggio"}',
  icon = 'plane', display_order = 60, is_active = true
 where slug = 'reise';

update insurance_topics set
  name = '{"de":"Cyber","fr":"Cyber","it":"Cyber"}',
  icon = 'laptop', display_order = 70, is_active = true
 where slug = 'cyber';

update insurance_topics set
  name = '{"de":"Krankenkasse","fr":"Assurance maladie","it":"Cassa malati"}',
  icon = 'heart-pulse', display_order = 80, is_active = true
 where slug = 'krankenkasse';

-- Neu: Risiko fasst Todesfall und Erwerbsunfaehigkeit zusammen.
insert into insurance_topics
  (slug, name, category, icon, display_order, field_schema_key, applicable_customer_types)
values
  ('risiko',
   '{"de":"Risiko","fr":"Risque","it":"Rischio"}',
   'LIFE', 'umbrella', 90, 'risk', '{PRIVATE,COUPLE,FAMILY}')
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon,
  display_order = excluded.display_order, is_active = true;

update insurance_topics set
  name = '{"de":"Vorsorge","fr":"Prévoyance","it":"Previdenza"}',
  icon = 'piggy-bank', display_order = 100, is_active = true
 where slug = 'vorsorge';

update insurance_topics set
  name = '{"de":"Hypothek","fr":"Hypothèque","it":"Ipoteca"}',
  icon = 'key-round', display_order = 110, is_active = true
 where slug = 'hypothek';

-- Pflichtsparten neu festlegen.
create or replace function public.default_required_slugs() returns text[]
  language sql immutable
as $$
  select array['hausrat', 'privathaftpflicht', 'krankenkasse', 'risiko', 'vorsorge']::text[];
$$;

comment on function public.default_required_slugs() is
  'Sparten, die fuer den Abschluss einer Beratung zwingend ein Ergebnis brauchen. Fachliche Vorgabe, je Firma in der Vorlage ueberschreibbar.';

create or replace function public.create_default_template(p_organization_id uuid)
  returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_template uuid;
  v_version  uuid;
begin
  insert into public.advice_templates (organization_id, key, name, is_default)
  values (p_organization_id, 'privatkunden',
          '{"de":"Privatkunden","fr":"Clients privés","it":"Clienti privati"}'::jsonb, true)
  returning id into v_template;

  insert into public.advice_template_versions
    (organization_id, template_id, version, status)
  values (p_organization_id, v_template, 1, 'DRAFT')
  returning id into v_version;

  insert into public.advice_template_topics
    (organization_id, template_version_id, topic_id, display_order, is_required)
  select p_organization_id, v_version, t.id, t.display_order,
         t.slug = any (public.default_required_slugs())
    from public.insurance_topics t
   where t.is_active
     and 'PRIVATE' = any (t.applicable_customer_types);

  update public.advice_template_versions
     set status = 'PUBLISHED', published_at = now()
   where id = v_version;

  return v_version;
end;
$$;

-- Bestehende Firmen bekommen eine NEUE Vorlagenversion statt einer Aenderung
-- der alten. Genau dafuer ist die Versionierung da: laufende Beratungen
-- zeigen weiter auf ihre Version und bleiben unveraendert bewertbar, neue
-- Beratungen nehmen die neue (Architektur 2.10).
do $$
declare
  r record;
  v_version uuid;
begin
  for r in
    select t.id as template_id, t.organization_id,
           coalesce(max(v.version), 0) + 1 as next_version
      from public.advice_templates t
      left join public.advice_template_versions v on v.template_id = t.id
     where t.is_default
     group by t.id, t.organization_id
  loop
    insert into public.advice_template_versions
      (organization_id, template_id, version, status)
    values (r.organization_id, r.template_id, r.next_version, 'DRAFT')
    returning id into v_version;

    insert into public.advice_template_topics
      (organization_id, template_version_id, topic_id, display_order, is_required)
    select r.organization_id, v_version, it.id, it.display_order,
           it.slug = any (public.default_required_slugs())
      from public.insurance_topics it
     where it.is_active
       and 'PRIVATE' = any (it.applicable_customer_types);

    update public.advice_template_versions
       set status = 'PUBLISHED', published_at = now()
     where id = v_version;
  end loop;
end $$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
