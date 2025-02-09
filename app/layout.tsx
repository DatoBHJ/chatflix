import { Metadata } from 'next'
import './globals.css'

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
        <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
          {children}
        </div>
      </body>
    </html>
  )
}
