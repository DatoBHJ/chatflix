import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { User } from '@supabase/supabase-js'

export async function getServerUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // Server-side에서 쿠키 설정은 하지 않음
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      // 게스트 모드에서는 auth 에러가 정상이므로 로깅하지 않음
      const errorMessage = error?.message;
      if (!errorMessage?.includes('Auth session missing') && 
          !errorMessage?.includes('session not found')) {
        console.error('Server auth error:', error)
      }
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
}
