-- Phase 7 - Dokumente in der Spartenansicht
--
-- Bisher hing ein Dokument am Kunden, an einer Police oder an einer
-- Beratung. Im Gespraech wird es aber in einer Sparte gebraucht: der
-- Berater oeffnet "Hausrat" und will die Police sehen, die dort erfasst
-- ist - nicht die Dokumentenliste des ganzen Kunden durchsuchen.
--
-- Die Spalte ist bewusst optional und ohne Pflichtbezug: ein Ausweis
-- gehoert zum Kunden und zu keiner Sparte.

alter table documents
  add column if not exists topic_id uuid references insurance_topics(id) on delete set null;

create index if not exists documents_topic_idx
  on documents (customer_id, topic_id)
  where deleted_at is null and topic_id is not null;

-- Ein Dokument, das im Gespraech hochgeladen wurde, darf danach nicht mehr
-- verschwinden: das Protokoll verweist darauf. Geloescht wird weich, und
-- auch das erst nach dem Abschluss nicht mehr.
drop trigger if exists trg_freeze_documents on documents;
create trigger trg_freeze_documents before update on documents
  for each row when (new.session_id is not null)
  execute function public.prevent_completed_session_changes();

select public.apply_tenant_rls();
select public.assert_rls_complete();
