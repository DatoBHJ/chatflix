import 'prismjs/themes/prism-tomorrow.css'
import './globals.css'
import RootLayoutClient from './RootLayoutClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { Analytics } from '@vercel/analytics/react'
import { Inter } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
}

export const metadata = {
  metadataBase: new URL('https://chatflix.app'),
  title: {
    default: 'Chatflix.app',
    template: '%s | Chatflix.app'
  },
  description: 'Neflix of Chatbots',
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
  authors: [{ name: 'DatoBHJ' }],
  creator: 'DatoBHJ',
  publisher: 'DatoBHJ',
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
    title: 'Chat is this real?',
    description: 'Neflix of Chatbots',
    siteName: 'Chatflix.app',
    images: [{
      url: 'https://chatflix.app/music2.png?v=4',
      width: 1200,
      height: 630,
      alt: 'Chat is this real?'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chat is this real?',
    description: 'Neflix of Chatbots',
    images: ['https://chatflix.app/music2.png?v=4'],
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
        <meta property="og:url" content="https://chatflix.app" />
        <link rel="canonical" href="https://chatflix.app" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1162518265779190"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={inter.className}>
        <RootLayoutClient>
          {children}
          <PWAInstallPrompt />
          <Analytics />
        </RootLayoutClient>
        
        {/* Warmup script */}
        <Script id="model-warmup">{`
          // 앱 로드 시 웜업 API 호출 (딜레이 추가하여 초기 렌더링 방해 최소화)
          setTimeout(() => {
            fetch('/api/warmup')
              .then(res => res.json())
              .then(data => console.log('Model warmup:', data.message))
              .catch(err => console.warn('Warmup failed:', err));
          }, 3000);
        `}</Script>
      </body>
    </html>
  )
}