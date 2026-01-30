'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useLoading } from '@/app/lib/LoadingContext'

interface MemoryContextType {
  user: any
  isLoading: boolean
  activeSection: 'overview' | 'memory' | 'control'
  setActiveSection: (section: 'overview' | 'memory' | 'control') => void
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined)

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'overview' | 'memory' | 'control'>('overview')
  
  const { setIsLoading: setAppLoading } = useLoading()
  const supabase = createClient()

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        // 🚀 게스트 모드 지원: 사용자가 없어도 게스트 사용자 객체 생성
        if (!user) {
          // 게스트 사용자 객체 생성 (Memory 앱 패턴과 동일)
          const guestUser = {
            id: 'anonymous',
            email: 'guest@chatflix.app',
            user_metadata: {
              full_name: 'Guest User',
              name: 'Guest'
            },
            isAnonymous: true
          }
          setUser(guestUser)
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        // 에러 발생 시에도 게스트 모드로 진행
        const guestUser = {
          id: 'anonymous',
          email: 'guest@chatflix.app',
          user_metadata: {
            full_name: 'Guest User',
            name: 'Guest'
          },
          isAnonymous: true
        }
        setUser(guestUser)
      } finally {
        setIsLoading(false)
        setAppLoading(false)
      }
    }

    // Only set global loading if we don't have user yet
    if (!user) {
      setAppLoading(true)
    }
    loadUser()
  }, [supabase, setAppLoading])

  return (
    <MemoryContext.Provider value={{
      user,
      isLoading,
      activeSection,
      setActiveSection
    }}>
      {children}
    </MemoryContext.Provider>
  )
}

export function useMemoryApp() {
  const context = useContext(MemoryContext)
  if (context === undefined) {
    throw new Error('useMemoryApp must be used within a MemoryProvider')
  }
  return context
}

