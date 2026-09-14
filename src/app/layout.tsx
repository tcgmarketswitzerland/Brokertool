import type { Metadata, Viewport } from 'next';
import { ThemeScript } from '@/components/theme/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Brokertool', template: '%s · Brokertool' },
  description: 'Digitales Sales- und Beratungstool für Versicherungsbroker',
  applicationName: 'Brokertool',
};

export const viewport: Viewport = {
  // Zoom bleibt erlaubt: Sperren waere ein Barrierefreiheitsfehler,
  // gerade bei einem Werkzeug, das Kunden mitlesen.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
