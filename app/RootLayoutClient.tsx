'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoading(false)
      setUser(user)
      if (!user) {
        router.push('/login')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null)
      }
    })

    getUser()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="w-full h-screen">
        {children}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Sidebar Toggle Button - Only show when user is authenticated */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-8 left-4 z-40 w-8 h-8 flex items-center justify-center hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        title={isSidebarOpen ? "Close menu" : "Open menu"}
      >
        {isSidebarOpen ? '×' : '≡'}
      </button>

      {/* Sidebar with transition - Only show when user is authenticated */}
      <div 
        className={`fixed left-0 top-0 h-full transition-transform duration-300 ease-in-out z-40 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar user={user} />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
} 