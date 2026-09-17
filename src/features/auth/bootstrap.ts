import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type SessionState =
  /** Alles in Ordnung: Firma vorhanden und im Token. */
  | { kind: 'ready' }
  /** Angemeldet, aber noch keine Firma - der Weg nach der Bestaetigungsmail. */
  | { kind: 'needs_organization' }
  /**
   * Firma vorhanden, Token kennt sie nicht. Entweder ist das Token aelter
   * als die Mitgliedschaft, oder der Access-Token-Hook ist im
   * Supabase-Dashboard nicht aktiviert.
   */
  | { kind: 'stale_token' }
  /**
   * Die Datenbank konnte nicht antworten - meist eine fehlende Migration.
   *
   * Dieser Fall muss getrennt bleiben. Als "keine Firma" behandelt, wuerde
   * der Nutzer aufgefordert, eine Firma anzulegen, die er laengst hat -
   * und landete nach jedem Versuch wieder auf derselben Seite, ohne je zu
   * erfahren, woran es liegt.
   */
  | { kind: 'unknown'; message: string };

/**
 * Der Zustand der Sitzung, bevor irgendeine Seite Daten laedt.
 *
 * Ohne diese Unterscheidung sehen alle Faelle gleich aus: eine leere
 * Anwendung. Das ist die teuerste Art von Fehler - sie sieht nach einem
 * Programmfehler aus, obwohl die Sicherheitsregeln genau richtig
 * arbeiten, und kostet jeden neuen Nutzer eine Stunde Suchen.
 */
export async function sessionState(): Promise<SessionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('session_bootstrap');

  if (error) {
    return {
      kind: 'unknown',
      message: /session_bootstrap|does not exist|schema cache/i.test(error.message)
        ? 'Die Datenbank kennt die Funktion session_bootstrap noch nicht. '
          + 'Es fehlt die Migration 0021 — bitte supabase/bundles/0018-0021.sql einspielen.'
        : error.message,
    };
  }

  const state = (data ?? {}) as { has_membership?: boolean; claim_org?: string | null };
  if (!state.has_membership) return { kind: 'needs_organization' };
  if (!state.claim_org) return { kind: 'stale_token' };
  return { kind: 'ready' };
}
