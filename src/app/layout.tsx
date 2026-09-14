import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brokertool',
  description: 'Digitales Sales- und Beratungstool fuer Versicherungsbroker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>{children}</body>
    </html>
  );
}
