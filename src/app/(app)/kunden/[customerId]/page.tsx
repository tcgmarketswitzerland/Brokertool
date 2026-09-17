import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui';
import { StartSessionButton } from '@/features/advice/start-session-button';
import { CUSTOMER_TYPE_LABEL } from '@/domain/customer/types';
import { getCustomer } from '@/features/customers/queries';
import { listInsurers, listPolicies } from '@/features/policies/queries';
import { listTopicOptions } from '@/features/policies/topic-options';
import { PolicySection } from '@/features/policies/policy-section';
import { CustomerSettingsForm } from '@/features/customers/customer-settings-form';
import { PersonCard } from '@/features/customers/person-card';
import { listCustomerTasks } from '@/features/tasks/queries';
import { TaskPanel } from '@/features/tasks/components/task-panel';

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

  const [policies, insurers, topics, tasks] = await Promise.all([
    listPolicies(customerId), listInsurers(), listTopicOptions(),
    listCustomerTasks(customerId),
  ]);
  const today = new Date().toISOString().slice(0, 10);

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
          <StartSessionButton customerId={customer.id} />
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
        <CardHeader>
          <CardTitle>Bestehende Verträge</CardTitle>
          <CardDescription>
            Versicherer und Prämie genügen. Deckungen, Selbstbehalte und Policennummern
            erfasst das Backoffice später nach.
          </CardDescription>
        </CardHeader>
        <PolicySection
          customerId={customer.id}
          policies={policies}
          topics={topics}
          insurers={insurers}
          persons={customer.persons.map((p) => ({
            id: p.id, name: `${p.firstName} ${p.lastName}`,
          }))}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aufgaben</CardTitle>
          <CardDescription>
            Was aus den Gesprächen offen ist — auf beiden Seiten. Beim Abschluss einer
            Beratung entstehen diese Aufgaben aus den Ergebnissen.
          </CardDescription>
        </CardHeader>
        <TaskPanel
          tasks={tasks}
          today={today}
          customerId={customer.id}
          emptyText="Keine offenen Aufgaben zu diesem Kunden."
        />
      </Card>

      <Card>
        <CardHeader><CardTitle>Einstellungen</CardTitle></CardHeader>
        <CardContent><CustomerSettingsForm customer={customer} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datenschutz</CardTitle>
          <CardDescription>
            Verlangt dieser Kunde Auskunft über seine Daten, laden Sie hier alles herunter,
            was über ihn gespeichert ist — einschliesslich interner Notizen. Das schreibt
            das Datenschutzgesetz so vor (Art. 25 revDSG).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary">
            <a href={`/kunden/${customer.id}/auskunft`} download>
              <Download aria-hidden />Auskunft herunterladen
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
