import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase, CalendarClock } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, TopicIcon } from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import { listAllPolicies, listUpcomingCancellations } from '@/features/policies/queries';

export const metadata: Metadata = { title: 'Verträge' };
export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const [policies, upcoming] = await Promise.all([
    listAllPolicies(), listUpcomingCancellations(),
  ]);

  const total = policies.reduce((sum, p) => sum + (p.annualCents ?? 0), 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl">Verträge</h1>
        <p className="tabular text-sm text-ink-muted">
          {policies.length} {policies.length === 1 ? 'Vertrag' : 'Verträge'}
          {total > 0 ? ` · ${formatCHF(rappen(total))} Jahresprämien` : ''}
        </p>
      </div>

      {upcoming.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock aria-hidden className="size-4 text-warning" />
              Bald kündbar
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line">
            {upcoming.map((u) => (
              <li key={u.id}>
                <Link href={`/kunden/${u.customerId}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.customerName}</p>
                    <p className="truncate text-[0.8125rem] text-ink-muted">
                      {u.topicName} · {u.insurerName}
                    </p>
                  </div>
                  <Badge tone="warning" className="tabular">
                    {new Date(u.date).toLocaleDateString('de-CH')}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {policies.length === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-12 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
              <Briefcase aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="font-medium">Noch keine Verträge erfasst</p>
            <p className="mx-auto max-w-sm text-[0.8125rem] leading-relaxed text-ink-muted">
              Bestehende Verträge erfassen Sie beim Kunden — Versicherer und Prämie genügen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-sunken text-left">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Kunde</th>
                  <th className="px-5 py-2.5 font-medium">Sparte</th>
                  <th className="px-5 py-2.5 font-medium">Versicherer</th>
                  <th className="px-5 py-2.5 text-right font-medium">Jahresprämie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {policies.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-5 py-2.5">
                      <Link href={`/kunden/${p.customerId}`} className="rounded-sm font-medium hover:underline">
                        {p.customerName}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <TopicIcon name={p.topicIcon} className="size-4" />
                        {p.topicName}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">{p.insurerName}</td>
                    <td className="px-5 py-2.5 text-right">
                      {p.annualCents ? formatCHF(rappen(p.annualCents)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
