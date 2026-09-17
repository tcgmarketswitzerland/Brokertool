import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CircleCheck, FileText, ListTodo } from 'lucide-react';
import { Button, Logo } from '@/components/ui';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Brokertool — strukturierte Beratung, nachvollziehbar dokumentiert',
};
export const dynamic = 'force-dynamic';

/**
 * Die Eingangstuer.
 *
 * Bewusst keine Marketingseite: Brokertool wird verkauft, nicht gefunden.
 * Wer hier landet, ist entweder angemeldet - dann gehoert er sofort in die
 * Anwendung - oder er hat einen Zugang und sucht die Anmeldung.
 */
const POINTS = [
  {
    Icon: CircleCheck,
    title: 'Kein Bereich wird vergessen',
    text: 'Jede Sparte braucht ein Ergebnis, bevor sich ein Gespräch abschliessen lässt — '
      + 'auch „der Kunde möchte keine Beratung".',
  },
  {
    Icon: FileText,
    title: 'Das Protokoll entsteht nebenbei',
    text: 'Aus dem Gespräch, nicht danach. Eingefroren mit Prüfsumme, damit ein Ausdruck in '
      + 'fünf Jahren noch belegt, was besprochen wurde.',
  },
  {
    Icon: ListTodo,
    title: 'Folgeaufgaben ohne Nacharbeit',
    text: 'Was zu tun bleibt, ergibt sich aus den Ergebnissen. Für den Berater und für den Kunden.',
  },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Wer angemeldet ist, will arbeiten und keine Startseite lesen.
  if (data.user) redirect('/dashboard');

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
      <header className="safe-top safe-x flex items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/anmelden">Anmelden</Link>
          </Button>
        </div>
      </header>

      <main className="safe-x mx-auto flex w-full max-w-3xl flex-col justify-center px-6 py-10">
        <h1 className="text-balance text-[2rem] leading-[1.15] sm:text-[2.75rem]">
          Führen Sie das Gespräch.
          <span className="block text-ink-muted">Die Dokumentation entsteht dabei.</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-ink-muted">
          Brokertool führt Sie strukturiert durch ein Beratungsgespräch und erzeugt daraus ein
          nachvollziehbares Protokoll und die Folgeaufgaben. Für unabhängige
          Versicherungsbroker in der Schweiz.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/anmelden">Anmelden<ArrowRight aria-hidden /></Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/registrieren">Konto erstellen</Link>
          </Button>
        </div>

        <ul className="mt-14 grid gap-7 sm:grid-cols-3 sm:gap-6">
          {POINTS.map(({ Icon, title, text }) => (
            <li key={title} className="grid gap-1.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <Icon aria-hidden className="size-[18px]" strokeWidth={1.9} />
              </span>
              <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
              <p className="text-[0.8125rem] leading-relaxed text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="safe-bottom safe-x px-6 py-6 text-[0.8125rem] text-ink-subtle">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1">
          <span>Daten in der Schweiz gehostet · Verarbeitung in der EU</span>
          <Link href="/design" className="ml-auto rounded-sm hover:text-ink-muted">
            Gestaltung
          </Link>
        </div>
      </footer>
    </div>
  );
}
