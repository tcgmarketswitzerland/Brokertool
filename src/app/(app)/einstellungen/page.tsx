import type { Metadata, Route } from 'next';
import Link from 'next/link';
import {
  Building2, ChevronRight, CreditCard, Layers, Palette, ShieldCheck, Users,
} from 'lucide-react';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Einstellungen' };
export const dynamic = 'force-dynamic';

// Was noch nicht fertig ist, hat kein Ziel - statt einer Kachel, die auf
// diese Seite zurueckfuehrt.
//
// Die Annotation ist noetig, weil Link sein Ziel aus dem uebergebenen
// Literal ableitet. Aus einer Liste heraus sieht es nur die Vereinigung
// aller Eintraege und weist sie zurueck.
const SECTIONS: ReadonlyArray<{
  href: Route | null;
  title: string;
  description: string;
  Icon: typeof Users;
}> = [
  { href: '/einstellungen/benutzer', title: 'Benutzer', Icon: Users,
    description: 'Mitarbeitende einladen, Rollen vergeben, Zugänge deaktivieren.' },
  { href: '/einstellungen/sicherheit', title: 'Sicherheit', Icon: ShieldCheck,
    description: 'Zwei-Faktor-Anmeldung für Ihr Konto einrichten.' },
  { href: '/einstellungen/firma', title: 'Firma', Icon: Building2,
    description: 'Name, Adresse und Zwei-Faktor-Pflicht.' },
  { href: '/einstellungen/branding', title: 'Branding', Icon: Palette,
    description: 'Logo und Farbe für das Beratungsprotokoll.' },
  { href: '/einstellungen/konto', title: 'Konto', Icon: CreditCard,
    description: 'Zugänge, monatlicher Betrag und Zahlungsmittel.' },
  { href: '/einstellungen/sparten', title: 'Versicherungssparten', Icon: Layers,
    description: 'Welche Sparten Ihre Beratung abdeckt und in welcher Reihenfolge.' },
] as const;

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl">Einstellungen</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map(({ href, title, description, Icon }) => {
          const body = (
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
                <Icon aria-hidden className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-muted">{description}</p>
              </div>
              {href ? (
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-subtle" />
              ) : null}
            </div>
          );

          return href ? (
            <Card key={title} className="transition-colors hover:bg-surface-hover">
              <Link href={href} className="block rounded-lg">{body}</Link>
            </Card>
          ) : (
            <Card key={title} className="opacity-60">{body}</Card>
          );
        })}
      </div>
    </div>
  );
}
