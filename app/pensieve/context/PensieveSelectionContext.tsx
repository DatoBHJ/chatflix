'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface PensieveSelectionContextType {
  isSelectionMode: boolean
  setIsSelectionMode: (value: boolean) => void
  selectedImageIds: string[]
  selectedProjectIds: string[]
  selectedGroupIds: string[] // For multi-image groups
  setSelectedImageIds: (ids: string[]) => void
  setSelectedProjectIds: (ids: string[]) => void
  setSelectedGroupIds: (ids: string[]) => void
  handleSelectImage: (imageId: string) => void
  handleSelectProject: (projectId: string) => void
  handleSelectGroup: (groupId: string) => void
  clearSelection: () => void
}

const PensieveSelectionContext = createContext<PensieveSelectionContextType | undefined>(undefined)

export function PensieveSelectionProvider({ children }: { children: ReactNode }) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  const handleSelectImage = (imageId: string) => {
    setSelectedImageIds(prev => 
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    )
  }

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const clearSelection = () => {
    setSelectedImageIds([])
    setSelectedProjectIds([])
    setSelectedGroupIds([])
  }

  // Clear selection when exiting selection mode
  const handleSetIsSelectionMode = (value: boolean) => {
    setIsSelectionMode(value)
    if (!value) {
      clearSelection()
    }
  }

  return (
    <PensieveSelectionContext.Provider value={{
      isSelectionMode,
      setIsSelectionMode: handleSetIsSelectionMode,
      selectedImageIds,
      selectedProjectIds,
      selectedGroupIds,
      setSelectedImageIds,
      setSelectedProjectIds,
      setSelectedGroupIds,
      handleSelectImage,
      handleSelectProject,
      handleSelectGroup,
      clearSelection
    }}>
      {children}
    </PensieveSelectionContext.Provider>
  )
}

export function usePensieveSelection() {
  const context = useContext(PensieveSelectionContext)
  if (context === undefined) {
    throw new Error('usePensieveSelection must be used within a PensieveSelectionProvider')
  }
  return context
}

