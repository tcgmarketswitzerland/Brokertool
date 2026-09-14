import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, safeId } from '@/lib/logger';

/**
 * Einstiegspunkt fuer alle Links aus Supabase-Mails: Bestaetigung der
 * Registrierung, Passwort zuruecksetzen, Magic Link.
 *
 * Route Handler statt Seite, weil hier ein Code gegen eine Sitzung getauscht
 * und anschliessend weitergeleitet wird - ohne dass etwas gerendert werden
 * muesste.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(`${origin}/anmelden?fehler=link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.info('auth_callback_failed', { reason: safeId(error.code ?? 'unknown') });
    return NextResponse.redirect(`${origin}/anmelden?fehler=link`);
  }

  // Nur eigene Pfade zulassen: ein offener Weiterleitungsparameter waere
  // eine Phishing-Bruecke auf eine fremde Domain.
  const target =
    type === 'recovery' ? '/passwort-neu'
    : next?.startsWith('/') && !next.startsWith('//') ? next
    : '/dashboard';

  return NextResponse.redirect(`${origin}${target}`);
}
