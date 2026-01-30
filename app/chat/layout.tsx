import ChatLayoutClient from './ChatLayoutClient'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ChatLayoutClient>{children}</ChatLayoutClient>
} 