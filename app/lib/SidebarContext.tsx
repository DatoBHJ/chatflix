'use client'

import { createContext, useContext, ReactNode } from 'react'

interface SidebarContextType {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isAccountOpen: boolean
  setIsAccountOpen: (isOpen: boolean) => void
  isHovering: boolean
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    return { 
      isSidebarOpen: false, 
      toggleSidebar: () => {},
      isAccountOpen: false,
      setIsAccountOpen: () => {},
      isHovering: false,
      isMobile: false
    } // 기본값
  }
  return context
}

export const SidebarProvider = ({
  children,
  value
}: {
  children: ReactNode
  value: SidebarContextType
}) => {
  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export { SidebarContext } 