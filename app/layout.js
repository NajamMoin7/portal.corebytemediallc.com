import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { BRAND, PORTAL_URL } from '@/data/site';
import Providers from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  metadataBase: new URL(PORTAL_URL),
  title: {
    default: `${BRAND.portalName} — ${BRAND.name}`,
    template: `%s | ${BRAND.shortName} Portal`,
  },
  description: `Internal order portal for ${BRAND.legalName}.`,
  applicationName: `${BRAND.shortName} Portal`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport = {
  themeColor: '#050506',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-ink text-cream antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
