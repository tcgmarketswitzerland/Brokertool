import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { sessionState } from '@/features/auth/bootstrap';
import { RefreshForm, SetupForm } from './setup-form';

export const metadata: Metadata = { title: 'Einrichten' };
export const dynamic = 'force-dynamic';

/**
 * Die Weiche nach der Anmeldung.
 *
 * Bewusst ausserhalb des Anwendungsbereichs: die Seite faengt genau die
 * Faelle ab, in denen dort nichts sichtbar waere, und darf deshalb nicht
 * selbst durch dessen Weiche laufen.
 */
export default async function SetupPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/anmelden');

  const state = await sessionState();
  if (state.kind === 'ready') redirect('/dashboard');

  const metadata = auth.user.user_metadata as { full_name?: string } | null;

  if (state.kind === 'needs_organization') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Firma einrichten</CardTitle>
          <CardDescription>
            Noch ein Schritt. Ihr Konto steht, aber es gehört noch zu keiner Firma —
            und ohne sie hätte kein Datensatz einen Eigentümer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm defaultName={metadata?.full_name ?? ''} />
        </CardContent>
      </Card>
    );
  }

  // Firma vorhanden, Token kennt sie nicht.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sitzung erneuern</CardTitle>
        <CardDescription>
          Ihre Firma besteht, aber Ihre Anmeldung ist älter als sie. Eine Erneuerung genügt.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <RefreshForm />
        <Alert tone="warning" title="Bleibt es dabei?">
          Dann ist in Supabase der Access-Token-Hook nicht aktiv: Authentication → Hooks →
          Customize Access Token (JWT) Claims → Funktion{' '}
          <code className="rounded-sm bg-surface-sunken px-1">public.custom_access_token_hook</code>{' '}
          auswählen und einschalten. Ohne ihn weiss die Datenbank bei jeder Abfrage nicht,
          zu welcher Firma Sie gehören — und sperrt korrekterweise alles.
        </Alert>
      </CardContent>
    </Card>
  );
}
