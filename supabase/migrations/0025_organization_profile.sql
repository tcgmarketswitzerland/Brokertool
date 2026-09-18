-- Phase 8 - Firmenangaben und Erscheinungsbild
--
-- Das Beratungsprotokoll ist ein Dokument, das der Kunde behaelt und im
-- Streitfall vorlegt. Darauf gehoert, von wem es stammt: Name, Adresse und
-- eine Kontaktmoeglichkeit. Bisher stand dort nur der Firmenname.
--
-- Eigene Spalten statt eines weiteren Schluessels in `settings`: das sind
-- fachliche Angaben mit Laengen- und Formatregeln, keine Vorlieben. Ein
-- jsonb-Feld gaebe dafuer keine Pruefung her.

alter table organizations
  add column if not exists street           text,
  add column if not exists postal_code      text,
  add column if not exists city             text,
  add column if not exists phone            text,
  add column if not exists email            text,
  add column if not exists website          text,
  -- Das Logo liegt in der Zeile und nicht im Objektspeicher. Es ist klein,
  -- wird bei jedem Protokoll gebraucht und muss im PDF als Datenstrom
  -- vorliegen - ein Umweg ueber eine signierte URL brauchte dort einen
  -- zweiten Netzzugriff mitten im Rendern. Dieselbe Ueberlegung wie bei
  -- der Unterschrift (Migration 0020).
  add column if not exists logo_base64      text,
  add column if not exists logo_content_type text,
  add column if not exists brand_color      text;

do $$
begin
  -- Guard, damit die Migration mehrfach laufen darf: ein zweites
  -- `add constraint` scheitert sonst.
  if not exists (select 1 from pg_constraint where conname = 'organizations_postal_code_ch') then
    alter table organizations add constraint organizations_postal_code_ch
      check (postal_code is null or postal_code ~ '^[1-9][0-9]{3}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_brand_color_hex') then
    alter table organizations add constraint organizations_brand_color_hex
      check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_pair') then
    -- Ein Bild ohne Typ liesse sich nicht anzeigen, ein Typ ohne Bild
    -- nichts. Entweder beides oder keines.
    alter table organizations add constraint organizations_logo_pair
      check (num_nonnulls(logo_base64, logo_content_type) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_type') then
    alter table organizations add constraint organizations_logo_type
      check (logo_content_type is null
             or logo_content_type in ('image/png','image/jpeg'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'organizations_logo_size') then
    -- Rund 1 MB in base64. Ein Logo, das groesser ist, ist kein Logo.
    alter table organizations add constraint organizations_logo_size
      check (logo_base64 is null or length(logo_base64) between 100 and 1400000);
  end if;
end $$;

-- Die Firmenzeile steht in jedem Protokoll; ohne Audit liesse sich spaeter
-- nicht mehr sagen, wie sie zum Zeitpunkt eines Gespraechs lautete.
--
-- Eigene Funktion, weil der allgemeine Trigger die Spalte
-- organization_id liest. Die hat diese Tabelle nicht: sie IST die
-- Organisation, und ihre eigene id ist der Mandant.
create or replace function public.audit_organization() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(key) into v_changed
      from jsonb_each(to_jsonb(new))
     where to_jsonb(old) -> key is distinct from to_jsonb(new) -> key
       and key not in ('updated_at','updated_by');
    if v_changed is null then
      return null;   -- nichts Fachliches geaendert, kein Eintrag
    end if;
  end if;

  insert into public.audit_logs
    (organization_id, actor_user_id, action, entity_table, entity_id, changed_fields)
  values (new.id, auth.uid(), tg_op::public.audit_action, 'organizations', new.id, v_changed);

  return null;   -- AFTER-Trigger
end;
$$;

-- Nur Anlegen und Aendern: eine geloeschte Organisation hat keine
-- Mandanten-id mehr, unter der ein Eintrag stehen koennte. Geloescht wird
-- ohnehin weich, ueber deleted_at - und das ist ein UPDATE.
drop trigger if exists trg_audit_organizations on organizations;
create trigger trg_audit_organizations
  after insert or update on organizations
  for each row execute function public.audit_organization();

select public.apply_tenant_rls();
select public.assert_rls_complete();
