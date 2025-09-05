'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface TwitterSignInProps {
  isSignIn?: boolean
}

export function TwitterSignIn({ isSignIn = false }: TwitterSignInProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSignInWithTwitter() {
    try {
      setLoading(true)
      
      // 로그인 성공 후, 우리 앱의 '/auth/callback' 페이지로 돌아오도록 설정
      // window.location.origin은 현재 사이트의 주소(로컬에서는 http://localhost:3000, 배포 후에는 https://chatflix.app)를 동적으로 가져옵니다.
      const redirectUrl = `${window.location.origin}/auth/callback`
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: redirectUrl,
        }
      })

      if (error) throw error
      
      // OAuth flow will redirect automatically
      // No need to manually redirect here
    } catch (error) {
      console.error('Error signing in with Twitter:', error)
      setLoading(false)
    }
  }

  // Twitter OAuth temporarily disabled
  return null
  
  // return (
  //   <button 
  //     onClick={handleSignInWithTwitter}
  //     disabled={loading}
  //     className="w-full py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
  //     style={{
  //       backgroundColor: 'var(--background)',
  //       borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
  //       color: 'var(--foreground)'
  //     }}
  //   >
  //     {loading ? (
  //       <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--foreground)' }}></div>
  //     ) : (
  //       <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
  //         <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  //       </svg>
  //     )}
  //     {isSignIn ? 'Sign in with X' : 'Sign up with X'}
  //   </button>
  // )
}
