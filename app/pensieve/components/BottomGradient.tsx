'use client'

import { usePensieveSelection } from '../context/PensieveSelectionContext'

export default function BottomGradient() {
  const { isSelectionMode } = usePensieveSelection()

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 sm:left-8 sm:right-8 md:left-40 md:right-40 lg:left-48 lg:right-48 pt-32 pb-8 z-[70] pointer-events-none bg-gradient-to-t from-black/60 via-black/20 to-transparent sm:from-black/90 sm:via-black/40 transition-opacity duration-300 ${
        isSelectionMode ? 'opacity-100' : 'opacity-100 sm:opacity-0'
      }`}
    />
  )
}

