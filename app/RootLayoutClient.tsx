'use client'

import { useState, useEffect, useRef } from 'react'
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
import { SquarePencil } from 'react-ios-icons'
import { Pin } from 'lucide-react'
import Link from 'next/link'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('You')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { announcements, showAnnouncement, hideAnnouncement } = useAnnouncement()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 화면 크기에 따른 사이드바 초기 상태 설정
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // 모바일에서는 사이드바를 닫힌 상태로 시작
      if (mobile) {
        setIsSidebarOpen(false)
      } else {
        // 데스크탑에서는 항상 숨겨진 상태로 시작
        setIsSidebarOpen(false)
        setIsHovering(false)
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

  // 데스크탑에서 호버 상태 관리
  const handleSidebarHover = (isHover: boolean) => {
    if (isMobile) return

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    if (isHover) {
      setIsHovering(true)
    } else {
      // 호버가 끝나면 약간의 지연 후 사이드바를 숨김
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovering(false)
      }, 100)
    }
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

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

  // 데스크탑에서는 호버 상태 또는 사이드바 열림 상태에 따라, 모바일에서는 isSidebarOpen 상태에 따라 사이드바 표시
  const shouldShowSidebar = isMobile ? isSidebarOpen : (isHovering || isSidebarOpen)

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, isAccountOpen, setIsAccountOpen, isHovering, isMobile }}>
    <div className="flex h-screen bg-background dark:bg-transparent text-[var(--foreground)] overflow-x-hidden">

      <Toaster position="top-right" richColors />
      <Announcement
        announcements={announcements || []}
        onClose={hideAnnouncement}
      />
        
        {/* Sidebar with hover functionality */}
      {user && (
          <>


            {/* Hover trigger area for desktop */}
            {!isMobile && (
              <div 
                className="fixed left-0 top-0 w-4 h-full z-[70]"
                onMouseEnter={() => handleSidebarHover(true)}
                onMouseLeave={() => handleSidebarHover(false)}
              />
            )}
            
            {/* Always visible sidebar for mobile and desktop */}
            <div 
              className={`fixed left-0 top-0 h-full z-50 transform transition-all duration-300 sm:duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                shouldShowSidebar ? 'translate-x-0' : '-translate-x-full'
              }`}
              style={{
                willChange: 'transform'
              }}
              onMouseEnter={() => handleSidebarHover(true)}
              onMouseLeave={() => handleSidebarHover(false)}
            >
              <Sidebar user={user} toggleSidebar={toggleSidebar} />
            </div>
            
            {/* Delayed background overlay for closing */}
            {isMobile && (
              <div 
                className={`fixed inset-0 bg-white/80 dark:bg-black/80 z-40 md:hidden backdrop-blur-md transition-opacity duration-300 ease-out ${
                  isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  willChange: 'opacity, backdrop-filter',
                  transitionDelay: isSidebarOpen ? '0ms' : '150ms'
                }}
                onClick={toggleSidebar}
              />
            )}
            
            {/* Always visible toggle button */}
            {!isAccountOpen && (
              <button
                onClick={toggleSidebar}
                className="sidebar-toggle-btn fixed top-2 left-3 z-[60] p-[5px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/10 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center group"
                title="Toggle sidebar"
                aria-label="Toggle sidebar"
                onMouseEnter={() => !isMobile && handleSidebarHover(true)}
                onMouseLeave={() => !isMobile && handleSidebarHover(false)}
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
               {!isMobile && isSidebarOpen ? (
                 <Pin className="w-5 h-5 transition-all duration-300 transform -rotate-45" />
                ) : (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300">
                   <line x1="3" y1="6" x2="21" y2="6"></line>
                   <line x1="3" y1="12" x2="21" y2="12"></line>
                   <line x1="3" y1="18" x2="21" y2="18"></line>
                 </svg>
               )}
              </button>
            )}

            {/* New Chat Button - positioned in header area */}
            {!isAccountOpen && pathname !== '/' && (
              <Link 
                href="/" 
                className={`fixed top-2 z-[60] p-[5px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/10 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center ${
                  (isHovering || isSidebarOpen) ? 'left-[275px]' : 'left-12'
                }`}
                title="New Chat"
                onMouseEnter={() => !isMobile && (isSidebarOpen || isHovering) && handleSidebarHover(true)}
                onMouseLeave={() => !isMobile && (isSidebarOpen || isHovering) && handleSidebarHover(false)}
                style={{
                  top: '6px',
                  willChange: 'left'
                }}
              >
                <SquarePencil className="w-[26px] h-[26px]" />
              </Link>
            )}
      



          </>
        )}

        {/* Main Content with conditional offset */}
        <div 
          className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            user && shouldShowSidebar ? 'ml-0 md:ml-80' : 'ml-0'
          }`}
          style={{
            willChange: 'margin-left'
          }}
        >
          {/* Header with toggle button */}
          {user && pathname !== '/pricing' && (
            <Header 
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
              user={user} 
              isHovering={isHovering}
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