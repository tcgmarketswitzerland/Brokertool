import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui';
import { formatCHF, rappen } from '@/domain/shared/money';
import { monthlyTotalCents, SEAT_PRICE_CENTS } from '@/domain/billing/plan';
import { getBillingOverview } from '@/features/billing/queries';
import { PaymentMethodForm } from '@/features/billing/payment-method-form';
import { currentMember } from '@/features/members/queries';

export const metadata: Metadata = { title: 'Konto' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [overview, me] = await Promise.all([getBillingOverview(), currentMember()]);
  const isOwner = me?.role === 'OWNER';
  const total = monthlyTotalCents(overview.activeSeats);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl">Konto</h1>
        <p className="text-sm text-ink-muted">Zugänge und Abrechnung Ihrer Brokerfirma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
          <CardDescription>
            {formatCHF(rappen(SEAT_PRICE_CENTS))} je Zugang und Monat. Gezählt werden aktive
            Zugänge — eine Einladung, die niemand einlöst, kostet nichts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ['Aktive Zugänge', String(overview.activeSeats)],
              ['Je Zugang', formatCHF(rappen(SEAT_PRICE_CENTS))],
              ['Im Monat', formatCHF(rappen(total))],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface px-4 py-3">
                <dt className="text-[0.8125rem] text-ink-muted">{label}</dt>
                <dd className="tabular mt-0.5 text-xl">{value}</dd>
              </div>
            ))}
          </dl>

          <Button asChild variant="secondary" className="w-fit">
            <Link href="/einstellungen/benutzer">
              Berater verwalten<ChevronRight aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zahlungsmittel</CardTitle>
          <CardDescription>
            Kreditkarte, PayPal oder Apple Pay. Die Zahlungsdaten selbst nimmt der
            Zahlungsanbieter entgegen — Brokertool speichert sie nie.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* Solange kein Anbieter verbunden ist, waere eine Ansicht, die
              nach einer Kartennummer fragt, eine Luege. */}
          <Alert tone="warning" title="Der Zahlungsanbieter ist noch nicht verbunden">
            Sie können hier schon festhalten, womit Sie zahlen möchten. Die Belastung wird
            eingerichtet, sobald die Anbindung steht — bis dahin wird nichts abgebucht.
          </Alert>

          {isOwner ? (
            <PaymentMethodForm method={overview.paymentMethod} />
          ) : (
            <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
              Die Abrechnung führt der Inhaber des Kontos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
