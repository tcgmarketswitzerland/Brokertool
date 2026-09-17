import type { Metadata, Viewport } from 'next';
import { ThemeScript } from '@/components/theme/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Brokertool', template: '%s · Brokertool' },
  description: 'Digitales Sales- und Beratungstool für Versicherungsbroker',
  applicationName: 'Brokertool',
  // iOS liest das Manifest nur halb: Name, Startverhalten und Symbol auf
  // dem Home-Bildschirm kommen von diesen Angaben.
  appleWebApp: {
    capable: true,
    title: 'Brokertool',
    // 'default' laesst die Statusleiste lesbar, statt sie unter den
    // Seiteninhalt zu schieben.
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    // Sonst macht iOS aus Policennummern und Betraegen Telefonlinks.
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Zoom bleibt erlaubt: Sperren waere ein Barrierefreiheitsfehler,
  // gerade bei einem Werkzeug, das Kunden mitlesen.
  width: 'device-width',
  initialScale: 1,
  // 'cover' laesst die Seite bis unter Notch und Home-Indikator laufen;
  // die Abstaende holt das Layout ueber env(safe-area-inset-*) zurueck.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00778e' },
    { media: '(prefers-color-scheme: dark)', color: '#00657d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
