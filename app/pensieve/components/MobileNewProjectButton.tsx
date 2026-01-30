'use client'

import { usePensieve } from '../context/PensieveContext'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import { Aperture } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

export default function MobileNewProjectButton() {
  const { setIsUploadModalOpen, mobileNavExpanded, setMobileNavExpanded } = usePensieve()
  const { isSelectionMode } = usePensieveSelection()

  if (isSelectionMode) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // 크기에 상관없이 즉시 모달 열기
    setIsUploadModalOpen(true)
    
    // 시각적 피드백을 위해 확장 (MobileSectionSwitcher와 동기화됨)
    if (!mobileNavExpanded) {
      setMobileNavExpanded(true)
    }
  }

  const commonTransition = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 } as const

  return (
    <div className="sm:hidden fixed bottom-4 right-6 z-80 flex items-center justify-center">
      <motion.button
        layout
        initial={false}
        animate={{ 
          width: mobileNavExpanded ? 60 : 48, 
          height: mobileNavExpanded ? 60 : 48,
        }}
        transition={commonTransition}
        onClick={handleClick}
        className="shrink-0 grid place-items-center rounded-full transition-colors"
        style={{
          ...getAdaptiveGlassStyleBlur(),
        //   backgroundColor: '#D60F2B',

        //   backgroundColor: 'rgba(8, 32, 38, 0.9)',
        }}
      >
        <motion.div
          animate={{ 
            scale: mobileNavExpanded ? 1.2 : 1,
          }}
          transition={commonTransition}
          className="grid place-items-center"
        >
          <Aperture color="white" size={22} />
        </motion.div>
      </motion.button>
    </div>
  )
}

