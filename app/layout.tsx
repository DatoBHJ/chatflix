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
  metadataBase: new URL('https://chatflix.app'),
  title: {
    default: 'Chatflix.app - Minimalist AI Chat Interface',
    template: '%s | Chatflix.app'
  },
  description: 'Experience seamless AI conversations with multiple language models. Chatflix.app offers a minimalist interface focused on simplicity and efficiency for natural language interactions, custom prompts, and efficient chat management.',
  keywords: [
    'AI chat',
    'artificial intelligence',
    'language models',
    'chatbot',
    'AI assistant',
    'natural language processing',
    'conversational AI',
    'custom AI prompts',
    'minimalist chat interface',
    'efficient chat management'
  ],
  authors: [{ name: 'Chatflix Team' }],
  creator: 'Chatflix.app',
  publisher: 'Chatflix.app',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://chatflix.app',
    title: 'Chatflix.app - Minimalist AI Chat Interface',
    description: 'Experience seamless AI conversations with multiple language models. Chatflix.app offers a minimalist interface focused on simplicity and efficiency.',
    siteName: 'Chatflix.app',
    images: [{
      url: '/social-preview.png',
      width: 1200,
      height: 630,
      alt: 'Chatflix.app - Minimalist AI Chat Interface'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chatflix.app - Minimalist AI Chat Interface',
    description: 'Experience seamless AI conversations with multiple language models.',
    images: ['/social-preview.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Chatflix.app',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/android-chrome-192x192.png',
    apple: '/apple-touch-icon.png',
  },
  verification: {
    google: 'zbf7941Tv5Ipw2zyr0xlLxDl00K9Zn2ElvrlFPiOYxk', // Google Search Console 인증 코드
  },
  alternates: {
    canonical: 'https://chatflix.app',
  },
}

function ThemeInitScript() {
  return (
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
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <link rel="canonical" href="https://chatflix.app" />
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