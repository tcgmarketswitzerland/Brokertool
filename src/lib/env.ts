import { z } from 'zod';

/**
 * Einzige Stelle, an der Umgebungsvariablen gelesen werden (Architektur 14).
 * Fehlkonfiguration faellt beim Start auf, nicht als undefined zur Laufzeit.
 */

/**
 * Der service_role-Key steht bewusst NICHT in diesem Schema: eine Funktion,
 * die ihn zurueckgibt, macht ihn fuer jeden Aufrufer verfuegbar und hebelt
 * Regel R3 aus. Er wird ausschliesslich in lib/supabase/admin.ts gelesen.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function parse<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>, scope: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
    // Bewusst nur Feldnamen, nie Werte: eine Fehlermeldung darf kein Secret enthalten.
    throw new Error(`Ungueltige ${scope}-Umgebungsvariablen: ${fields}`);
  }
  return result.data;
}

/** Nur auf dem Server verwenden. */
export const serverEnv = (): z.infer<typeof serverSchema> =>
  parse(serverSchema, process.env as Record<string, string | undefined>, 'Server');

/** Sicher fuer den Browser: enthaelt ausschliesslich NEXT_PUBLIC_-Werte. */
export const clientEnv = (): z.infer<typeof clientSchema> =>
  parse(clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }, 'Client');
