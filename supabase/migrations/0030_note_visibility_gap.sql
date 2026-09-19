-- Korrektur zu 0026: Notizen an einer Sparte waren firmenweit sichtbar
--
-- Gefunden beim Bauen der Demodaten. Der Generator aus 0026 haengt die
-- Sichtbarkeitsbedingung an die Spalten customer_id, session_id und
-- policy_id. Eine Notiz traegt aber genau EINEN Bezug
-- (notes_exactly_one_owner) - und im haeufigsten Fall, der Notiz zu einer
-- Sparte, ist das session_topic_id. Beide geprueften Spalten standen dann
-- auf NULL, die Bedingung war damit erfuellt, und die Notiz war fuer jeden
-- Berater der Firma lesbar.
--
-- Ausgerechnet Notizen: dort steht, was im Gespraech gesagt wurde.
--
-- Die Pruefung in assert_rls_complete() konnte das nicht sehen. Sie fragt,
-- OB eine Tabelle einen Kundenbezug hat, nicht ob jede ihrer Zeilen ihn
-- fuehrt. Das bleibt so - eine Regel, die jede denkbare Spaltenkombination
-- abdeckt, gibt es nicht. Was es gibt, ist ein Test, der genau diesen Fall
-- festhaelt (tests/db/advisor-visibility.test.ts).

create or replace function public.can_see_session_topic(p_topic uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_topic is null
      or public.sees_all_customers()
      or exists (select 1 from public.advice_session_topics t
                  where t.id = p_topic
                    and public.can_see_session(t.session_id));
$$;

create or replace function public.rls_visibility_clause(p_table text) returns text
  language plpgsql stable set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_rel   oid := to_regclass('public.' || quote_ident(p_table));
  v_col   text;
  -- Spalte -> Pruefung. Traegt eine Tabelle mehrere davon, werden alle
  -- verlangt: das ist keine Haerte, sondern der Sinn der Sache - ein
  -- Dokument mit Kunde UND Beratung muss bei beiden sichtbar sein.
  v_links constant text[][] := array[
    array['customer_id',      'public.can_see_customer(customer_id)'],
    array['session_id',       'public.can_see_session(session_id)'],
    array['session_topic_id', 'public.can_see_session_topic(session_topic_id)'],
    array['policy_id',        'public.can_see_policy(policy_id)']
  ];
  i int;
begin
  -- to_regclass statt eines Casts: der Planer darf diese Funktion auch auf
  -- Zeilen anwenden, die den Schemafilter des Aufrufers noch nicht
  -- passiert haben.
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

  for i in 1 .. array_length(v_links, 1) loop
    v_col := v_links[i][1];
    if exists (select 1 from pg_attribute a
                where a.attrelid = v_rel and a.attname = v_col
                  and a.attnum > 0 and not a.attisdropped) then
      v_parts := array_append(v_parts, v_links[i][2]);
    end if;
  end loop;

  if cardinality(v_parts) = 0 then
    return null;   -- weder Kundenbezug noch bewusst firmenweit
  end if;

  return 'and ' || array_to_string(v_parts, ' and ');
end;
$$;

select public.apply_tenant_rls();
select public.assert_rls_complete();
