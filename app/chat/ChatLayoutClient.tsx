'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChatProvider } from './context/ChatContext'
import { ChatSidebar } from './components/ChatSidebar'
import { SidebarContext } from '@/app/lib/SidebarContext'
import { useAuth } from '@/app/lib/AuthContext'
import { BubbleChat, SquarePencil, Bookmark } from 'react-ios-icons'
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor, getIconClassName } from '@/app/lib/adaptiveGlassStyle'
import { getChatflixLogo } from '@/lib/models/logoUtils'

export default function ChatLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isBookmarkMode, setIsBookmarkMode] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false)
  const prevPathnameRef = useRef<string | null>(null)
  const isPageVisibleRef = useRef<boolean>(true)
  const isInitialMountRef = useRef<boolean>(true)

  // 화면 크기에 따른 사이드바 초기 상태 설정
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      if (mobile) {
        setIsSidebarOpen(false)
      } else {
        setIsSidebarOpen(false)
        setIsHovering(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  // 경로 변경 시 사이드바 상태 제어
  // 모든 채팅 경로(/chat, /chat/[id])에서 사이드바를 닫음
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // 페이지 가시성 추적
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden
    }
    
    const handlePageShow = (e: PageTransitionEvent) => {
      // 백/포워드 네비게이션인 경우 (캐시에서 복원)
      if (e.persisted) {
        isPageVisibleRef.current = true
      }
    }
    
    isPageVisibleRef.current = !document.hidden
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  // 경로 전환 감지: /chat/에서 /chat/[id]로 변경될 때 로딩 오버레이 표시
  // 단, 탭 전환(페이지가 이미 visible 상태)인 경우는 로딩 표시하지 않음
  useEffect(() => {
    const prevPathname = prevPathnameRef.current
    const isFromChatHome = prevPathname === '/chat'
    const isToChatId = pathname.startsWith('/chat/') && pathname !== '/chat'
    
    // 초기 마운트 시에는 이전 경로만 업데이트하고 로딩 표시하지 않음
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      prevPathnameRef.current = pathname
      return
    }
    
    // 🚀 최적화: 탭 전환(동일 경로) 시에는 절대로 로딩 표시하지 않음
    if (prevPathname === pathname) {
      setIsRouteTransitioning(false)
      return
    }
    
    // /chat/에서 /chat/[id]로 전환되는 경우
    if (isFromChatHome && isToChatId) {
      // 🚀 최적화: 이미 세션에서 로드된 적이 있는 채팅이면 로딩 표시하지 않음
      if (typeof window !== 'undefined') {
        const chatId = pathname.split('/').pop() || ''
        const loadedChats = JSON.parse(sessionStorage.getItem('loaded_chats') || '{}')
        if (loadedChats[chatId]) {
          setIsRouteTransitioning(false)
          prevPathnameRef.current = pathname
          return
        }
      }

      // 페이지가 이미 visible 상태이고 탭 전환인 경우는 로딩 표시하지 않음
      // 새로고침이나 처음 로드되는 경우에만 로딩 표시
      if (isPageVisibleRef.current && prevPathname !== null) {
        // 탭 전환으로 인한 경로 변경이므로 로딩 표시하지 않음
        setIsRouteTransitioning(false)
      } else {
        // 실제로 새로고침이나 처음 로드되는 경우
        setIsRouteTransitioning(true)
        // 짧은 딜레이 후 로딩 상태 해제 (실제 페이지 로드 대기)
        const timer = setTimeout(() => {
          setIsRouteTransitioning(false)
        }, 100)
        prevPathnameRef.current = pathname
        return () => clearTimeout(timer)
      }
    } else {
      setIsRouteTransitioning(false)
    }
    
    // 이전 경로 업데이트
    prevPathnameRef.current = pathname
  }, [pathname])

  // 데스크탑에서 호버 상태 관리
  const handleSidebarHover = (isHover: boolean) => {
    if (isMobile) return

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    if (isHover) {
      setIsHovering(true)
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovering(false)
      }, 100)
    }
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  const shouldShowSidebar = isMobile ? isSidebarOpen : (isHovering || isSidebarOpen)

  useEffect(() => {
    if (!shouldShowSidebar) {
      setIsSelectionMode(false)
    }
  }, [shouldShowSidebar])

  // 익명 사용자용 가상 사용자 객체 생성
  const displayUser = user || {
    id: 'anonymous',
    email: 'guest@chatflix.app',
    user_metadata: {
      full_name: 'Guest User',
      name: 'Guest'
    },
    isAnonymous: true
  }

  // 메시지 앱 내에서는 배경 이미지가 없음
  const hasBackgroundImage = false

  // 테마 감지
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      setIsDark(isDarkMode)
    }
    
    checkTheme()
    
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkTheme)
    
    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', checkTheme)
    }
  }, [])

  // 배경 이미지 존재 여부에 따른 로고 경로 결정
  const getLogoSrc = () => {
    // 메시지 앱에서는 배경 이미지가 없으므로 theme 기반
    return getChatflixLogo({ isDark })
  }

  // 홈으로 이동하는 함수
  const handleHomeClick = useCallback(() => {
    router.push('/')
  }, [router])

  // 새 채팅 시작하는 함수
  // Next.js App Router의 클라이언트 캐싱으로 인해 router.push만으로는 
  // ChatInterface가 제대로 초기화되지 않는 문제를 해결하기 위해 
  // window.location.href를 사용하여 하드 네비게이션 강제
  const handleNewChatClick = useCallback(() => {
    window.location.href = '/chat'
  }, [])

  // 북마크 모드 토글 함수
  const handleBookmarkToggle = useCallback(() => {
    setIsBookmarkMode(prev => !prev)
  }, [])

  return (
    <ChatProvider>
      <SidebarContext.Provider value={{ 
        isSidebarOpen, 
        toggleSidebar, 
        isAccountOpen, 
        setIsAccountOpen, 
        isHovering, 
        isMobile, 
        isSelectionMode, 
        setIsSelectionMode 
      }}>
        <div className="flex h-screen bg-background text-foreground overflow-x-hidden" style={{ minHeight: '100dvh' }}>
          {/* Hover trigger area for desktop */}
          {!isMobile && (
            <div 
              className="fixed left-0 top-0 w-4 h-screen z-70"
              onMouseEnter={() => handleSidebarHover(true)}
              onMouseLeave={() => handleSidebarHover(false)}
            />
          )}
          
          {/* Sidebar */}
          <div 
            className={`fixed left-0 top-0 h-screen z-50 transform transition-all duration-300 sm:duration-300 ease-in-out ${
              shouldShowSidebar ? 'translate-x-0' : '-translate-x-full'
            } ${isMobile ? 'w-full' : 'w-96'}`}
            style={{
              willChange: 'transform'
            }}
            onMouseEnter={() => handleSidebarHover(true)}
            onMouseLeave={() => handleSidebarHover(false)}
          >
            <ChatSidebar user={displayUser} toggleSidebar={toggleSidebar} isBookmarkMode={isBookmarkMode} />
          </div>

          {/* Desktop background overlay for closing */}
          {!isMobile && (
            <div 
              className={`fixed inset-0 desktop-sidebar-backdrop bg-(--background-overlay) backdrop-blur-lg z-40 hidden md:block transition-opacity duration-300 ease-out ${
                shouldShowSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{
                willChange: 'opacity, backdrop-filter',
                WebkitBackdropFilter: 'blur(12px)'
              }}
              onClick={toggleSidebar}
            />
          )}
          
          {/* Mobile background overlay for closing */}
          {isMobile && (
            <div 
              className={`fixed inset-0 mobile-sidebar-backdrop bg-(--background-overlay) backdrop-blur-md z-40 md:hidden transition-opacity duration-300 ease-out ${
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
          
          {/* Toggle button */}
          {!isAccountOpen && (
            <div 
              className="fixed top-2.5 sm:top-2 left-3 sm:left-3 z-60"
              onMouseEnter={() => !isMobile && handleSidebarHover(true)}
              onMouseLeave={() => !isMobile && handleSidebarHover(false)}
            >
              <button
                onClick={() => {
                  if (shouldShowSidebar) {
                    setIsSelectionMode(p => !p)
                  } else {
                    toggleSidebar()
                  }
                }}
                className={`text-(--foreground) rounded-full flex items-center justify-center group cursor-pointer ${shouldShowSidebar && isSelectionMode ? '' : 'p-[5px] md:p-[4px]'}`}
                title="Toggle sidebar"
                aria-label="Toggle sidebar"
                style={{
                  willChange: 'left, background-color, border, box-shadow',
                  outline: '0 !important',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  // 사이드바가 닫혀있을 때는 항상 글라스 효과 유지
                  // 사이드바가 열려있을 때만 isSelectionMode에 따라 스타일 변경
                  ...(shouldShowSidebar && isSelectionMode ? {
                    background: 'transparent',
                    border: '1px solid transparent',
                    boxShadow: 'none',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                  } : {
                    ...getAdaptiveGlassStyleBlur(),
                    ...getAdaptiveGlassBackgroundColor(),
                  })
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
                    <div className="flex items-center justify-center w-12 h-7 md:w-10 md:h-6 rounded-full">
                      <span className="text-base md:text-sm text-(--foreground)">Edit</span>
                    </div>
                  )
                ) : (
                  <BubbleChat
                    type="multiple"
                    className={`w-[30px] h-[30px] md:w-6 md:h-6 p-0.5 transition-all duration-300 ${getIconClassName(hasBackgroundImage)}`}
                  />
                )}
              </button>
            </div>
          )}

          {/* 북마크 버튼 - 사이드바와 완전 동기화: 좌우 슬라이드(translate-x) + opacity fade + transition(duration-300 ease-in-out) */}
          {!isAccountOpen && (pathname === '/chat' || pathname.startsWith('/chat/')) && (
            <div 
              className={`fixed top-2.5 sm:top-2 z-60 transform transition-all duration-300 ease-in-out ${
                isMobile ? 'right-3' : 'left-84'
              } ${shouldShowSidebar ? 'translate-x-0 opacity-100' : '-translate-x-96 opacity-0 pointer-events-none'}`}
              style={{ willChange: 'transform, opacity' }}
              onMouseEnter={() => !isMobile && handleSidebarHover(true)}
              onMouseLeave={() => !isMobile && handleSidebarHover(false)}
            >
              <button
                onClick={handleBookmarkToggle}
                className={`text-(--foreground) rounded-full flex items-center justify-center group cursor-pointer p-[8px] md:p-[6px]`}
                title={isBookmarkMode ? "Show chat history" : "Show bookmarks"}
                aria-label={isBookmarkMode ? "Show chat history" : "Show bookmarks"}
                style={{
                  willChange: 'background-color, border, box-shadow',
                  outline: '0 !important',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  ...getAdaptiveGlassStyleBlur(),
                  ...getAdaptiveGlassBackgroundColor(),
                }}
              >
                <Bookmark
                  className={`w-6 h-6 md:w-5 md:h-5 transition-all duration-300 ${isBookmarkMode ? 'text-(--foreground)' : ''}`}
                  filled={isBookmarkMode}
                />
              </button>
            </div>
          )}

          {/* 우측 상단 버튼 - 채팅 홈에서는 홈 아이콘, 채팅창에서는 새글 아이콘 */}
          {!isAccountOpen && (pathname === '/chat' || pathname.startsWith('/chat/')) && !shouldShowSidebar && (
            <div className="fixed top-2.5 sm:top-2 right-3 z-60">
              {pathname === '/chat' ? (
                // 채팅 홈: 홈 아이콘 (기존 크기, 아이콘만 중앙 정렬)
                <button
                  onClick={handleHomeClick}
                  className="text-(--foreground) rounded-full flex items-center justify-center group cursor-pointer p-[5px] md:p-[4px]"
                  title="Go to home"
                  aria-label="Go to home"
                style={{
                  willChange: 'right, background-color, border, box-shadow',
                  outline: '0 !important',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  ...getAdaptiveGlassStyleBlur(),
                  ...getAdaptiveGlassBackgroundColor(),
                }}
                >
                  <img 
                    src={getLogoSrc()}
                    alt="Chatflix Home" 
                    className="block w-7 h-7 md:w-6 md:h-6 object-contain transition-all duration-300"
                  />
                </button>
              ) : (
                // 채팅창: 새글 아이콘 (기존 크기, 아이콘만 중앙 정렬)
                <button
                  onClick={handleNewChatClick}
                  className="text-(--foreground) rounded-full flex items-center justify-center group cursor-pointer p-[5px] md:p-[4px]"
                  title="New Chat"
                  aria-label="New Chat"
                  style={{
                    willChange: 'right, background-color, border, box-shadow',
                    outline: '0 !important',
                    WebkitTapHighlightColor: 'transparent',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    ...getAdaptiveGlassStyleBlur(),
                    ...getAdaptiveGlassBackgroundColor(),
                  }}
                >
                  <SquarePencil
                    className={`w-7 h-7 md:w-6 md:h-6 pt-0.5 pl-0 md:pt-0.5 md:pl-0.5 transition-all duration-300 ${getIconClassName(hasBackgroundImage)}`}
                  />
                </button>
              )}
            </div>
          )}

          {/* Main Content */}
          <div 
            className={`flex-1 transition-all duration-300 ease-in-out relative ${
              shouldShowSidebar ? 'ml-0 md:ml-96' : 'ml-0'
            }`}
            style={{
              willChange: 'margin-left'
            }}
          >
            {/* Route transition loading overlay */}
            {isRouteTransitioning && (
              <div 
                className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md overflow-hidden"
                style={{
                  willChange: 'opacity'
                }}
              >
                {/* 배경 방사형 그라데이션 펄스 */}
                <div className="absolute inset-0 route-loading-bg-pulse"></div>
                
                <div className="flex flex-col items-center gap-6 animate-fade-in relative z-10">
                  {/* 로고 컨테이너 */}
                  <div className="relative route-loading-logo-container">
                    {/* 글로우 효과 레이어 */}
                    <div className="absolute inset-0 route-loading-glow-pulse"></div>
                    
                    {/* 로고 */}
                    <div className="relative route-loading-logo-float">
                      <img
                        src={getLogoSrc()}
                        alt="Chatflix"
                        className="w-24 h-24 md:w-32 md:h-32 route-loading-logo-shimmer"
                      />
                    </div>
                  </div>
                  
                </div>
                
                <style jsx>{`
                  @keyframes fade-in {
                    from { 
                      opacity: 0; 
                      transform: translateY(-10px); 
                    }
                    to { 
                      opacity: 1; 
                      transform: translateY(0); 
                    }
                  }
                  
                  @keyframes route-loading-glow-pulse {
                    0%, 100% { 
                      opacity: 0.3;
                      transform: scale(1.2);
                      filter: blur(20px);
                    }
                    50% { 
                      opacity: 0.6;
                      transform: scale(1.4);
                      filter: blur(30px);
                    }
                  }
                  
                  @keyframes route-loading-logo-shimmer {
                    0% {
                      filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
                    }
                    50% {
                      filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.7));
                    }
                    100% {
                      filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
                    }
                  }
                  
                  @keyframes route-loading-logo-float {
                    0%, 100% { 
                      transform: translateY(0px);
                    }
                    50% { 
                      transform: translateY(-8px);
                    }
                  }
                  
                  @keyframes route-loading-bg-pulse {
                    0%, 100% {
                      opacity: 0.1;
                      background: radial-gradient(
                        circle at center,
                        rgba(59, 130, 246, 0.15) 0%,
                        transparent 70%
                      );
                    }
                    50% {
                      opacity: 0.2;
                      background: radial-gradient(
                        circle at center,
                        rgba(139, 92, 246, 0.25) 0%,
                        transparent 70%
                      );
                    }
                  }
                  
                  .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                  }
                  
                  .route-loading-logo-container {
                    position: relative;
                  }
                  
                  .route-loading-glow-pulse {
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent 70%);
                    border-radius: 50%;
                    animation: route-loading-glow-pulse 2.5s ease-in-out infinite;
                    pointer-events: none;
                  }
                  
                  .route-loading-logo-float {
                    animation: route-loading-logo-float 3s ease-in-out infinite;
                  }
                  
                  .route-loading-logo-shimmer {
                    position: relative;
                    animation: route-loading-logo-shimmer 3s ease-in-out infinite;
                    transition: filter 0.3s ease;
                  }
                  
                  .route-loading-bg-pulse {
                    animation: route-loading-bg-pulse 4s ease-in-out infinite;
                    pointer-events: none;
                  }
                `}</style>
              </div>
            )}
            {children}
          </div>
        </div>
      </SidebarContext.Provider>
    </ChatProvider>
  )
}

