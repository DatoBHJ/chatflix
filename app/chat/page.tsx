'use client'

import { useSearchParams } from 'next/navigation'
import ChatInterface from '@/app/chat/components/ChatInterface'

export default function ChatPage() {
  const searchParams = useSearchParams()
  // key="new-chat"을 사용하여 /chat/[id]에서 /chat으로 이동 시 
  // React가 ChatInterface를 완전히 새로 마운트하도록 강제
  return <ChatInterface key="new-chat" />
}

