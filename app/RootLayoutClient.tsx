'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { PromptShortcutsDialog } from './components/PromptShortcutsDialog'
import { Header } from './components/Header'
import Announcement from './components/Announcement'
import useAnnouncement from './hooks/useAnnouncement'
import { fetchUserName } from '@/app/components/AccountDialog'
import { Toaster } from 'sonner'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('You')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { announcements, showAnnouncement, hideAnnouncement } = useAnnouncement()

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev)
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        setIsLoading(false)
        
        if (user) {
          const name = await fetchUserName(user.id, supabase);
          setUserName(name);
        }
        
        if (!user && pathname !== '/login') {
          router.push('/login')
        }
      } catch (error) {
        console.error('Error loading user information:', error)
        setIsLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserName('You')
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null)
        if (session?.user) {
          fetchUserName(session.user.id, supabase).then(name => setUserName(name));
        }
      }
    })

    getUser()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

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
      <Toaster position="top-right" richColors />
      <Announcement
        announcements={announcements || []}
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
          <Sidebar 
            user={user} 
            onClose={() => setIsSidebarOpen(false)} 
          />
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
    </div>
  )
} 