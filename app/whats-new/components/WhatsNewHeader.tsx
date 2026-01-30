'use client'

import { getAdaptiveGlassStyleBlur, getAdaptiveGlassStyleClean, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'

interface WhatsNewHeaderProps {
  activeSection?: string
}

export default function WhatsNewHeader({ activeSection }: WhatsNewHeaderProps) {

  // Get adaptive glass style
  const isDark = getInitialTheme()
  const glassStyle = getAdaptiveGlassStyleClean(isDark)
  const { boxShadow, border, ...styleWithoutBorderAndShadow } = glassStyle

  return (
    <div 
      className="sticky top-0 z-[60] -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 px-8 sm:px-8 md:px-40 lg:px-48" 
      style={styleWithoutBorderAndShadow}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between pt-4 mb-16 sm:mb-28 border-b border-[var(--subtle-divider)] pb-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What's New
          </h2>
        </div>
      </div>
    </div>
  )
}
