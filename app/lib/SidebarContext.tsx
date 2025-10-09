'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface SidebarContextType {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isAccountOpen: boolean
  setIsAccountOpen: (isOpen: boolean) => void
  isHovering: boolean
  isMobile: boolean
  isSelectionMode: boolean
  setIsSelectionMode: React.Dispatch<React.SetStateAction<boolean>>
  isPromptEditMode: boolean
  setIsPromptEditMode: React.Dispatch<React.SetStateAction<boolean>>
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
      isMobile: false,
      isSelectionMode: false,
      setIsSelectionMode: () => {},
      isPromptEditMode: false,
      setIsPromptEditMode: () => {}
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