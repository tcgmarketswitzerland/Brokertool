import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { AcceptInvitationForm } from '@/features/members/accept-invitation-form';

export const metadata: Metadata = { title: 'Einladung' };
export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!token) {
    return (
      <div className="grid gap-5">
        <h1 className="text-2xl">Einladung</h1>
        <Alert tone="danger" title="Link unvollständig">
          In diesem Link fehlt das Einladungstoken. Bitten Sie um eine neue Einladung.
        </Alert>
      </div>
    );
  }

  // Angemeldet sein ist Voraussetzung: die Einladung wird der eingeladenen
  // E-Mail-Adresse zugeordnet, nicht dem Link. Wer noch kein Konto hat,
  // legt zuerst eines mit genau dieser Adresse an.
  if (!data.user) {
    const back = `/einladung?token=${encodeURIComponent(token)}`;
    return (
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <h1 className="text-2xl">Einladung annehmen</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Melden Sie sich zuerst mit der Adresse an, an die die Einladung gerichtet ist.
            Ein anderes Konto kann sie nicht einlösen.
          </p>
        </div>
        <div className="grid gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href={{ pathname: '/anmelden', query: { weiter: back } }}>Anmelden</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href={{ pathname: '/registrieren' }}>Konto erstellen</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <h1 className="text-2xl">Einladung annehmen</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Angemeldet als <span className="font-medium text-ink">{data.user.email}</span>.
          Die Einladung wird nur angenommen, wenn sie an genau diese Adresse gerichtet ist.
        </p>
      </div>
      <AcceptInvitationForm token={token} />
    </div>
  );
}
