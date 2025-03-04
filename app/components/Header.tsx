'use client'

import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

export interface HeaderProps {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  showBackButton?: boolean;
}

export function Header({ isSidebarOpen, onSidebarToggle, showBackButton }: HeaderProps) {
  const router = useRouter()

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[var(--background)]">
      <div className="flex justify-between items-center px-6 py-6">
        <div className="flex items-center gap-2">
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
          {/* <div className="ml-2 flex items-center">
            <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--muted)] to-transparent font-extralight uppercase tracking-[0.65em] text-lg">
              Chatflix
            </h1>
          </div> */}
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => router.push('/about')}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="About"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
} 