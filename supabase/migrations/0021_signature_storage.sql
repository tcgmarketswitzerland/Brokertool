-- Phase 6 - Unterschrift als Datei (ADR-001)
--
-- Die Unterschrift ist ein Bild und gehoert nicht in die Datenbank: als
-- base64 in einer Spalte blaeht sie jede Abfrage auf, die die Tabelle
-- anfasst, und laesst sich nicht mit einer ablaufenden URL ausliefern.
--
-- Der Pfad traegt die Mandantenkennung als erstes Segment. Das ist keine
-- Bequemlichkeit, sondern die einzige Angabe, an der die Storage-Policy
-- die Zugehoerigkeit pruefen kann - storage.objects hat keine
-- organization_id.

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists signatures_read on storage.objects;
create policy signatures_read on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

drop policy if exists signatures_write on storage.objects;
create policy signatures_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.has_permission('advice:sign')
  );

-- Kein Update, kein Delete: eine Unterschrift, die sich ueberschreiben
-- laesst, belegt nichts. Loeschen bleibt der Aufbewahrungsfrist
-- vorbehalten und laeuft ueber den Service-Schluessel.

comment on policy signatures_read on storage.objects is
  'Unterschriften nur innerhalb der eigenen Organisation lesbar (Pfadpraefix).';
