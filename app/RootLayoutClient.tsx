'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { PromptShortcutsDialog } from './components/PromptShortcutsDialog'
import { Header } from './components/Header'
import Announcement from './components/Announcement'
import useAnnouncement from './hooks/useAnnouncement'

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
  const { announcement, showAnnouncement, hideAnnouncement, isVisible } = useAnnouncement()

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev)
  }

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

  // announcement for GPT-4.5
  useEffect(() => {
    if (user) {
      showAnnouncement(
        "Tip: Gemini 2.0 Flash supports million-token context windows for larger documents and multiple files, with faster processing and improved accuracy (76.4% MMLU, 70.7% MMMU)",
        "info",
        "Gemini-2-flash-tip"
      );
      // showAnnouncement(
      //   "File uploads have been temporarily disabled due to an ongoing issue with file reading. We expect to restore this functionality soon.",
      //   "error",
      //   "file-read-disabled"
      // );
    }
  }, [user, showAnnouncement]);

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
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)] overflow-x-hidden">
      <Announcement
        message={announcement?.message || ''}
        type={announcement?.type || 'info'}
        isVisible={isVisible}
        onClose={hideAnnouncement}
      />
      <Header 
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
      />
      
      {/* Sidebar with improved transition */}
      <div 
        className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-out z-40 ${
          isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
      >
        <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Overlay with improved transition */}
      <div
        className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-300 ease-out z-30 ${
          isSidebarOpen 
            ? 'opacity-30 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {user && <PromptShortcutsDialog user={user} />}
    </div>
  )
} 