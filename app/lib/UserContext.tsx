'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

type UserContextType = {
  user: User | null
  profileImage: string | null
  userName: string
  isLoading: boolean
}

const UserContext = createContext<UserContextType>({
  user: null,
  profileImage: null,
  userName: 'You',
  isLoading: true
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('You')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          // 사용자 이름 설정
          setUserName(user.user_metadata?.name || 'You')
          
          // 프로필 이미지 로드
          try {
            const { data: profileData, error: profileError } = await supabase
              .storage
              .from('profile-pics')
              .list(`${user.id}/`, {
                limit: 1,
                sortBy: { column: 'created_at', order: 'desc' }
              });
              
            if (!profileError && profileData && profileData.length > 0) {
              const { data: imageUrlData } = await supabase
                .storage
                .from('profile-pics')
                .getPublicUrl(`${user.id}/${profileData[0].name}`);
                
              if (imageUrlData) {
                setProfileImage(imageUrlData.publicUrl);
              }
            }
          } catch (profileError) {
            console.error('프로필 이미지 로딩 중 오류:', profileError);
          }
        }
      } catch (error) {
        console.error('사용자 정보 로딩 중 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        if (session?.user) {
          setUserName(session.user.user_metadata?.name || 'You')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <UserContext.Provider value={{ user, profileImage, userName, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext) 