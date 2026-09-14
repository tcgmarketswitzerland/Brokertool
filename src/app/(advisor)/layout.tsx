import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Beratungsmodus (Konzeptpunkt 25).
 *
 * Eigene Route Group statt eines Zustandsflags in der App-Shell: so kann
 * kein Navigationselement durchsickern, der Modus hat eigene Lade- und
 * Fehlerzustaende, und er ist als Vollbild direkt verlinkbar.
 *
 * data-density="advisor" schaltet die groessere Dichtestufe ein - einmal
 * zentral, nicht als punktuelle Klassen in zwanzig Komponenten.
 */
export const dynamic = 'force-dynamic';

export default async function AdvisorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/anmelden');

  return (
    <div data-density="advisor" className="min-h-dvh bg-bg">
      {children}
    </div>
  );
}
