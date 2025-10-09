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
import { SquarePencil, BubbleChat, Chevron } from 'react-ios-icons'


function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated, isAnonymous } = useAuth()
  const [userName, setUserName] = useState('You')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isPromptEditMode, setIsPromptEditMode] = useState(false)
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

  const toggleSidebar = useCallback(() => {
    // Only toggle for mobile to prevent pinning on desktop
    if (isMobile) {
      setIsSidebarOpen(prev => !prev)
    }
  }, [isMobile])

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

  const shouldShowSidebar = isMobile ? isSidebarOpen : isHovering
  useEffect(() => {
    if (!shouldShowSidebar) {
      setIsSelectionMode(false)
    }
  }, [shouldShowSidebar])

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
  // const shouldShowSidebar = isMobile ? isSidebarOpen : (isHovering || isSidebarOpen)

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, isAccountOpen, setIsAccountOpen, isHovering, isMobile, isSelectionMode, setIsSelectionMode, isPromptEditMode, setIsPromptEditMode }}>
            <div className="flex h-screen bg-background text-foreground overflow-x-hidden" style={{ minHeight: '100dvh' }}>
      
      {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* 다크모드 전용 글라스 필터 */}
          <filter id="glass-distortion-dark" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="4" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g-dark' cx='50%25' cy='50%25' r='80%25'><stop offset='0%25' stop-color='white'/><stop offset='100%25' stop-color='black'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g-dark)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="0.8" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.4" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

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
                className="fixed left-0 top-0 w-4 h-screen z-[70]"
                onMouseEnter={() => handleSidebarHover(true)}
                onMouseLeave={() => handleSidebarHover(false)}
              />
            )}
            
            {/* Always visible sidebar for mobile and desktop */}
            <div 
              className={`fixed left-0 top-0 h-screen z-50 transform transition-all duration-300 sm:duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                shouldShowSidebar ? 'translate-x-0' : '-translate-x-full'
              } ${isMobile ? 'w-full' : 'w-80'}`}
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
              <div className="fixed top-2.5 sm:top-2 left-3 sm:left-3 z-[60] flex items-center gap-2">
                <button
                  onClick={() => {
                    if (shouldShowSidebar) {
                      setIsSelectionMode(p => !p)
                    } else {
                      toggleSidebar() // This will now only work on mobile
                    }
                  }}
                  className={`text-[var(--foreground)] rounded-full flex items-center justify-center group cursor-pointer ${isSelectionMode ? '' : 'p-[6px] md:p-[4px]'}`}
                  title="Toggle sidebar"
                  aria-label="Toggle sidebar"
                  onMouseEnter={() => !isMobile && handleSidebarHover(true)}
                  onMouseLeave={() => !isMobile && handleSidebarHover(false)}
                  style={{
                    willChange: 'left, background-color, border, box-shadow',
                    outline: '0 !important',
                    WebkitTapHighlightColor: 'transparent',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    // 편집 모드가 아닐 때만 글래스 스타일 적용
                    ...(isSelectionMode ? {
                      background: 'transparent',
                      border: '1px solid transparent', // Add a transparent border to prevent flickering
                      boxShadow: 'none',
                      backdropFilter: 'none',
                      WebkitBackdropFilter: 'none',
                    } : (document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      background: 'transparent',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {
                      background: 'transparent',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    }))
                  }}
                >
                 {shouldShowSidebar ? (
                    isSelectionMode ? (
                      <div 
                        className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer"
                        style={{
                          color: 'white',
                          backgroundColor: '#007AFF',
                          border: '1px solid #007AFF',
                          boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                        }}
                        title="Done editing"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    ) : (
                        <div className="flex items-center justify-center w-9 h-5 rounded-full">
                          <span className="text-sm text-[var(--foreground)]">Edit</span>
                        </div>
                    )
                  ) : (
                  //   <svg className="w-5 h-5 md:w-5 md:h-5 transition-all duration-300" width="18" height="18" viewBox="0 0 18 18">
                  //   <polyline id="globalnav-menutrigger-bread-bottom" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" points="2 12, 16 12" className="globalnav-menutrigger-bread globalnav-menutrigger-bread-bottom">
                  //     <animate id="globalnav-anim-menutrigger-bread-bottom-open" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 2 12, 16 12; 2 9, 16 9; 3.5 15, 15 3.5"></animate>
                  //     <animate id="globalnav-anim-menutrigger-bread-bottom-close" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 3.5 15, 15 3.5; 2 9, 16 9; 2 12, 16 12"></animate>
                  //   </polyline>
                  //   <polyline id="globalnav-menutrigger-bread-top" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" points="2 5, 16 5" className="globalnav-menutrigger-bread globalnav-menutrigger-bread-top">
                  //     <animate id="globalnav-anim-menutrigger-bread-top-open" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 2 5, 16 5; 2 9, 16 9; 3.5 3.5, 15 15"></animate>
                  //     <animate id="globalnav-anim-menutrigger-bread-top-close" attributeName="points" keyTimes="0;0.5;1" dur="0.24s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.42, 0, 1, 1;0, 0, 0.58, 1" values=" 3.5 3.5, 15 15; 2 9, 16 9; 2 5, 16 5"></animate>
                  //   </polyline>
                  // </svg>
                  //   <BubbleChat type="multiple" className="w-5 h-5 md:w-5 md:h-5 transition-all duration-300" />
                    <div 
                      className="w-5 h-5 md:w-5 md:h-5 transition-all duration-300" 
                      style={{ transform: 'rotate(90deg)' }}
                    >
                      <Chevron direction="down" className="w-full h-full" />
                    </div>

                   )}
                </button>

                {/* Prompt Edit Button */}
                {displayUser && pathname === '/' && !shouldShowSidebar && (
                  <button
                    onClick={() => {
                      if (displayUser.id === 'anonymous') {
                        alert('Please sign in to edit prompts');
                        return;
                      }
                      setIsPromptEditMode(p => !p);
                    }}
                    className="flex items-center justify-center px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform duration-200 cursor-pointer"
                    style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        // backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        // backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Edit prompts"
                    type="button"
                    aria-label="Edit prompts"
                  >
                    <span className="text-sm text-[var(--foreground)]">Edit</span>
                  </button>
                )}
              </div>
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