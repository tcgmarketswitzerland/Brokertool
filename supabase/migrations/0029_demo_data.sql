-- Phase 9 - Demodaten
--
-- Eine leere Anwendung laesst sich nicht beurteilen. Wer Brokertool zum
-- ersten Mal oeffnet, sieht vier Nullen und eine leere Liste und weiss
-- nicht, ob das Werkzeug taugt. Ein Knopf fuellt sie mit einem Haushalt,
-- ein paar Vertraegen und einer abgeschlossenen Beratung samt Protokoll.
--
-- Die Daten entstehen im Anwendungscode ueber dieselben Wege wie echte
-- Daten - nur das Kennzeichen und das Aufraeumen stehen hier. Ein
-- zweiter, SQL-eigener Weg, eine Beratung abzuschliessen, waere eine
-- zweite Wahrheit ueber das, was ein Abschluss bedeutet.

alter table customers
  add column if not exists is_demo boolean not null default false;

create index if not exists customers_demo_idx
  on customers (organization_id) where is_demo;

/**
 * Demodaten wieder entfernen.
 *
 * Als Funktion und nicht als Folge von DELETEs im Anwendungscode, weil
 * daran Snapshots und Unterschriften haengen. Die tragen absichtlich
 * keine Delete-Policy: ein abgeschlossenes Protokoll ist unveraenderlich.
 * Fuer erfundene Kunden gilt das nicht - aber die Ausnahme gehoert an
 * genau eine Stelle, eng gefasst und nachlesbar, statt als Loch in der
 * Policy.
 *
 * Geloescht wird ausschliesslich, was in der eigenen Firma liegt UND als
 * Demo gekennzeichnet ist. Beide Bedingungen stehen in jeder Anweisung.
 */
create or replace function public.remove_demo_data()
  returns int
  language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := public.auth_org_id();
  v_n   int;
begin
  if v_org is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if not public.can_delete('customers') then
    raise exception 'Keine Berechtigung, Demodaten zu entfernen' using errcode = '42501';
  end if;

  -- advice_sessions.customer_id steht auf ON DELETE RESTRICT: die
  -- Beratungen muessen zuerst weg. Alles daran Haengende - Themen,
  -- Notizen, Snapshot, Unterschrift, Befehlsprotokoll, Vorsorgeanalyse -
  -- geht per Cascade mit.
  delete from public.advice_sessions s
   where s.organization_id = v_org
     and s.customer_id in (select c.id from public.customers c
                            where c.organization_id = v_org and c.is_demo);

  delete from public.customers c
   where c.organization_id = v_org and c.is_demo;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function public.remove_demo_data() is
  'Entfernt die Demodaten der eigenen Firma samt Beratungen. Nur fuer Rollen mit Loeschrecht.';

select public.apply_tenant_rls();
select public.assert_rls_complete();
