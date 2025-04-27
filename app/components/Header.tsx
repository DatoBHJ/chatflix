'use client'

import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { SubscriptionButton } from './SubscriptionButton'
import WhatsNewContainer from './WhatsNewContainer'
import { useUser } from '@/app/lib/UserContext'
import Image from 'next/image'

export interface HeaderProps {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  showBackButton?: boolean;
  user?: any;
}

export function Header({ isSidebarOpen, onSidebarToggle, showBackButton, user }: HeaderProps) {
  const router = useRouter()
  const { userName, profileImage } = useUser()

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[var(--background)]">
      <div className="flex justify-between items-center px-6 py-6">
        <div className="flex items-center gap-4">
          {showBackButton ? (
            <button
              onClick={() => router.back()}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onSidebarToggle}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          
          <span 
            className="text-xs font-bold py-0.5 px-0 flex items-center gap-1 text-[var(--foreground)] cursor-pointer" 
            onClick={() => {
              // Use window.location for direct navigation to avoid loading state issues
              window.location.href = '/'
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)]"></span>
            BETA
          </span>

          {/* <div className="hidden md:flex items-center gap-2 cursor-pointer" onClick={() => router.push('/user-insights')}>
            {profileImage ? (
              <div className="w-7 h-7 rounded-full overflow-hidden relative">
                <Image 
                  src={profileImage} 
                  alt={userName} 
                  width={28}
                  height={28}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] inline-flex items-center justify-center text-sm font-medium">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{userName}</span>
          </div> */}
          {user && <SubscriptionButton user={user} />}

        </div>

        <div className="flex items-center gap-5">
          {/* 이부분에 PRICING 버튼 추가 */}
          <button
            onClick={() => router.push('/pricing')}
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            PRICING
          </button>
          <WhatsNewContainer />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
} 