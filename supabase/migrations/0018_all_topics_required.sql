-- Phase 3 - Alle Sparten sind Pflicht (fachliche Vorgabe)
--
-- Damit laesst sich eine Beratung erst abschliessen, wenn jede der elf
-- Sparten ein Ergebnis hat oder ausdruecklich uebersprungen wurde. Das ist
-- die strengste sinnvolle Auslegung von "kein Bereich wird vergessen" -
-- und sie funktioniert nur, weil Ueberspringen eine vollwertige,
-- protokollierte Entscheidung ist und kein Schlupfloch.

create or replace function public.default_required_slugs() returns text[]
  language sql stable
as $$
  select coalesce(array_agg(t.slug), '{}')
    from public.insurance_topics t
   where t.is_active;
$$;

comment on function public.default_required_slugs() is
  'Pflichtsparten. Derzeit alle aktiven: eine Beratung ist erst abschliessbar, wenn jede ein Ergebnis hat oder ausdruecklich uebersprungen wurde.';

-- Neue Vorlagenversion je Firma statt Aenderung der alten: laufende
-- Beratungen behalten ihre Version und bleiben unveraendert bewertbar.
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
    select r.organization_id, v_version, it.id, it.display_order, true
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
