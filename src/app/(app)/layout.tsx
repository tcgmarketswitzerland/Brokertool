import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase, CheckSquare, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Logo } from '@/components/ui';
import { signOut } from '@/features/auth/actions';

// Alles hinter der Anmeldung ist strikt dynamisch. Tenant-Daten duerfen nie
// in den Full Route Cache geraten (Architektur 4.1).
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/dashboard', label: 'Übersicht', Icon: LayoutDashboard },
  { href: '/kunden', label: 'Kunden', Icon: Users },
  { href: '/beratungen', label: 'Beratungen', Icon: FileText },
  { href: '/aufgaben', label: 'Aufgaben', Icon: CheckSquare },
  { href: '/vertraege', label: 'Verträge', Icon: Briefcase },
  { href: '/einstellungen', label: 'Einstellungen', Icon: Settings },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/anmelden');

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr]">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="rounded-md text-ink"><Logo /></Link>

          <nav aria-label="Hauptnavigation" className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <Icon aria-hidden className="size-4" strokeWidth={2} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>

        {/* Auf schmalen Geraeten wandert die Navigation in eine scrollbare Leiste.
            Das Smartphone ist nachrangig, muss aber bedienbar bleiben. */}
        <nav aria-label="Hauptnavigation" className="flex gap-0.5 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-muted"
            >
              <Icon aria-hidden className="size-4" strokeWidth={2} />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
