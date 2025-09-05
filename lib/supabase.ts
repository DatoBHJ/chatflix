import { createClient } from '@supabase/supabase-js'
import { DatabaseMessage } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_SUPABASE_URL!
export const supabase = createClient(
  supabaseUrl,
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