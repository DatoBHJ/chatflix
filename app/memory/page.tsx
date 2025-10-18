'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchUserName } from '../components/AccountDialog'
import { createClient } from '@/utils/supabase/client'
import { MemoryBankData, CategoryData } from './components/types'
import MemoryHeader from './components/MemoryHeader'
import OverviewSection from './components/OverviewSection'
import MemoryModals from './components/MemoryModals'

export default function MemoryBankPage() {
  const [memoryData, setMemoryData] = useState<MemoryBankData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [isUserNameLoaded, setIsUserNameLoaded] = useState(false)
  const [expandedCard, setExpandedCard] = useState<'conversation' | 'refinement' | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchMemoryBankData()
    fetchUserNameData()
  }, [])

  const fetchUserNameData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Try to get from localStorage first for instant display
        const cachedName = localStorage.getItem(`user_name_${user.id}`)
        if (cachedName) {
          setUserName(cachedName)
          setIsUserNameLoaded(true)
        }
        
        // Fetch from server and update
        const name = await fetchUserName(user.id, supabase)
        setUserName(name)
        setIsUserNameLoaded(true)
        
        // Update localStorage cache
        localStorage.setItem(`user_name_${user.id}`, name)
      } else {
        setIsUserNameLoaded(true)
      }
    } catch (error) {
      console.error('Error fetching user name:', error)
      setIsUserNameLoaded(true)
    }
  }

  const fetchMemoryBankData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Fetching memory bank data...')
      const response = await fetch('/api/memory-bank')
      const data = await response.json()

      console.log('Memory bank API response:', { 
        status: response.status, 
        ok: response.ok, 
        data: data 
      })

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Not authenticated, redirecting to login')
          // Redirect to login if not authenticated
          router.push('/login')
          return
        }
        throw new Error(data.error || 'Failed to fetch memory bank data')
      }

      setMemoryData(data)
      
      // All categories start collapsed (no auto-expand)
    } catch (error) {
      console.error('Error fetching memory bank data:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch memory bank data')
    } finally {
      setIsLoading(false)
    }
  }

  // Edit category handlers
  const handleEditCategory = (category: CategoryData) => {
    setEditingCategory(category)
    setEditingContent(category.content)
  }

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingContent.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/memory-bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory.category,
          content: editingContent.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      const result = await response.json()
      
      // Update local state immediately
      setMemoryData(prevData => {
        if (!prevData) return prevData
        
        const updatedCategories = prevData.categories.map(cat => 
          cat.category === editingCategory.category 
            ? { ...cat, content: editingContent.trim(), updated_at: result.category.updated_at }
            : cat
        )
        
        return {
          ...prevData,
          categories: updatedCategories
        }
      })

      setEditingCategory(null)
      setEditingContent('')
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditingContent('')
  }

  // Don't render content until user name is loaded
  if (!isUserNameLoaded) {
    return (
      <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)' }}>
        <div className="px-8 sm:px-8 md:px-40 lg:px-48 pt-8 sm:pt-24 md:pt-28 pb-8">
          <div className="max-w-4xl mx-auto">
            <MemoryHeader activeSection="overview" />
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)' }}>
        <div className="px-8 sm:px-8 md:px-40 lg:px-48 pt-8 sm:pt-24 md:pt-28 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Navigation - Apple Style */}
          <MemoryHeader activeSection="overview" />
          
          {/* Overview Section */}
          <OverviewSection
            memoryData={memoryData}
            isLoading={isLoading}
            error={error}
            fetchMemoryBankData={fetchMemoryBankData}
            userName={userName}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            editingCategory={editingCategory}
            setEditingCategory={setEditingCategory}
            editingContent={editingContent}
            setEditingContent={setEditingContent}
            isSaving={isSaving}
            handleSaveEdit={handleSaveEdit}
            handleCancelEdit={handleCancelEdit}
            expandedCard={expandedCard}
            setExpandedCard={setExpandedCard}
            handleEditCategory={handleEditCategory}
          />
        </div>
      </div>

      {/* Modals */}
      <MemoryModals
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        isSaving={isSaving}
        handleSaveEdit={handleSaveEdit}
        handleCancelEdit={handleCancelEdit}
        expandedCard={expandedCard}
        setExpandedCard={setExpandedCard}
      />
    </div>
  )
}