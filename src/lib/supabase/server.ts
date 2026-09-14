import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Server-Client fuer Server Components, Server Actions und Route Handler.
 * Verwendet ebenfalls den publishable Key - die Absicherung liegt in den
 * RLS-Policies, nicht darin, welchen Schluessel der Server benutzt.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = clientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // In Server Components ist Schreiben nicht erlaubt. Die Middleware
            // erneuert die Sitzung, deshalb ist das hier unkritisch.
          }
        },
      },
    },
  );
}
