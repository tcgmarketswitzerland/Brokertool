import type { Metadata } from 'next';
import {
  ArrowRight, Check, CircleDashed, CircleDot, CircleSlash,
  Clock, MinusCircle, Plus, Search,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import {
  Alert, Badge, Button, Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle, Input, Logo,
} from '@/components/ui';

export const metadata: Metadata = { title: 'Designsystem' };

/**
 * Referenzseite fuer das Designsystem. Zeigt alle Bausteine in beiden
 * Farbschemata auf einer Seite - damit Abweichungen auffallen, bevor sie
 * sich ueber zwanzig Ansichten verteilen.
 */

const STATUS = [
  { label: 'Nicht besprochen', color: 'var(--status-not-started)', Icon: CircleDashed },
  { label: 'In Bearbeitung', color: 'var(--status-progress)', Icon: CircleDot },
  { label: 'Kein Handlungsbedarf', color: 'var(--status-no-action)', Icon: Check },
  { label: 'Handlungsbedarf', color: 'var(--status-action)', Icon: MinusCircle },
  { label: 'Kunde lehnt ab', color: 'var(--status-declined)', Icon: CircleSlash },
  { label: 'Wiedervorlage', color: 'var(--status-follow-up)', Icon: Clock },
] as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line pt-8">
      <div className="grid gap-1">
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.07em] text-ink-subtle">
          {title}
        </h2>
        {note ? <p className="max-w-prose text-sm leading-relaxed text-ink-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-10">
        <div className="grid gap-2">
          <h1 className="text-3xl">Designsystem</h1>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-muted">
            Grundlage aller Ansichten. Umschalten oben rechts — jeder Baustein muss in beiden
            Schemata gleich gut lesbar sein.
          </p>
        </div>

        <Section
          title="Typografie"
          note="Inter, selbst gehostet. Überschriften enger gesetzt, Beträge mit Tabellenziffern, damit Prämien in einer Spalte fluchten."
        >
          <Card>
            <CardContent className="grid gap-4">
              <p className="text-3xl">Beratung vom 15. September 2026</p>
              <p className="text-xl">Versorgungslücke bei Erwerbsunfähigkeit</p>
              <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-muted">
                Der Kunde wurde auf die bestehende Vorsorgelücke hingewiesen und wünscht aktuell
                ausdrücklich keine weitere Beratung zu diesem Thema.
              </p>
              <div className="grid max-w-xs gap-1 text-sm">
                {[['Bedarf', "100'000"], ['Gedeckt', "70'000"], ['Lücke', "30'000"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-line py-1 last:border-0">
                    <span className="text-ink-muted">{k}</span>
                    <span className="tabular font-medium">CHF {v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Beratungsstatus"
          note="Jeder Status trägt Farbe UND Symbol. Farbe allein ist für einen relevanten Teil der Nutzer nicht unterscheidbar — und das Rad wird dem Kunden gezeigt."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS.map(({ label, color, Icon }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: color, color: 'var(--surface)' }}
                >
                  <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Schaltflächen" note="Genau eine kräftige Aktion pro Ansicht.">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Beratung starten<ArrowRight aria-hidden /></Button>
            <Button variant="secondary"><Plus aria-hidden />Kunde erfassen</Button>
            <Button variant="ghost">Abbrechen</Button>
            <Button variant="danger">Löschen</Button>
            <Button variant="link">Mehr erfahren</Button>
            <Button loading>Speichert</Button>
            <Button disabled>Nicht verfügbar</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Klein</Button>
            <Button size="md">Mittel</Button>
            <Button size="lg">Gross — Beratungsmodus</Button>
          </div>
        </Section>

        <Section title="Formular" note="Beschriftung, Hinweis und Fehler sind über aria-describedby verbunden.">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Kunde erfassen</CardTitle>
              <CardDescription>Name und Geburtsdatum genügen — alles andere im Gespräch.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <label htmlFor="d-search" className="text-[0.8125rem] font-medium">Suche</label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
                  <Input id="d-search" className="pl-8.5" placeholder="Name oder Policennummer" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="d-name" className="text-[0.8125rem] font-medium">Nachname</label>
                <Input id="d-name" defaultValue="Muster" />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="d-err" className="text-[0.8125rem] font-medium">E-Mail</label>
                <Input id="d-err" aria-invalid defaultValue="max.muster" aria-describedby="d-err-msg" />
                <p id="d-err-msg" role="alert" className="text-[0.8125rem] text-danger">
                  Keine gültige E-Mail-Adresse.
                </p>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="ghost" size="sm">Abbrechen</Button>
              <Button size="sm">Speichern</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Kennzeichnungen und Hinweise">
          <div className="flex flex-wrap gap-2">
            <Badge>Entwurf</Badge>
            <Badge tone="accent">Offerte gewünscht</Badge>
            <Badge tone="success">Abgeschlossen</Badge>
            <Badge tone="warning">Bald kündbar</Badge>
            <Badge tone="danger">Überfällig</Badge>
          </div>
          <div className="grid gap-2">
            <Alert tone="info" title="Beratung wird lokal gesichert">
              Änderungen werden übertragen, sobald wieder eine Verbindung besteht.
            </Alert>
            <Alert tone="warning" title="3 Pflichtbereiche offen">
              Vorsorge, Rechtsschutz und Cyber brauchen ein Ergebnis, bevor die Beratung
              abgeschlossen werden kann.
            </Alert>
            <Alert tone="danger" title="Beratung bereits abgeschlossen">
              Eine abgeschlossene Beratung ist unveränderlich. Änderungen erzeugen eine neue Version.
            </Alert>
          </div>
        </Section>
      </main>
    </div>
  );
}
