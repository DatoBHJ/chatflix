'use client'

import MemoryHeader from '../components/MemoryHeader'
import ControlSection from '../components/ControlSection'

export default function ControlPage() {
  return (
    <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)' }}>
      <div className="px-8 sm:px-8 md:px-40 lg:px-48 pt-8 sm:pt-24 md:pt-28 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Navigation - Apple Style */}
          <MemoryHeader activeSection="control" />
          
          {/* Control Section */}
          <ControlSection />
        </div>
      </div>
    </div>
  )
}
