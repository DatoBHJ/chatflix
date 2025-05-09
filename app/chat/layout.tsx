// 채팅 레이아웃 (사이드바 포함)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 