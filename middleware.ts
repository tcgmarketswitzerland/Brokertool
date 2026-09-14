import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/', '/design', '/anmelden', '/registrieren', '/passwort-vergessen', '/einladung'];

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    || pathname.startsWith('/auth/');

  if (!userId && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/anmelden';
    url.searchParams.set('weiter', pathname);
    return NextResponse.redirect(url);
  }

  if (userId && (pathname === '/anmelden' || pathname === '/registrieren')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Alles ausser statischen Dateien und Bildern.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
