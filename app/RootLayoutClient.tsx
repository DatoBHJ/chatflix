'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { useRouter, usePathname } from 'next/navigation'

import { Header } from './components/Header'
import Announcement from './components/Announcement'
import useAnnouncement from './hooks/useAnnouncement'
import { fetchUserName } from '@/app/components/AccountDialog'
import { Toaster } from 'sonner'
import { SidebarContext } from './lib/SidebarContext'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'
import { handleDeleteAllChats as deleteAllChats } from './lib/chatUtils'

import { Pin } from 'lucide-react'
import { SquarePencil } from 'react-ios-icons'


function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated, isAnonymous } = useAuth()
  const [userName, setUserName] = useState('You')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { announcements, showAnnouncement, hideAnnouncement } = useAnnouncement()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createSupabaseClient()

  // Delete all chats function using common utility
  const handleDeleteAllChats = useCallback(async () => {
    await deleteAllChats({ user, router, supabase })
  }, [user, router, supabase])

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

  // 사용자 이름 업데이트
  useEffect(() => {
    if (user) {
      const supabase = createSupabaseClient();
      fetchUserName(user.id, supabase).then(name => setUserName(name));
      
      // 🚀 로그인된 상태로 초기 진입한 경우 웜업 트리거 (fire-and-forget)
      try {
        fetch('/api/chat/warmup', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          keepalive: true
        }).catch(() => {})
      } catch {}
    } else {
      setUserName('You')
    }
  }, [user])

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

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }

  // 🚀 익명 사용자 지원: 익명 사용자도 전체 UI 표시
  // 익명 사용자용 가상 사용자 객체 생성
  const displayUser = user || (pathname !== '/login' ? {
    id: 'anonymous',
    email: 'guest@chatflix.app',
    user_metadata: {
      full_name: 'Guest User',
      name: 'Guest'
    },
    isAnonymous: true
  } : null);

  if (!displayUser && pathname !== '/login') {
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
            <div className="flex h-screen bg-background text-foreground overflow-x-hidden">

      <Toaster position="top-right" richColors />
      <Announcement
        announcements={announcements || []}
        onClose={hideAnnouncement}
      />
        
        {/* Sidebar with hover functionality */}
      {displayUser && (
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
              <Sidebar user={displayUser} toggleSidebar={toggleSidebar} />
            </div>
            
            {/* Delayed background overlay for closing */}
            {isMobile && (
              <div 
                className={`fixed inset-0 mobile-sidebar-backdrop bg-[var(--background-overlay)] backdrop-blur-md z-40 md:hidden transition-opacity duration-300 ease-out ${
                  isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  willChange: 'opacity, backdrop-filter',
                  transitionDelay: isSidebarOpen ? '0ms' : '150ms',
                  WebkitBackdropFilter: 'blur(12px)'
                }}
                onClick={toggleSidebar}
              />
            )}
            
            {/* Always visible toggle button */}
            {!isAccountOpen && (
              <button
                onClick={toggleSidebar}
                className="sidebar-toggle-btn fixed top-1 left-1 z-[60] p-[6px] md:p-[4px] text-[var(--foreground)] rounded-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center group cursor-pointer md:top-0.5"
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
                 <Pin className="w-5 h-5 md:w-5 md:h-5 transition-all duration-300 transform -rotate-45" style={{ strokeWidth: '1.2' }} />
                ) : (
                 <svg className="w-5 h-5 md:w-5 md:h-5 transition-all duration-300" width="18" height="18" viewBox="0 0 18 18">
                   <polyline id="globalnav-menutrigger-bread-bottom" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" points="2 12, 16 12" className="globalnav-menutrigger-bread globalnav-menutrigger-bread-bottom">
                     <animate id="globalnav-anim-menutrigger-bread-bottom-open" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 2 12, 16 12; 2 9, 16 9; 3.5 15, 15 3.5"></animate>
                     <animate id="globalnav-anim-menutrigger-bread-bottom-close" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 3.5 15, 15 3.5; 2 9, 16 9; 2 12, 16 12"></animate>
                   </polyline>
                   <polyline id="globalnav-menutrigger-bread-top" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" points="2 5, 16 5" className="globalnav-menutrigger-bread globalnav-menutrigger-bread-top">
                     <animate id="globalnav-anim-menutrigger-bread-top-open" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 2 5, 16 5; 2 9, 16 9; 3.5 3.5, 15 15"></animate>
                     <animate id="globalnav-anim-menutrigger-bread-top-close" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 3.5 3.5, 15 15; 2 9, 16 9; 2 5, 16 5"></animate>
                   </polyline>
                 </svg>
               )}
              </button>
            )}

            {/* New Chat Button - positioned in header area */}
            {!isAccountOpen && (
                              <button
                  onClick={() => {
                    // 🔧 FIX: 모든 경우에 새 채팅 이벤트 발생 + 필요시 라우팅
                    console.log('🚀 [NEW_CHAT_BUTTON] Clicked from:', pathname);
                    
                    if (pathname === '/') {
                      // 🚀 홈에서는 즉시 새 채팅 이벤트 발생
                      window.dispatchEvent(new CustomEvent('requestNewChat'));
                    } else {
                      // 🚀 채팅창에서는 홈으로 이동 후 새 채팅 이벤트 발생
                      router.push('/');
                      // 라우팅 후 새 채팅 이벤트 발생 (약간의 지연)
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('requestNewChat'));
                      }, 50); // 라우팅 완료 후 이벤트 발생
                    }
                  }}
                className={`fixed top-0.5 z-[60] p-[6px] md:p-[4px] text-[var(--foreground)] rounded-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-center cursor-pointer md:top-0 ${
                  (isHovering || isSidebarOpen) ? 'left-[285px] md:left-[290px]' : 'left-9'
                }`}
                title="New Chat"
                onMouseEnter={() => !isMobile && (isSidebarOpen || isHovering) && handleSidebarHover(true)}
                onMouseLeave={() => !isMobile && (isSidebarOpen || isHovering) && handleSidebarHover(false)}
                style={{
                  willChange: 'left'
                }}
              >
                <SquarePencil className="w-[25px] h-[25px] md:w-[25px] md:h-[25px] scale-90" />
              </button>
            )}
      



          </>
        )}

        {/* Main Content with conditional offset */}
        <div 
          className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            displayUser && shouldShowSidebar ? 'ml-0 md:ml-80' : 'ml-0'
          }`}
          style={{
            willChange: 'margin-left'
          }}
        >
          {/* Header with toggle button */}
          {displayUser && pathname !== '/pricing' && (
            <Header 
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
              user={displayUser} 
              isHovering={isHovering}
              handleDeleteAllChats={handleDeleteAllChats}
            />
          )}
        {children}
      </div>

      
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
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  )
} 