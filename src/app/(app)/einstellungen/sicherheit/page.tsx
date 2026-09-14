import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { listMfaFactors } from '@/features/security/queries';
import { MfaSetup } from '@/features/security/mfa-setup';

export const metadata: Metadata = { title: 'Sicherheit' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const factors = await listMfaFactors();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Sicherheit</h1>
        <p className="text-sm text-ink-muted">Wie Ihr Konto geschützt ist.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zwei-Faktor-Anmeldung</CardTitle>
          <CardDescription>
            Zusätzlich zum Passwort ein zeitbasierter Code aus einer Authenticator-App.
          </CardDescription>
        </CardHeader>
        <CardContent><MfaSetup factors={factors} /></CardContent>
      </Card>
    </div>
  );
}
