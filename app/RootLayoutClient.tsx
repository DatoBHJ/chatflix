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
import { SidebarContext } from './lib/SidebarContext'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('You')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { announcements, showAnnouncement, hideAnnouncement } = useAnnouncement()

  // 화면 크기에 따른 사이드바 초기 상태 설정
  useEffect(() => {
    const handleResize = () => {
      // 데스크톱(768px 이상)에서만 사이드바를 자동으로 열기
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true)
      } else {
        setIsSidebarOpen(false)
      }
    }

    // 초기 로드시 화면 크기 체크
    handleResize()

    // 윈도우 리사이즈 이벤트 리스너 추가
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

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
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, isAccountOpen, setIsAccountOpen }}>
    <div className="flex h-screen bg-background dark:bg-transparent text-[var(--foreground)] overflow-x-hidden">
      <Toaster position="top-right" richColors />
      <Announcement
        announcements={announcements || []}
        onClose={hideAnnouncement}
      />
        
        {/* Sidebar with toggle functionality */}
      {user && (
          <>
            {/* Overlay for mobile when sidebar is open */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                onClick={toggleSidebar}
                style={{
                  willChange: 'opacity'
                }}
        />
      )}
      
            {/* Sidebar */}
            <div 
              className={`fixed left-0 top-0 h-full z-50 transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              style={{
                willChange: 'transform'
              }}
            >
              <Sidebar user={user} />
            </div>

            {/* Unified Sidebar Toggle Button */}
            {!isAccountOpen && (
              <button
                onClick={toggleSidebar}
                className={`sidebar-toggle-btn fixed top-5 z-[60] p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/50 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center group ${
                  isSidebarOpen 
                    ? 'left-[280px]' 
                    : 'left-3'
                }`}
                title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                style={{
                  willChange: 'left, background-color, border, box-shadow',
                  outline: '0 !important',
                  border: '0 !important',
                  boxShadow: 'none !important',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  background: 'transparent',
                  borderRadius: '0.5rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300 group-hover:scale-110">
                  <path d={isSidebarOpen ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}></path>
                </svg>
              </button>
            )}
          </>
        )}

        {/* Main Content with conditional offset */}
        <div 
          className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            user && isSidebarOpen ? 'ml-0 md:ml-80' : 'ml-0'
          }`}
          style={{
            willChange: 'margin-left'
          }}
        >
          {/* Header with toggle button */}
          {user && (
            <Header 
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
            user={user} 
          />
      )}
        {children}
      </div>

      {user && <PromptShortcutsDialog user={user} />}
      <div id="portal-root"></div>
    </div>
    </SidebarContext.Provider>
  )
}


export default function RootLayoutClient({
  children
}: {
  children: React.ReactNode
}) {
  return <LayoutContent>{children}</LayoutContent>
} 