'use client'

import { PensieveProvider, usePensieve } from './context/PensieveContext'
import { PensieveSelectionProvider } from './context/PensieveSelectionContext'
import PensieveNavigationWrapper from './components/PensieveNavigationWrapper'
import { X } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import { getChatflixLogo } from '@/lib/models/logoUtils'

function PensieveLayoutContent({ children }: { children: React.ReactNode }) {
  const { uploadSuccess, setUploadSuccess, isLoading } = usePensieve()

  if (isLoading) return null

  return (
    <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)', overscrollBehaviorY: 'none' }}>
      <div className="px-3 sm:px-8  pt-2 sm:pt-24 pb-8" style={{ overscrollBehaviorY: 'none' }}>
        {/* Header Navigation with tabs - Persists across tab changes */}
        <PensieveNavigationWrapper />

        {/* Page Content */}
        {children}

        {/* Global Toast Notification */}
        {uploadSuccess && (
          <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:top-4 z-[70] flex items-center gap-2 px-4 py-3 md:px-5 md:py-4 rounded-2xl md:max-w-[380px] animate-in fade-in slide-in-from-top-4 md:slide-in-from-right-4 transition-all duration-300 ease-out" style={getAdaptiveGlassStyleBlur()}>
            <img
              src={getChatflixLogo({ isDark: getInitialTheme() })}
              alt="Chatflix"
              className="w-5 h-5 flex-shrink-0 mr-3"
            />
            <span className="text-sm font-medium flex-1">{uploadSuccess}</span>
            <button
              onClick={() => setUploadSuccess(null)}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PensieveLayout({ children }: { children: React.ReactNode }) {
  return (
    <PensieveProvider>
      <PensieveSelectionProvider>
      <PensieveLayoutContent>{children}</PensieveLayoutContent>
      </PensieveSelectionProvider>
    </PensieveProvider>
  )
}


