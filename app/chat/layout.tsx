// 채팅 레이아웃 (사이드바 포함)
'use client'

import { Sidebar } from '../components/Sidebar'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      {children}
    </div>
  )
} 