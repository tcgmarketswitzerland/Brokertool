import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Wie viele Demokunden es gibt.
 *
 * RLS zeigt einem Berater nur die eigenen - fuer den Hinweis "Sie sehen
 * Demodaten" ist genau das richtig: gemeint ist, was er sieht.
 */
export async function countDemoCustomers(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('is_demo', true)
    .is('deleted_at', null);
  return count ?? 0;
}
