'use client'

import { useState } from 'react'
import { Search, Upload } from 'lucide-react'
import { getAdaptiveGlassStyleClean, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import UploadImageModal from './UploadImageModal'

interface PensieveHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  user?: any
  onUploadComplete?: (metadata: any) => void
}

export default function PensieveHeader({
  searchQuery,
  onSearchChange,
  user,
  onUploadComplete
}: PensieveHeaderProps) {

  // Get adaptive glass style
  const isDark = getInitialTheme()
  const glassStyle = getAdaptiveGlassStyleClean(isDark)
  const { boxShadow, border, ...styleWithoutBorderAndShadow } = glassStyle

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const disabled = !user || user?.isAnonymous || user?.id === 'anonymous'

  return (
    <div 
      className="sticky top-0 z-[60] -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 px-8 sm:px-8 md:px-40 lg:px-48" 
      style={styleWithoutBorderAndShadow}
    >
      <div>
        {/* Header top row */}
        <div className="relative flex items-center justify-between pt-4 mb-4 sm:mb-28 border-b border-[var(--subtle-divider)] pb-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Pensieve
          </h2>
          
          {/* Desktop search - right side */}
          <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xl ml-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search by prompt or keywords..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--accent)] border border-[var(--subtle-divider)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 transition-all text-sm"
              />
            </div>

            {/* Upload button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors bg-[var(--accent)] border-[var(--subtle-divider)] hover:bg-[var(--subtle-divider)] text-[var(--foreground)]`}
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>
        </div>

        {/* Mobile search - below title */}
        <div className="sm:hidden mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search by prompt or keywords..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--accent)] border border-[var(--subtle-divider)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 transition-all text-sm"
            />
          </div>
        </div>

        {/* Mobile upload button */}
        <div className="sm:hidden mb-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer transition-colors bg-[var(--accent)] border-[var(--subtle-divider)] hover:bg-[var(--subtle-divider)] text-[var(--foreground)]`}
            >
              <Upload className="w-4 h-4" />
              Upload image
            </button>
          </div>
        </div>

        {/* Active filters */}
        {searchQuery && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              onClick={() => onSearchChange('')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)] text-sm text-[var(--foreground)] hover:bg-[var(--subtle-divider)] transition-colors"
            >
              "{searchQuery}"
              <span className="text-[var(--muted)]">×</span>
            </button>
          </div>
        )}
      </div>

      <UploadImageModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={(metadata) => {
          setIsUploadModalOpen(false)
          onUploadComplete?.(metadata)
        }}
        user={user}
      />
    </div>
  )
}


