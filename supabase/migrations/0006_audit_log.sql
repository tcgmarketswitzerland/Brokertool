-- Phase 1 - Audit-Log (Konzeptpunkt 21)
--
-- Als Anwendungscode geschrieben ist ein Audit-Log lueckenhaft: jeder
-- vergessene Pfad fehlt. Als Trigger ist es vollstaendig, kaum Code, und der
-- Anwendungscode kann es nicht umgehen.

create type audit_action as enum ('INSERT','UPDATE','DELETE');

create table audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null,     -- bewusst ohne Fremdschluessel:
                                     -- der Eintrag muss eine geloeschte
                                     -- Organisation ueberleben
  actor_user_id   uuid,
  action          audit_action not null,
  entity_table    text not null,
  entity_id       uuid,
  changed_fields  text[],
  recorded_values jsonb,
  occurred_at     timestamptz not null default now()
);

create index audit_logs_org_idx on audit_logs (organization_id, occurred_at desc);
create index audit_logs_entity_idx on audit_logs (entity_table, entity_id);

alter table audit_logs enable row level security;
alter table audit_logs force  row level security;

-- Lesen duerfen Owner und Admin. Es gibt bewusst KEINE Update- und keine
-- Delete-Policy - auch nicht fuer den Owner. Ein aenderbares Audit-Log ist
-- wertlos. Eintraege entstehen ausschliesslich durch den Trigger unten, der
-- als security definer laeuft.
create policy audit_logs_select on audit_logs for select to authenticated
  using (organization_id = public.auth_org_id()
         and public.auth_org_role() in ('OWNER','ADMIN'));

-- Vollstaendige Vorher/Nachher-Abbilder wuerden Personendaten ein zweites Mal
-- speichern und damit das Loeschkonzept unterlaufen (Analyse 1.10). Der
-- Trigger haelt deshalb nur die NAMEN der geaenderten Felder fest. Werte
-- ausschliesslich fuer die kurze Liste entscheidungsrelevanter Felder - genau
-- die Aenderungen, die im Streitfall interessieren.
create or replace function public.audit_trigger() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  v_org      uuid;
  v_entity   uuid;
  v_changed  text[];
  v_values   jsonb := null;
  v_tracked  constant text[] := array[
    'status','role','progress_status','outcome','coverage_state','is_active'
  ];
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_new := '{}'::jsonb;
  elsif tg_op = 'INSERT' then
    v_old := '{}'::jsonb;  v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new);
  end if;

  v_org    := coalesce((v_new ->> 'organization_id')::uuid,
                       (v_old ->> 'organization_id')::uuid);
  v_entity := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);

  if tg_op = 'UPDATE' then
    select array_agg(key) into v_changed
      from jsonb_each(v_new)
     where v_old -> key is distinct from v_new -> key
       and key not in ('updated_at','updated_by');
    if v_changed is null then
      return null;   -- nichts Fachliches geaendert, kein Eintrag
    end if;
  end if;

  select jsonb_object_agg(k, jsonb_build_object('von', v_old -> k, 'nach', v_new -> k))
    into v_values
    from unnest(v_tracked) as k
   where (v_old ? k or v_new ? k)
     and v_old -> k is distinct from v_new -> k;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_table, entity_id,
     changed_fields, recorded_values)
  values
    (v_org, auth.uid(), tg_op::public.audit_action, tg_table_name, v_entity,
     v_changed, v_values);

  return null;   -- AFTER-Trigger
end;
$$;

create trigger trg_audit_members
  after insert or update or delete on organization_members
  for each row execute function public.audit_trigger();
