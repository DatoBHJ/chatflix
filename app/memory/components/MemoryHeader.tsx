'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassStyleClean, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'

interface MemoryHeaderProps {
  activeSection: 'overview' | 'memory' | 'control'
}

export default function MemoryHeader({ activeSection }: MemoryHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSectionChange = (section: 'overview' | 'memory' | 'control') => {
    if (section === 'overview') {
      router.push('/memory')
    } else if (section === 'memory') {
      router.push('/memory/memory')
    } else {
      router.push('/memory/control')
    }
    setIsMobileMenuOpen(false)
  }

  // Get adaptive glass style
  const isDark = getInitialTheme()
  const glassStyle = getAdaptiveGlassStyleClean(isDark)
  const { boxShadow, border, ...styleWithoutBorderAndShadow } = glassStyle

  return (
    <div 
      className="sticky top-0 z-[60] -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 px-8 sm:px-8 md:px-40 lg:px-48" 
      style={styleWithoutBorderAndShadow}
    >
      <div className="max-w-4xl mx-auto ">
        <div className={`relative flex items-center justify-between pt-4 ${isMobileMenuOpen ? 'mb-3' : 'mb-16'} sm:mb-28 border-b border-[var(--subtle-divider)] pb-3`}>
          <h2 className="text-xl font-semibold tracking-tight">
            Memory
          </h2>
          {/* Desktop tabs */}
          <nav className="hidden sm:flex gap-6">
            <button
              data-onboarding-target="overview-tab"
              onClick={() => handleSectionChange('overview')}
              className={`text-sm pb-3 transition-all relative cursor-pointer ${
                activeSection === 'overview' 
                  ? 'text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
              aria-current={activeSection === 'overview' ? 'page' : undefined}
              style={{
                borderBottom: activeSection === 'overview' ? '2px solid var(--foreground)' : '2px solid transparent',
                marginBottom: '-20px'
              }}
            >
              Overview
            </button>
            <button
              onClick={() => handleSectionChange('memory')}
              className={`text-sm pb-3 transition-all relative cursor-pointer ${
                activeSection === 'memory' 
                  ? 'text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
              aria-current={activeSection === 'memory' ? 'page' : undefined}
              style={{
                borderBottom: activeSection === 'memory' ? '2px solid var(--foreground)' : '2px solid transparent',
                marginBottom: '-20px'
              }}
            >
              Memory
            </button>
            <button
              onClick={() => handleSectionChange('control')}
              className={`text-sm pb-3 transition-all relative cursor-pointer ${
                activeSection === 'control' 
                  ? 'text-[var(--foreground)]' 
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
              aria-current={activeSection === 'control' ? 'page' : undefined}
              style={{
                borderBottom: activeSection === 'control' ? '2px solid var(--foreground)' : '2px solid transparent',
                marginBottom: '-20px'
              }}
            >
              Control
            </button>
          </nav>
          {/* Mobile chevron toggle */}
          <button
            className="sm:hidden ml-3 p-2 rounded-md cursor-pointer text-[var(--foreground)] hover:bg-[var(--muted)]/10 transition-colors"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMobileMenuOpen(v => !v)}
          >
            <svg className={`w-4 h-4 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          
          {/* Onboarding target for both steps - positioned at header bottom left (under Memory title) */}
          <div 
            data-onboarding-target="memory-header-info"
            className="absolute bottom-0 left-0 sm:left-20 w-20 h-6"
            style={{ visibility: 'hidden', pointerEvents: 'none' }}
            aria-hidden="true"
          />
        </div>

        {/* Mobile vertical menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden -mt-3 mb-3">
            <div className="flex flex-col gap-1 pb-10 pt-4">
              <button
                data-onboarding-target="overview-tab"
                onClick={() => handleSectionChange('overview')}
                className={`flex items-center gap-3 pr-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  activeSection === 'overview' ? 'text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                aria-current={activeSection === 'overview' ? 'page' : undefined}
              >
                <span
                  className="inline-block"
                  style={{
                    borderLeft: activeSection === 'overview' ? '1px solid var(--foreground)' : '1px solid transparent',
                    paddingLeft: '12px',
                    height: '10px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Overview
                </span>
              </button>
              <button
                onClick={() => handleSectionChange('memory')}
                className={`flex items-center gap-3 pr-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  activeSection === 'memory' ? 'text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                aria-current={activeSection === 'memory' ? 'page' : undefined}
              >
                <span
                  className="inline-block"
                  style={{
                    borderLeft: activeSection === 'memory' ? '1px solid var(--foreground)' : '1px solid transparent',
                    paddingLeft: '12px',
                    height: '10px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Memory
                </span>
              </button>
              <button
                onClick={() => handleSectionChange('control')}
                className={`flex items-center gap-3 pr-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  activeSection === 'control' ? 'text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                aria-current={activeSection === 'control' ? 'page' : undefined}
              >
                <span
                  className="inline-block"
                  style={{
                    borderLeft: activeSection === 'control' ? '1px solid var(--foreground)' : '1px solid transparent',
                    paddingLeft: '12px',
                    height: '10px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Control
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
