import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Logo } from '@/components/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="rounded-md text-ink"><Logo /></Link>
        <ThemeToggle />
      </header>

      <main className="flex items-start justify-center px-6 py-4 sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-6 py-5 text-center text-[0.8125rem] text-ink-subtle">
        Daten in der Schweiz gehostet · Verarbeitung in der EU
      </footer>
    </div>
  );
}
