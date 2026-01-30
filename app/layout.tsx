import 'prismjs/themes/prism-tomorrow.css'
import './globals.css'
import RootLayoutClient from './RootLayoutClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { Analytics } from '@vercel/analytics/react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
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
            function updateThemeColor(theme) {
              // CSS 변수에서 현재 배경색을 자동으로 읽어와서 PWA theme-color 설정
              // 이렇게 하면 CSS에서 배경색을 변경해도 자동으로 반영됨
              const computedStyle = getComputedStyle(document.documentElement);
              const backgroundColor = computedStyle.getPropertyValue('--background').trim();
              
              // CSS 변수가 설정되지 않은 경우 기본값 사용
              const themeColor = backgroundColor || (theme === 'dark' ? '#161617' : '#ffffff');
              
              let themeColorMeta = document.querySelector('meta[name="theme-color"]');
              if (!themeColorMeta) {
                themeColorMeta = document.createElement('meta');
                themeColorMeta.setAttribute('name', 'theme-color');
                document.head.appendChild(themeColorMeta);
              }
              themeColorMeta.setAttribute('content', themeColor);
            }

            function getInitialTheme() {
              // DISABLED: Theme controls removed - always use system theme
              // const savedTheme = localStorage.getItem('theme');
              // if (savedTheme && savedTheme !== 'system') return savedTheme;
              
              // 시스템 테마 감지 (항상 시스템 테마만 사용)
              if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
              }
              return 'light';
            }
            
            const theme = getInitialTheme();
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeColor(theme);
            
            // 시스템 테마 변경 감지 (항상 시스템 테마만 사용)
            if (window.matchMedia) {
              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                // DISABLED: Theme controls removed - always use system theme
                // const savedTheme = localStorage.getItem('theme');
                // if (!savedTheme || savedTheme === 'system') {
                  const newTheme = e.matches ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', newTheme);
                  updateThemeColor(newTheme);
                // }
              });
            }

            // 테마 변경 이벤트 감지 (테마 토글 시)
            document.addEventListener('DOMContentLoaded', function() {
              const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const currentTheme = document.documentElement.getAttribute('data-theme');
                    updateThemeColor(currentTheme);
                  }
                });
              });
              
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
              });
            });
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
      </head>
      <body className={inter.className}>
        <RootLayoutClient>
          {children}
          <PWAInstallPrompt />
          <Analytics />
        </RootLayoutClient>
      </body>
    </html>
  )
}