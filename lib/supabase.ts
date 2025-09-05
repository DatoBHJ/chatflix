import { createClient } from '@supabase/supabase-js'
import { DatabaseMessage } from './types'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false  // 세션 지속성 비활성화
    },
    global: {
      fetch: fetch  // 전역 fetch 사용
    }
  }
)

export type { DatabaseMessage as Message } 