import './globals.css'
import RootLayoutClient from './RootLayoutClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'

export const metadata = {
  title: 'Chatflix.app',
  description: 'AI Chat Application',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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
      <body>
        <RootLayoutClient>
          {children}
          <PWAInstallPrompt />
        </RootLayoutClient>
      </body>
    </html>
  )
}
