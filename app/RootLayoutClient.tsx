'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
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
  const pathname = usePathname()
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
      if (!user && pathname !== '/login') {
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
  }, [supabase, router, pathname])

  // announcement for GPT-4.5
  useEffect(() => {
    if (user) {
      // showAnnouncement(
      //   "Tip: Gemini 2.0 Flash supports million-token context windows for larger documents and multiple files, with faster processing and improved accuracy (76.4% MMLU, 70.7% MMMU)",
      //   "info",
      //   "Gemini-2-flash-tip"
      // ); 
      // showAnnouncement(
      //   "Due to high demand on anthropic models, there may be some delays in response time. We are working on it. In the meantime, please try other models.",
      //   "warning",
      //   "anthropic-models-high-request-1"
      // ); // 오후 8시 14분 
      // showAnnouncement(
      //   "File uploads have been temporarily disabled due to an ongoing issue with file reading. We expect to restore this functionality soon.",
      //   "error",
      //   "file-read-disabled"
      // );
      // showAnnouncement(
      //   "New model QwQ-32B is now available! It's a powerful reasoning model that excels at mathematical reasoning, coding, and complex-problem solving with performance rivaling the likes of DeepSeek-R1 and o1-mini.",
      //   "info",
      //   "new-model-qwq-32b"
      // );
      // Code for a major update warning announcement
      showAnnouncement(
        "We're currently rolling out a major system update. You may experience temporary issues, bugs, or service interruptions during this period. Our team is actively monitoring and addressing any problems that arise. Thank you for your patience and understanding.",
        "warning",
        "major-update-in-progress"
      );
    }
  }, [user, showAnnouncement]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }

  if (!user && pathname !== '/login') {
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
      {user && (
        <Header 
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={toggleSidebar}
          user={user}
        />
      )}
      
      {/* Sidebar with improved transition */}
      {user && (
        <div 
          className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-out z-40 ${
            isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
          }`}
        >
          <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Overlay with improved transition */}
      {user && (
        <div
          className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-300 ease-out z-30 ${
            isSidebarOpen 
              ? 'opacity-30 pointer-events-auto' 
              : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {user && <PromptShortcutsDialog user={user} />}
    </div> //
  )
} 