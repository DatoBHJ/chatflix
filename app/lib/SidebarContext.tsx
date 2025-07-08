'use client'

import { createContext, useContext } from 'react'

interface SidebarContextType {
  isSidebarOpen: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    return { isSidebarOpen: false } // 기본값
  }
  return context
}

export { SidebarContext } 