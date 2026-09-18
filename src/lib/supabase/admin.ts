import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger, safeId } from '@/lib/logger';

/**
 * Die einzige Stelle im Projekt, die den geheimen Supabase-Schluessel liest (frueher service_role) (Regel R3,
 * Architektur 8.5). Er umgeht RLS vollstaendig - damit haengt
 * die gesamte Mandantentrennung wieder nur am Anwendungscode, genau das,
 * was Konzeptpunkt 19 ausschliesst.
 *
 * Erzwungen durch scripts/check-service-role.mjs, das den gesamten Baum
 * scannt, und durch die ESLint-Ausnahme in eslint.config.mjs.
 */

/** Abgeschlossene Liste der Aufgaben, die diesen Client verwenden duerfen. */
export type AdminReason =
  | 'organization:create'   // Registrierung: es existiert noch keine Mitgliedschaft
  | 'invitation:accept'     // Einladung einloesen, bevor der Claim gesetzt ist
  | 'webhook:inbound'       // eingehende Webhooks haben keinen Nutzerkontext
  | 'maintenance:job'       // Wartungsjobs ohne angemeldeten Nutzer
  // Ablage von Kundendokumenten. Storage-Richtlinien setzen Eigentum an
  // storage.objects voraus, das ein Supabase-Projekt nicht hergibt - die
  // Zugriffspruefung liegt deshalb vor dem Aufruf, in der Route, und
  // laeuft dort ueber RLS auf documents.
  | 'document:storage';

const schema = z.object({
  url: z.string().url(),
  serviceRoleKey: z.string().min(20),
});

let cached: SupabaseClient | null = null;

/**
 * Liefert einen Client, der RLS umgeht. Jeder Aufruf muss einen Grund
 * angeben und wird protokolliert - ohne Nutzdaten, nur Grund und Aufrufer.
 */
export function createAdminClient(reason: AdminReason, actorUserId?: string): SupabaseClient {
  const parsed = schema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SECRET_KEY,
  });

  if (!parsed.success) {
    // Bewusst ohne Werte: eine Fehlermeldung darf kein Secret enthalten.
    throw new Error('Supabase-Admin-Client ist nicht konfiguriert');
  }

  logger.warn('admin_client_used', {
    reason: safeId(reason),
    actor: actorUserId ? safeId(actorUserId) : null,
  });

  cached ??= createClient(parsed.data.url, parsed.data.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
