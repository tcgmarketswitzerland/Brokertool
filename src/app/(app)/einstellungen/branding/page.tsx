import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { getOrganization } from '@/features/organization/queries';
import { BrandingForm } from '@/features/organization/branding-form';

export const metadata: Metadata = { title: 'Branding' };
export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const organization = await getOrganization();
  if (!organization) notFound();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Branding</h1>
        <p className="text-sm text-ink-muted">Wie Ihr Beratungsprotokoll aussieht.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logo und Hausfarbe</CardTitle>
          <CardDescription>
            Das Logo steht oben rechts auf dem Protokoll, die Hausfarbe färbt Linien und
            Überschriften. Ohne beides bleibt das Dokument schwarzweiss — was es nicht
            schlechter macht.
          </CardDescription>
        </CardHeader>
        <CardContent><BrandingForm organization={organization} /></CardContent>
      </Card>
    </div>
  );
}
