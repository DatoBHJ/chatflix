import { Metadata } from 'next'
import './globals.css'
import RootLayoutClient from './RootLayoutClient'

export const metadata: Metadata = {
  title: 'DeepSeek Chat',
  description: 'Chat with multiple AI models',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
      </body>
    </html>
  )
}
