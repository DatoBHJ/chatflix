'use client'

import { useState, useEffect } from 'react'
import { fetchUserName } from '../components/AccountDialog'
import { createClient } from '@/utils/supabase/client'
import { MemoryBankData, CategoryData } from './components/types'
import OverviewSection from './components/OverviewSection'
import MemoryModals from './components/MemoryModals'
import { useMemoryApp } from './components/MemoryContext'

export default function MemoryBankPage() {
  const { isLoading: contextLoading } = useMemoryApp()
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
          console.log('Not authenticated, showing guest mode')
          // 🚀 게스트 모드 지원: 로그인 리다이렉트 대신 빈 데이터로 표시
          setMemoryData({
            user_id: 'anonymous',
            categories: [],
            last_updated: null,
            timestamp: new Date().toISOString()
          })
          setError('Sign in to view')
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

      // 🚀 최적화: localStorage 캐시 무효화 및 갱신
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          const { invalidateMemoryCache, loadMemoryWithCache } = await import('@/app/utils/memory-cache-client');
          invalidateMemoryCache(user.id, [editingCategory.category]);
          await loadMemoryWithCache(user.id); // 캐시 갱신
          console.log('🔄 [MEMORY] Client cache refreshed after manual update');
        }
      } catch (error) {
        console.warn('Failed to refresh memory cache:', error);
      }

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
  if (!isUserNameLoaded || contextLoading) {
    return null
  }

  return (
    <>
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
    </>
  )
}