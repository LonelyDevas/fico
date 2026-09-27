import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import DevOverlayClient from '@/components/DevOverlayClient'
import InitialLoader from '@/components/InitialLoader'
import DevDomGuard from '@/components/DevDomGuard'

import './ionic-theme.css'
import ThemeInitializer from '@/components/ThemeInitializer'

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css'

/* Basic CSS for apps built with Ionic */

/* Optional CSS utils */

import './globals.css'
import DevErrorOverlay from '@/components/DevErrorOverlay'
import { Agentation } from 'agentation'
// Using global fonts from `globals.css` instead of next/font to allow
// the repo's configured font stack (Inter + Poppins) to take effect.

export const metadata: Metadata = {
  title: {
    template: '%s | Fico',
    default: 'Fico - Money Management Made Simple',
  },
  description: 'Fico is a comprehensive financial management application that helps you track transactions, manage budgets, and take control of your finances.',
  keywords: ['finance', 'budgeting', 'money-tracking', 'financial-management', 'personal-finance', 'wallet'],
  authors: [{ name: 'Fico Team' }],
  icons: {
    icon: '/FicoLogoTrans1.png',
    shortcut: '/FicoLogoTrans1.png',
    apple: '/FicoLogoTrans1.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fico',
  },
  other: {
    // Next only emits the unprefixed `mobile-web-app-capable` tag for
    // appleWebApp.capable; iOS Safari's standalone-launch detection still
    // needs the legacy prefixed tag to reliably skip the browser chrome.
    'apple-mobile-web-app-capable': 'yes',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Fico - Money Management Made Simple',
    description: 'Fico is a comprehensive financial management application that helps you track transactions, manage budgets, and take control of your finances.',
    siteName: 'Fico',
    images: [
      {
        url: '/FicoLogoTrans1.png',
        width: 1200,
        height: 630,
        alt: 'Fico Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fico - Money Management Made Simple',
    description: 'Fico is a comprehensive financial management application that helps you track transactions, manage budgets, and take control of your finances.',
    images: ['/FicoLogoTrans1.png'],
  },
}

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: 'device-width',
  viewportFit: 'cover',
  themeColor: '#0066CC',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Suppress hydration warnings on the root <html> element. Some browser
    // extensions (e.g. Night Eye) or client-only scripts may mutate the
    // document before React hydrates, causing spurious mismatch errors.
    // This tells React to ignore attribute mismatches here.
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeInitializer />
        {process.env.NODE_ENV === 'development' && (
          <>
            {/* Dev overlay to show client runtime errors (visible only in development) */}
            {/* <DevOverlayClient /> */}
            {/* DEBUG: temporary visible marker to verify server-rendered HTML */}
            {/* <div style={{ position: 'fixed', top: 8, right: 8, background: '#ff0', color: '#000', padding: '6px 8px', zIndex: 9999, borderRadius: 4 }}>SSR OK</div> */}
            {/* <DevDomGuard /> */}
            <Agentation />
          </>
        )}
        <InitialLoader />
        {children}
      </body>
      {/* <Script type="module" src="https://unpkg.com/ionicons@7.0.0/dist/ionicons/ionicons.esm.js" strategy="lazyOnload" /> */}
      {/* <Script noModule src="https://unpkg.com/ionicons@7.0.0/dist/ionicons/ionicons.js" strategy="lazyOnload" /> */}
    </html>
  )
}
