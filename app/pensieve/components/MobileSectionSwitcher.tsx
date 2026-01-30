'use client'

import { usePensieve } from '../context/PensieveContext'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import { useRouter } from 'next/navigation'
import { Image, Layers } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MobileSectionSwitcher() {
  const { activeSection, setActiveSection, mobileNavExpanded, setMobileNavExpanded } = usePensieve()
  const { isSelectionMode } = usePensieveSelection()
  const router = useRouter()
  const isDark = getInitialTheme()

  const isClickedRef = useRef(false)

  useEffect(() => {
    const handleScroll = (e: Event) => {
      // 1. 다양한 경로로 현재 스크롤 위치 파악 (e.target이 실제 스크롤 중인 요소일 수 있음)
      const target = e.target as any
      let scrollY = 0
      
      if (target === document || target === window || !target) {
        scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
      } else {
        scrollY = target.scrollTop || 0
      }

      // 2. 상태 업데이트 로직 (공유 상태 사용)
      if (scrollY <= 5) {
        // 최상단에서는 무조건 확장
        setMobileNavExpanded(true)
        isClickedRef.current = false
      } else {
        // 최상단이 아닐 때 스크롤이 발생하면 무조건 축소
        setMobileNavExpanded(false)
        isClickedRef.current = false
      }
    }

    // 전역 스크롤 감지 (캡처링 모드 필수)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [setMobileNavExpanded])

  if (isSelectionMode) return null

  const handleSectionChange = (section: 'all' | 'saved') => {
    if (activeSection !== section) {
      setActiveSection(section)
      if (section === 'all') router.push('/pensieve')
      else if (section === 'saved') router.push('/pensieve/saved')
    }
  }

  const handleButtonClick = (section: 'all' | 'saved', e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!mobileNavExpanded) {
      // 축소된 상태에서 클릭하면 확장만 함 (공유 상태 사용)
      setMobileNavExpanded(true)
      isClickedRef.current = true
      return
    }

    // 확장된 상태에서 클릭하면 섹션 이동 또는 (이미 해당 섹션이면) 축소
    if (activeSection === section) {
      if (window.scrollY > 10) {
        setMobileNavExpanded(false)
        isClickedRef.current = false
      }
    } else {
      handleSectionChange(section)
    }
  }

  const commonTransition = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 } as const

  return (
    <div className="sm:hidden rounded-full fixed bottom-4 left-6 z-80 flex items-center">
      <motion.div 
        layout
        animate={{ 
          padding: mobileNavExpanded ? '6px' : '0px'
        }}
        transition={commonTransition}
        className="flex items-center rounded-full overflow-hidden"
        style={{
          ...getAdaptiveGlassStyleBlur(),
        }}
      >
        <div className="flex items-center" style={{ gap: mobileNavExpanded ? '4px' : '0px' }}>
          <AnimatePresence initial={false}>
            {(mobileNavExpanded || activeSection === 'saved') && (
              <motion.button
                key="saved"
                initial={{ opacity: 0, width: 0, height: 48, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  width: mobileNavExpanded ? 70 : 48, 
                  height: mobileNavExpanded ? 54 : 48,
                  scale: 1 
                }}
                exit={{ opacity: 0, width: 0, height: 48, scale: 0.95 }}
                transition={commonTransition}
                onClick={(e) => handleButtonClick('saved', e)}
                className={`shrink-0 flex items-center justify-center rounded-full overflow-hidden ${
                  activeSection === 'saved' && mobileNavExpanded
                    ? (isDark ? 'bg-white/10' : 'bg-black/8') 
                    : (mobileNavExpanded ? 'hover:bg-white/5 dark:hover:bg-white/5' : '')
                }`}
              >
                <div className="flex flex-col items-center justify-center w-full">
                  <motion.div
                    animate={{ 
                      marginBottom: mobileNavExpanded ? '4px' : '0px',
                    }}
                    transition={commonTransition}
                  >
                    <Image 
                      className={activeSection === 'saved' ? 'text-[#429EFF]' : 'text-white'} 
                      size={20}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {mobileNavExpanded && (
                      <motion.span 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`text-[10px] font-bold ${activeSection === 'saved' ? 'text-[#429EFF]' : 'text-white'}`}
                      >
                        Cabinet
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            )}

            {(mobileNavExpanded || activeSection === 'all') && (
              <motion.button
                key="all"
                initial={{ opacity: 0, width: 0, height: 48, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  width: mobileNavExpanded ? 70 : 48, 
                  height: mobileNavExpanded ? 54 : 48,
                  scale: 1 
                }}
                exit={{ opacity: 0, width: 0, height: 48, scale: 0.95 }}
                transition={commonTransition}
                onClick={(e) => handleButtonClick('all', e)}
                className={`shrink-0 flex items-center justify-center rounded-full overflow-hidden ${
                  activeSection === 'all' && mobileNavExpanded
                    ? (isDark ? 'bg-white/10' : 'bg-black/8') 
                    : (mobileNavExpanded ? 'hover:bg-white/5 dark:hover:bg-white/5' : '')
                }`}
              >
                <div className="flex flex-col items-center justify-center w-full">
                  <motion.div
                    animate={{ 
                      marginBottom: mobileNavExpanded ? '4px' : '0px',
                    }}
                    transition={commonTransition}
                  >
                    <Layers 
                      className={activeSection === 'all' ? 'text-[#429EFF]' : 'text-white'} 
                      size={20}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {mobileNavExpanded && (
                      <motion.span 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`text-[10px] font-bold ${activeSection === 'all' ? 'text-[#429EFF]' : 'text-white'}`}
                      >
                        Strands
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}




