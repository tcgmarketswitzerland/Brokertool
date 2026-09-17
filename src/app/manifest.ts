import type { MetadataRoute } from 'next';

/**
 * Das Web-App-Manifest.
 *
 * Damit laesst sich Brokertool auf iPad und iPhone ueber "Zum Home-Bildschirm"
 * installieren und startet danach ohne Browserleiste - im Gespraech ist das
 * der Unterschied zwischen einem Werkzeug und einer geoeffneten Website.
 *
 * Zugleich ist es die Vorarbeit fuer eine spaetere App-Store-Fassung: ein
 * nativer Rahmen (Capacitor) laedt dieselbe Anwendung, Symbole, Name und
 * Startverhalten stehen dann bereits fest (ADR-007).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brokertool',
    short_name: 'Brokertool',
    description: 'Strukturierte Beratung mit nachvollziehbarer Dokumentation.',
    lang: 'de-CH',
    start_url: '/dashboard',
    // Die Anmeldung faengt ab, wer nicht angemeldet ist. Ein start_url auf
    // die Startseite waere ein Klick mehr bei jedem Oeffnen.
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fbfbfc',
    theme_color: '#00778e',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Kunden', url: '/kunden' },
      { name: 'Beratungen', url: '/beratungen' },
      { name: 'Aufgaben', url: '/aufgaben' },
    ],
  };
}
