'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push('/chat')
  }, [router])

  return null  // 또는 로딩 상태를 표시할 수 있음
}
