import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from './_components/cookie-consent';

export const metadata: Metadata = {
  title: 'App-Bus — Otobüsü hiç bekleme',
  description: 'Real-time public transport tracker for Istanbul + Ankara',
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
