// viewport themeColor는 루트 레이아웃에서 동적으로 관리하므로 여기서는 제거
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata = {
  title: 'Chatflix - Login',
  description: 'Login to access all AI models in one place',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 