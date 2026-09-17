-- Abschluss ohne Pflichtsparten (fachliche Vorgabe, ersetzt 0018)
--
-- Bisher war eine Beratung erst abschliessbar, wenn jede Sparte ein
-- Ergebnis hatte. Im echten Gespraech passt das nicht: ein Kunde kommt
-- wegen der Motorfahrzeugversicherung und hat vierzig Minuten Zeit.
--
-- Die Regel wird deshalb umgedreht, ohne das Versprechen aufzugeben:
-- abschliessen laesst sich ab einer besprochenen Sparte, und alle uebrigen
-- werden dabei ausdruecklich auf "im Gespraech nicht thematisiert"
-- gesetzt. Damit steht im Protokoll weiterhin zu jeder Sparte ein Satz -
-- nur eben die Wahrheit, dass sie nicht behandelt wurde, statt einer
-- Luecke. Das ist der entscheidende Unterschied: eine Luecke muss man
-- spaeter erklaeren, einen dokumentierten Satz nicht.

create or replace function public.complete_advice_session(
  p_session_id uuid,
  p_document   jsonb
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  v_snapshot uuid;
  v_settled int;
  v_org uuid;
begin
  select s.organization_id into v_org
    from public.advice_sessions s
   where s.id = p_session_id
     and s.organization_id = public.auth_org_id()
     and s.status in ('DRAFT','IN_PROGRESS');
  if v_org is null then
    raise exception 'Beratung nicht gefunden oder bereits abgeschlossen' using errcode = '22023';
  end if;

  if not public.has_permission('advice:complete') then
    raise exception 'Keine Berechtigung zum Abschliessen' using errcode = '42501';
  end if;

  -- Eine Beratung ohne eine einzige besprochene Sparte ist keine Beratung.
  -- Sie abzuschliessen wuerde ein Protokoll erzeugen, das nichts belegt.
  select count(*) into v_settled
    from public.advice_session_topics t
   where t.session_id = p_session_id
     and t.outcome is not null;

  if v_settled = 0 then
    raise exception 'Mindestens eine Sparte braucht ein Ergebnis'
      using errcode = 'check_violation';
  end if;

  -- Alles Uebrige wird festgehalten, nicht verschwiegen.
  update public.advice_session_topics
     set progress_status = 'SKIPPED', outcome = null
   where session_id = p_session_id
     and outcome is null
     and progress_status <> 'SKIPPED';

  insert into public.advice_session_snapshots
    (organization_id, session_id, document, content_hash, created_by)
  values
    (v_org, p_session_id, p_document,
     encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex'), auth.uid())
  returning id into v_snapshot;

  update public.advice_sessions
     set status = 'COMPLETED', completed_at = now(), updated_at = now()
   where id = p_session_id;

  return v_snapshot;
end;
$$;

comment on function public.complete_advice_session(uuid, jsonb) is
  'Schliesst eine Beratung ab. Nicht besprochene Sparten werden als "nicht thematisiert" festgehalten.';

-- Die Kennzeichnung als Pflichtsparte bleibt im Datenmodell: sie steuert,
-- was die Oberflaeche hervorhebt. Sie sperrt den Abschluss nicht mehr.
select public.assert_rls_complete();
