'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAnonymous: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAnonymous: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (mounted) {
          if (error) {
            // 게스트 모드에서는 auth 에러가 정상이므로 로깅하지 않음
            const errorMessage = error?.message;
            if (!errorMessage?.includes('Auth session missing') && 
                !errorMessage?.includes('session not found')) {
              console.error('Auth error:', error)
            }
            setUser(null)
          } else {
            setUser(user)
          }
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error loading user information:', error)
        if (mounted) {
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (event === 'SIGNED_OUT') {
          setUser(null)
        } else if (event === 'SIGNED_IN') {
          setUser(session?.user || null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const isAuthenticated = !!user
  const isAnonymous = !user

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, isAnonymous }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
