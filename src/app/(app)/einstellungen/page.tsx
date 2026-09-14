import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ChevronRight, Layers, Palette, Users } from 'lucide-react';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Einstellungen' };
export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/einstellungen/benutzer', title: 'Benutzer', Icon: Users, ready: true,
    description: 'Mitarbeitende einladen, Rollen vergeben, Zugänge deaktivieren.' },
  { href: '/einstellungen', title: 'Firma', Icon: Building2, ready: false,
    description: 'Name, Adresse und Zwei-Faktor-Pflicht. Phase 8.' },
  { href: '/einstellungen', title: 'Branding', Icon: Palette, ready: false,
    description: 'Logo und Farbe für das Beratungsprotokoll. Phase 8.' },
  { href: '/einstellungen', title: 'Versicherungssparten', Icon: Layers, ready: false,
    description: 'Welche Sparten Ihre Beratung abdeckt und in welcher Reihenfolge. Phase 8.' },
] as const;

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl">Einstellungen</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map(({ href, title, description, Icon, ready }) => {
          const body = (
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
                <Icon aria-hidden className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-muted">{description}</p>
              </div>
              {ready ? (
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-subtle" />
              ) : null}
            </div>
          );

          return ready ? (
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
