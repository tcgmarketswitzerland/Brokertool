-- Einrichtung und Sitzungsdiagnose
--
-- Zwei Luecken, die beide dasselbe Bild erzeugen: angemeldet, aber die
-- Anwendung ist leer - und das sieht wie ein Fehler aus, obwohl die
-- Sicherheitsregeln genau richtig arbeiten.
--
--   1. Ist in Supabase die E-Mail-Bestaetigung eingeschaltet (Standard),
--      liefert signUp keine Sitzung. Die Firma wurde deshalb nie angelegt,
--      denn create_organization lief nur im Zweig mit sofortiger Sitzung.
--
--   2. Auch wenn die Firma entsteht, wurde das Zugriffstoken davor
--      ausgestellt. Es traegt die Mandantenkennung noch nicht, bis es
--      erneuert wird.
--
-- Beides laesst sich in der Anwendung nur beheben, wenn sie die Lage
-- ueberhaupt erkennen kann. Genau dafuer ist diese Funktion da. Sie muss
-- SECURITY DEFINER sein: ohne Mandantenkennung im Token sperren die
-- Policies auch den Blick auf die eigene Mitgliedschaft.

create or replace function public.session_bootstrap()
  returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    -- Besteht ueberhaupt eine aktive Mitgliedschaft?
    'has_membership', exists (
      select 1 from public.organization_members m
       where m.user_id = auth.uid() and m.is_active),
    -- Steht sie auch im Token? Ist das eine wahr und das andere nicht,
    -- ist das Token veraltet oder der Access-Token-Hook nicht aktiviert.
    'claim_org', public.auth_org_id()
  );
$$;

comment on function public.session_bootstrap() is
  'Sagt der Anwendung, ob eine Firma eingerichtet ist und ob das Token sie kennt.';

revoke all on function public.session_bootstrap() from public;
grant execute on function public.session_bootstrap() to authenticated;

select public.assert_rls_complete();
