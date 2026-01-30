'use client'

import { PhotoProvider, usePhotoApp } from './components/PhotoContext'
import PhotoNavigationWrapper from './components/PhotoNavigationWrapper'

function PhotoLayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = usePhotoApp()

  if (isLoading) return null

  return (
    <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)', overscrollBehaviorY: 'none' }}>
      <div className="px-8 sm:px-8 pt-8 sm:pt-24 md:pt-28 pb-8" style={{ overscrollBehaviorY: 'none' }}>
        {/* Header Navigation - Persists across tab changes */}
        <PhotoNavigationWrapper />

        {/* Page Content */}
        {children}
      </div>
    </div>
  )
}

export default function PhotoLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhotoProvider>
      <PhotoLayoutContent>{children}</PhotoLayoutContent>
    </PhotoProvider>
  )
}
