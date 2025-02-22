import { ThemeToggle } from './ThemeToggle'

export interface HeaderProps {
  onSidebarOpen?: () => void;
}

export function Header({ onSidebarOpen }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30">
      <div className="relative flex justify-between items-center px-6 py-6">
        <button
          onClick={onSidebarOpen}
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          title="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
} 