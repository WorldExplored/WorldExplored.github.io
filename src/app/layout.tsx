import type { Metadata } from 'next';
import { profile } from '@/content/profile';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(profile.siteUrl),
  title: `${profile.name} — ${profile.titleSuffix}`,
  description: `${profile.education}. ${profile.focus} ${profile.metaEvidence}`,
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: `${profile.name} — ${profile.edition}`,
    description: `${profile.education}. ${profile.focus}`,
    type: 'website', url: '/', siteName: profile.name,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${profile.name} — ${profile.focus}` }],
  },
  twitter: { card: 'summary_large_image', title: profile.name, description: profile.focus, images: ['/og-image.jpg'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
