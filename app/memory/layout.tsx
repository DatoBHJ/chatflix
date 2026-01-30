'use client'

import { MemoryProvider, useMemoryApp } from './components/MemoryContext'
import NavigationWrapper from './components/NavigationWrapper'

function MemoryLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useMemoryApp()

  if (isLoading) return null

  return (
    <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)', overscrollBehaviorY: 'none' }}>
      <div className="px-8 sm:px-8 pt-8 sm:pt-24 md:pt-28 pb-8" style={{ overscrollBehaviorY: 'none' }}>
        <div className="max-w-4xl mx-auto">
          {/* Header Navigation - Persists across tab changes */}
          <NavigationWrapper />

          {/* Page Content */}
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemoryProvider>
      <MemoryLayoutContent>{children}</MemoryLayoutContent>
    </MemoryProvider>
  )
}

