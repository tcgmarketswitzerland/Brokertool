-- Phase 8 - Spartenauswahl je Firma
--
-- Welche Sparten eine Beratung abdeckt, in welcher Reihenfolge und welche
-- davon ein Ergebnis brauchen, entscheidet die Firma. Bisher stand das im
-- Code (create_default_template) und wurde einmalig gesetzt.
--
-- Der heikle Teil ist nicht die Auswahl, sondern der Zeitpunkt: eine
-- laufende Beratung zeigt auf genau eine Vorlagenversion und behaelt sie.
-- Eine Aenderung erzeugt deshalb eine NEUE Version. Ein Gespraech, das
-- gestern begonnen hat, bewertet sich weiter nach den Regeln von gestern -
-- alles andere waere eine stille Aenderung an einer Dokumentation, die im
-- Streitfall Bestand haben muss.

/**
 * Spartenauswahl veroeffentlichen.
 *
 * p_topics ist ein Array aus {topic_id, is_enabled, is_required} in der
 * gewuenschten Reihenfolge. Die Reihenfolge des Arrays ist die Reihenfolge
 * im Beratungsrad - ein eigenes Feld dafuer waere eine zweite Wahrheit.
 */
create or replace function public.publish_topic_selection(p_topics jsonb)
  returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_template uuid;
  v_current  uuid;
  v_version  uuid;
  v_next     int;
  v_enabled  int;
begin
  if v_org is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if not public.can_write('advice_templates') then
    raise exception 'Keine Berechtigung, die Vorlage zu aendern' using errcode = '42501';
  end if;
  if jsonb_typeof(p_topics) <> 'array' then
    raise exception 'Spartenliste fehlt' using errcode = '22023';
  end if;

  -- Die Eingabe in eine temporaere Sicht bringen; die Reihenfolge im Array
  -- wird dabei zur Anzeigereihenfolge.
  create temporary table if not exists _auswahl (
    topic_id      uuid,
    is_enabled    boolean,
    is_required   boolean,
    display_order int
  ) on commit drop;
  delete from _auswahl;

  insert into _auswahl (topic_id, is_enabled, is_required, display_order)
  select (e.value ->> 'topic_id')::uuid,
         coalesce((e.value ->> 'is_enabled')::boolean, true),
         coalesce((e.value ->> 'is_required')::boolean, false),
         (e.ordinality * 10)::int
    from jsonb_array_elements(p_topics) with ordinality as e(value, ordinality);

  -- Unbekannte Sparten schweigend zu schlucken waere schlechter als ein
  -- Fehler: die Firma saehe eine Auswahl, die nicht der entspricht, die
  -- sie abgeschickt hat.
  if exists (select 1 from _auswahl a
              where not exists (select 1 from public.insurance_topics t
                                 where t.id = a.topic_id and t.is_active)) then
    raise exception 'Unbekannte Sparte in der Auswahl' using errcode = '22023';
  end if;

  select count(*) into v_enabled from _auswahl where is_enabled;
  if v_enabled = 0 then
    raise exception 'Mindestens eine Sparte muss aktiv bleiben' using errcode = '22023';
  end if;

  select t.id into v_template
    from public.advice_templates t
   where t.organization_id = v_org and t.is_default;
  if v_template is null then
    raise exception 'Keine Standardvorlage vorhanden' using errcode = '22023';
  end if;

  select v.id into v_current
    from public.advice_template_versions v
   where v.template_id = v_template and v.status = 'PUBLISHED'
   order by v.version desc limit 1;

  -- Die Einstellungen der Firma halten auch die abgewaehlten Sparten fest.
  -- Sie sind die Antwort auf "was haben wir zuletzt abgewaehlt" - in der
  -- Vorlagenversion steht nur, was aktiv ist.
  insert into public.organization_topic_settings
    (organization_id, topic_id, is_enabled, display_order)
  select v_org, a.topic_id, a.is_enabled, a.display_order from _auswahl a
  on conflict (organization_id, topic_id) do update
    set is_enabled    = excluded.is_enabled,
        display_order = excluded.display_order,
        updated_at    = now();

  -- Nichts geaendert, nichts zu tun. Ohne diese Pruefung entstuende bei
  -- jedem Speichern eine weitere, identische Version.
  if v_current is not null and not exists (
    select 1 from _auswahl a
     where a.is_enabled
       and not exists (
         select 1 from public.advice_template_topics tt
          where tt.template_version_id = v_current
            and tt.topic_id = a.topic_id
            and tt.is_required  = a.is_required
            and tt.display_order = a.display_order)
  ) and (select count(*) from public.advice_template_topics tt
          where tt.template_version_id = v_current) = v_enabled
  then
    return v_current;
  end if;

  select coalesce(max(v.version), 0) + 1 into v_next
    from public.advice_template_versions v where v.template_id = v_template;

  insert into public.advice_template_versions
    (organization_id, template_id, version, status)
  values (v_org, v_template, v_next, 'DRAFT')
  returning id into v_version;

  insert into public.advice_template_topics
    (organization_id, template_version_id, topic_id, display_order, is_required)
  select v_org, v_version, a.topic_id, a.display_order, a.is_required
    from _auswahl a where a.is_enabled;

  update public.advice_template_versions
     set status = 'PUBLISHED', published_at = now()
   where id = v_version;

  return v_version;
end;
$$;

comment on function public.publish_topic_selection(jsonb) is
  'Veroeffentlicht eine neue Vorlagenversion aus der Spartenauswahl. Laufende Beratungen behalten ihre Version.';

select public.apply_tenant_rls();
select public.assert_rls_complete();
