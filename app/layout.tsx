import './globals.css'
import RootLayoutClient from './RootLayoutClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { Analytics } from '@vercel/analytics/react'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
}

export const metadata = {
  title: 'Chatflix.app',
  description: 'AI Chat Application',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Chatflix.app',
  },
  icons: {
    icon: '/icon-512x512.png',
    shortcut: '/icon-192x192.png',
    apple: '/icon-512x512.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getInitialTheme() {
                  const savedTheme = localStorage.getItem('theme');
                  if (savedTheme) return savedTheme;
                  
                  return 'system';
                }
                
                const theme = getInitialTheme();
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>
        <RootLayoutClient>
          {children}
          <PWAInstallPrompt />
          <Analytics />
        </RootLayoutClient>
      </body>
    </html>
  )
}