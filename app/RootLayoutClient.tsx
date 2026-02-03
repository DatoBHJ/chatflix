'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import Announcement from './components/Announcement'
import useAnnouncement from './hooks/useAnnouncement'
import { fetchUserName } from '@/app/components/AccountDialog'
import { Toaster } from 'sonner'
import { SidebarContext } from './lib/SidebarContext'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { OnboardingProvider } from './components/Onboarding/OnboardingProvider'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'
import { handleDeleteAllChats as deleteAllChats } from './lib/chatUtils'

import { useTheme } from 'next-themes'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { ChatflixLoadingScreen } from './components/ChatflixLoadingScreen'
import { HomePageBackground } from './components/HomePageBackground'
import { GlassDistortionFilters } from './lib/GlassDistortionFilters'
import { LoadingProvider, useLoading } from './lib/LoadingContext'


function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, isAuthenticated, isAnonymous } = useAuth()
  const { isLoading: isAppLoading } = useLoading()
  const [userName, setUserName] = useState('You')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  // const [isPromptEditMode, setIsPromptEditMode] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { announcements, showAnnouncement, hideAnnouncement } = useAnnouncement()
  const supabase = createSupabaseClient()
  const { theme, resolvedTheme } = useTheme()
  const [isDark, setIsDark] = useState(false)
  
  // 경로 기반으로 배경 이미지 존재 여부 결정
  const hasBackgroundImage = pathname === '/'


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


  // Hide sidebar for all /chat app routes
  // 모든 /chat 경로에서 글로벌 사이드바 숨김
  // 메시지 앱은 자체 레이아웃(ChatLayoutClient)에서 UI 관리
  const isChatAppRoute = pathname?.startsWith('/chat')

  const prevPathnameRef = useRef<string | null>(null)

  // 테마 감지 useEffect
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    };
    
    checkTheme();
    
    // 테마 변경 감지
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  // /photo* 에서 / 진입 시에만 300ms 뒤 backgroundImageChanged 디스패치 (설정 직후 / 진입 시 새 배경 재조회)
  const photoRoutes = ['/photo', '/photo/overview', '/photo/uploads', '/photo/saved'];
  useEffect(() => {
    const prev = prevPathnameRef.current;
    if (pathname === '/' && prev !== null && photoRoutes.includes(prev)) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('backgroundImageChanged'));
      }, 300);
      prevPathnameRef.current = pathname;
      return () => clearTimeout(timer);
    }
    prevPathnameRef.current = pathname;
  }, [pathname]);

  if (authLoading) {
    return <ChatflixLoadingScreen />
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

  // Don't apply bg-background on login page to allow background image to show
  const isLoginPage = pathname === '/login'
  
  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, isAccountOpen, setIsAccountOpen, isHovering, isMobile, isSelectionMode, setIsSelectionMode, /* isPromptEditMode, setIsPromptEditMode */ }}>
      <div style={{ position: 'relative', minHeight: '100dvh' }}>
        {pathname === '/' && <HomePageBackground user={displayUser} />}
        <div
          className={`flex h-screen safe-area-container text-foreground overflow-x-hidden ${isLoginPage || pathname === '/' ? '' : 'bg-background'}`}
          style={{ minHeight: '100dvh' }}
        >
          {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
          <GlassDistortionFilters />

          <Toaster position="top-right" richColors />
          <Announcement
            announcements={announcements || []}
            onClose={hideAnnouncement}
          />

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>

          <div id="portal-root"></div>
        </div>
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
      <LoadingProvider>
        <OnboardingProvider>
          <LayoutContent>{children}</LayoutContent>
        </OnboardingProvider>
      </LoadingProvider>
    </AuthProvider>
  )
} 

