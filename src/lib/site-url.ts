import 'server-only';
import { headers } from 'next/headers';

/**
 * Die Adresse, unter der der Nutzer die Anwendung gerade aufruft.
 *
 * Wird fuer die Rueckkehrlinks in Supabase-Mails gebraucht. Aus den
 * Kopfzeilen der Anfrage gelesen und nicht aus einer Umgebungsvariablen:
 * so stimmt der Link auf der Produktivadresse, auf jeder
 * Vorschau-Bereitstellung und lokal - ohne dass irgendwo eine Adresse
 * gepflegt werden muss, die beim naechsten Umzug vergessen wird.
 *
 * Hinter dem Vercel-Proxy steht die echte Adresse in x-forwarded-host;
 * `host` traegt dort den internen Namen. Wer das verwechselt, verschickt
 * Links, die ins Leere zeigen.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto')
    ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}
