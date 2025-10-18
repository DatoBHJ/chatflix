'use client'

import { useRouter, usePathname } from 'next/navigation'

interface MemoryHeaderProps {
  activeSection: 'overview' | 'control'
}

export default function MemoryHeader({ activeSection }: MemoryHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSectionChange = (section: 'overview' | 'control') => {
    if (section === 'overview') {
      router.push('/memory')
    } else {
      router.push('/memory/control')
    }
  }

  return (
    <div className="flex items-center justify-between mb-16 sm:mb-28 border-b border-[var(--subtle-divider)] pb-3">
      <h2 className="text-xl font-semibold tracking-tight">
        Memory
      </h2>
      <nav className="flex gap-6">
        <button
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
    </div>
  )
}
