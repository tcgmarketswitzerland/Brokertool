import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Erneuert die Supabase-Sitzung bei jeder Anfrage.
 *
 * Die erfahrungsgemaess fehleranfaellige Stelle: die aktualisierten Cookies
 * muessen sowohl auf das Request- als auch auf das Response-Objekt
 * geschrieben werden. Fehlt das eine, laufen Server Components mit einem
 * abgelaufenen Token; fehlt das andere, erreicht die Erneuerung den Browser
 * nicht (Architektur 7.4).
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
}> {
  let response = NextResponse.next({ request });
  const env = clientEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() statt getSession(): nur getUser prueft das Token gegen den
  // Auth-Server. getSession liest es blind aus dem Cookie.
  const { data } = await supabase.auth.getUser();
  return { response, userId: data.user?.id ?? null };
}
