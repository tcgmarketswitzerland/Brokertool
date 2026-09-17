import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Auskunftsbegehren beantworten (revDSG Art. 25).
 *
 * Eine betroffene Person darf wissen, welche Daten ueber sie bearbeitet
 * werden. Das von Hand aus acht Tabellen zusammenzusuchen dauert eine
 * Stunde und wird dabei unvollstaendig - deshalb steht es hier als
 * Funktion.
 *
 * Gelesen wird mit den Rechten des angemeldeten Benutzers. Die
 * Mandantenregeln gelten also unveraendert: wer den Kunden nicht sehen
 * darf, bekommt eine leere Auskunft und keine fremde.
 *
 * Bewusst ohne interne Notizen? Nein - sie gehoeren dazu. Das
 * Auskunftsrecht umfasst alles, was ueber die Person bearbeitet wird,
 * auch was der Berater nur fuer sich notiert hat. Wer das nicht
 * herausgeben will, darf es nicht aufschreiben.
 */

export type CustomerExport = {
  erstelltAm: string;
  hinweis: string;
  kunde: unknown;
  personen: unknown[];
  adressen: unknown[];
  einwilligungen: unknown[];
  vertraege: unknown[];
  beratungen: unknown[];
  notizen: unknown[];
  aufgaben: unknown[];
  vorsorgeanalysen: unknown[];
  dokumente: unknown[];
  protokolle: unknown[];
  unterschriften: unknown[];
};

export async function exportCustomer(customerId: string): Promise<CustomerExport | null> {
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from('customers').select('*').eq('id', customerId).maybeSingle();
  if (!customer) return null;

  const of = async (table: string, column = 'customer_id') => {
    const { data } = await supabase.from(table).select('*').eq(column, customerId);
    return data ?? [];
  };

  const beratungen = await of('advice_sessions');
  const sessionIds = beratungen.map((s) => String((s as { id: unknown }).id));

  const bySession = async (table: string) => {
    if (sessionIds.length === 0) return [];
    const { data } = await supabase.from(table).select('*').in('session_id', sessionIds);
    return data ?? [];
  };

  return {
    erstelltAm: new Date().toISOString(),
    hinweis:
      'Auskunft nach Art. 25 des Schweizer Datenschutzgesetzes. Enthält alle zu dieser '
      + 'Person gespeicherten Daten, einschliesslich interner Notizen.',
    kunde: customer,
    personen: await of('customer_persons'),
    adressen: await of('customer_addresses'),
    einwilligungen: await of('consents'),
    vertraege: await of('policies'),
    beratungen,
    notizen: await of('notes'),
    aufgaben: await of('tasks'),
    vorsorgeanalysen: await of('pension_analyses'),
    dokumente: await of('documents'),
    protokolle: await bySession('advice_session_snapshots'),
    unterschriften: await bySession('signatures'),
  };
}
