import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { getOrganization } from '@/features/organization/queries';
import { CompanyForm } from '@/features/organization/company-form';

export const metadata: Metadata = { title: 'Firma' };
export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  const organization = await getOrganization();
  if (!organization) notFound();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Firma</h1>
        <p className="text-sm text-ink-muted">
          Diese Angaben stehen auf jedem Beratungsprotokoll.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Angaben zur Firma</CardTitle>
          <CardDescription>
            Beim Abschluss einer Beratung werden sie unverändert ins Protokoll übernommen. Ein
            Nachdruck zeigt später die Adresse vom Gesprächstag.
          </CardDescription>
        </CardHeader>
        <CardContent><CompanyForm organization={organization} /></CardContent>
      </Card>
    </div>
  );
}
