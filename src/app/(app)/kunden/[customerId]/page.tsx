import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui';
import { CUSTOMER_TYPE_LABEL } from '@/domain/customer/types';
import { getCustomer } from '@/features/customers/queries';
import { CustomerSettingsForm } from '@/features/customers/customer-settings-form';
import { PersonCard } from '@/features/customers/person-card';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ customerId: string }>;
}): Promise<Metadata> {
  const { customerId } = await params;
  const customer = await getCustomer(customerId);
  return { title: customer?.displayName ?? 'Kunde' };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  const hasPrimary = customer.persons.some((p) => p.personRole === 'PRIMARY');

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Link href="/kunden"
              className="flex w-fit items-center gap-1.5 rounded-sm text-[0.8125rem] text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />Kunden
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl">{customer.displayName}</h1>
            <Badge>{CUSTOMER_TYPE_LABEL[customer.customerType]}</Badge>
          </div>
          <Button disabled>
            <FileText aria-hidden />Neue Beratung
          </Button>
        </div>
      </div>

      {!hasPrimary ? (
        <Alert tone="warning" title="Keine Hauptperson">
          Dieser Kunde hat keine Hauptperson. Legen Sie eine an, damit der Name stimmt.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Personen</CardTitle>
          <CardDescription>
            Hausrat und Haftpflicht gehören dem Haushalt, Vorsorge und Erwerbsunfähigkeit
            einer einzelnen Person. Deshalb werden sie hier getrennt geführt.
          </CardDescription>
        </CardHeader>

        <div>
          {customer.persons.map((p) => (
            <PersonCard key={p.id} customerId={customer.id} person={p} />
          ))}
          <PersonCard customerId={customer.id} />
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Einstellungen</CardTitle></CardHeader>
        <CardContent><CustomerSettingsForm customer={customer} /></CardContent>
      </Card>
    </div>
  );
}
