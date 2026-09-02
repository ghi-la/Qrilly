import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Qrilly - Swiss QR-bill invoices',
  description: 'Create, store and send Swiss QR-bill invoices from reusable sender presets.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Qrilly' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#B0293A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
